import 'dotenv/config';
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { ensureGuild, markMemberLeft, replaceChannels, writeAuditLog } from './database.js';
import { logger } from './logger.js';
import { handleModerationCommand, moderationCommands } from './moderation.js';
import { syncGuild, syncMember } from './sync.js';
import { registerLogListeners } from './logs.js';
import { handleTicketButton, handleTicketCommand, ticketCommands } from './tickets.js';
import { registerProtection } from './protection.js';
import { startSiteActionWorker } from './site-actions.js';

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Variables manquantes : ${missing.join(', ')}`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const syncCommand = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Synchronise les membres et salons avec le Command Center')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const legacyPanelCommand = new SlashCommandBuilder()
  .setName('panneau')
  .setDescription('Publier le panneau d’ouverture d’une entreprise')
  .addAttachmentOption(option => option.setName('image').setDescription('Image du panneau de l’entreprise').setRequired(true));

const legacyEventCommand = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Publier un panneau pour un événement')
  .addAttachmentOption(option => option.setName('image').setDescription('Image de l’événement').setRequired(true));

const pendingPanels = new Map();
const pendingEvents = new Map();

function legacySettings(guildId, kind) {
  const key = kind === 'event' ? 'EVENT_CHANNEL_ID' : 'PANEL_CHANNEL_ID';
  return process.env[key] || process.env.PANEL_CHANNEL_ID || null;
}

function isLegacyStaff(interaction) {
  const member = interaction.member;
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  const roleId = process.env.STAFF_ROLE_ID || process.env.ADMIN_ROLE_ID;
  return Boolean(roleId && member.roles?.cache?.has(roleId));
}

async function handleLegacyInteraction(interaction) {
  if (interaction.isChatInputCommand() && (interaction.commandName === 'panneau' || interaction.commandName === 'event')) {
    if (!isLegacyStaff(interaction)) return interaction.reply({ content: '❌ Cette commande est réservée au staff.', flags: MessageFlags.Ephemeral });
    const image = interaction.options.getAttachment('image');
    if (!image?.contentType?.startsWith('image/')) return interaction.reply({ content: '❌ Le fichier doit être une image.', flags: MessageFlags.Ephemeral });
    if (image.size > 10 * 1024 * 1024) return interaction.reply({ content: '❌ L’image ne doit pas dépasser 10 Mo.', flags: MessageFlags.Ephemeral });
    const id = interaction.id;
    const target = interaction.commandName === 'event' ? pendingEvents : pendingPanels;
    target.set(id, { imageUrl: image.url, imageName: image.name || 'image.png', creatorId: interaction.user.id, guildId: interaction.guildId });
    setTimeout(() => target.delete(id), 15 * 60 * 1000);
    const prefix = interaction.commandName === 'event' ? 'evenement' : 'panneau';
    const modal = new ModalBuilder().setCustomId(`${prefix}_modal:${id}`).setTitle(interaction.commandName === 'event' ? 'Créer un événement' : 'Créer un panneau');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`${prefix}_title`).setLabel('Titre').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(100).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(`${prefix}_description`).setLabel('Description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false))
    );
    await interaction.showModal(modal);
    return true;
  }
  if (interaction.isModalSubmit() && (interaction.customId.startsWith('panneau_modal:') || interaction.customId.startsWith('evenement_modal:'))) {
    const isEvent = interaction.customId.startsWith('evenement_modal:');
    const id = interaction.customId.split(':')[1];
    const target = isEvent ? pendingEvents : pendingPanels;
    const pending = target.get(id);
    if (!pending || pending.creatorId !== interaction.user.id) return interaction.reply({ content: '❌ Cette demande a expiré ou appartient à un autre utilisateur.', flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channelId = legacySettings(interaction.guildId, isEvent ? 'event' : 'panel');
    const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
    if (!channel?.isTextBased()) return interaction.editReply('❌ Le salon configuré est introuvable.');
    const prefix = isEvent ? 'evenement' : 'panneau';
    const title = interaction.fields.getTextInputValue(`${prefix}_title`).trim();
    const description = interaction.fields.getTextInputValue(`${prefix}_description`).trim();
    const fileName = `${prefix}.${(pending.imageName.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const embed = new EmbedBuilder().setColor(isEvent ? 0xE67E22 : 0x38584A).setTitle(title).setImage(`attachment://${fileName}`).setTimestamp().setFooter({ text: isEvent ? 'Silver Creek RP — Événements' : 'Silver Creek RP — Entreprises' });
    if (description) embed.setDescription(description);
    const customId = isEvent ? `finish_event:${pending.creatorId}` : `close_company:${pending.creatorId}`;
    const button = new ButtonBuilder().setCustomId(customId).setLabel(isEvent ? 'Événement terminé' : 'Entreprise fermée').setStyle(ButtonStyle.Danger);
    const message = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)], files: [{ attachment: pending.imageUrl, name: fileName }] });
    target.delete(id);
    await interaction.editReply(`✅ Publication envoyée dans ${channel}.\n${message.url}`);
    return true;
  }
  if (interaction.isButton() && (interaction.customId.startsWith('close_company:') || interaction.customId.startsWith('finish_event:'))) {
    const creatorId = interaction.customId.split(':')[1];
    if (interaction.user.id !== creatorId && !isLegacyStaff(interaction)) return interaction.reply({ content: '❌ Seul le créateur ou un administrateur peut effectuer cette action.', flags: MessageFlags.Ephemeral });
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => null);
    return true;
  }
  return false;
}

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: [syncCommand.toJSON(), legacyPanelCommand.toJSON(), legacyEventCommand.toJSON(), ...moderationCommands.map((command) => command.toJSON()), ...ticketCommands.map((command) => command.toJSON())] }
  );
}

client.once(Events.ClientReady, async (readyClient) => {
  logger.info(`Connecté en tant que ${readyClient.user.tag}`);
  try {
    await registerCommands();
    const guild = await readyClient.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const fullGuild = await guild.fetch();
    await ensureGuild(fullGuild);
    if (process.env.SYNC_ON_START !== 'false') {
      await syncGuild(fullGuild);
    }
    startSiteActionWorker(readyClient);
  } catch (error) {
    logger.error('Initialisation impossible', { message: error.message });
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const { guildId, memberId } = await syncMember(member);
    await writeAuditLog(guildId, 'member.joined', 'discord_member', memberId, {
      discord_user_id: member.id
    });
    logger.info('Membre ajouté', { user: member.user.tag });
  } catch (error) {
    logger.error('Échec de l’ajout du membre', { userId: member.id, message: error.message });
  }
});

client.on(Events.GuildMemberUpdate, async (_oldMember, newMember) => {
  try {
    await syncMember(newMember);
    logger.debug('Membre mis à jour', { userId: newMember.id });
  } catch (error) {
    logger.error('Échec de mise à jour du membre', { userId: newMember.id, message: error.message });
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const guildId = await ensureGuild(member.guild);
    await markMemberLeft(guildId, member);
    await writeAuditLog(guildId, 'member.left', 'discord_member', member.id, {
      discord_user_id: member.id
    });
    logger.info('Départ enregistré', { userId: member.id });
  } catch (error) {
    logger.error('Échec de l’enregistrement du départ', { userId: member.id, message: error.message });
  }
});

async function refreshChannels(channel) {
  if (!channel.guild || process.env.SYNC_CHANNELS === 'false') return;
  try {
    const guildId = await ensureGuild(channel.guild);
    await channel.guild.channels.fetch();
    await replaceChannels(guildId, channel.guild, channel.guild.members.me);
  } catch (error) {
    logger.error('Échec de synchronisation des salons', { message: error.message });
  }
}

client.on(Events.ChannelCreate, refreshChannels);
client.on(Events.ChannelUpdate, (_oldChannel, newChannel) => refreshChannels(newChannel));
client.on(Events.ChannelDelete, refreshChannels);

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (await handleLegacyInteraction(interaction)) return;
    if (await handleTicketButton(interaction)) return;
    if (!interaction.isChatInputCommand()) return;
    if (await handleTicketCommand(interaction)) return;
    if (await handleModerationCommand(interaction)) return;
    if (interaction.commandName !== 'sync') return;
    await interaction.deferReply({ ephemeral: true });
    const count = await syncGuild(interaction.guild, async (done, total) => {
      await interaction.editReply(`Synchronisation en cours : ${done}/${total} membres…`);
    });
    await interaction.editReply(`✅ Synchronisation terminée : ${count} membres enregistrés.`);
  } catch (error) {
    logger.error('Commande échouée', { command: interaction.commandName, message: error.message });
    const message = `❌ ${error.message}`;
    if (interaction.deferred || interaction.replied) await interaction.editReply(message);
    else await interaction.reply({ content: message, ephemeral: true });
  }
});

registerLogListeners(client);
registerProtection(client);

client.on(Events.Error, (error) => logger.error('Erreur Discord', { message: error.message }));

process.on('unhandledRejection', (error) => {
  logger.error('Promesse rejetée', { message: error?.message ?? String(error) });
});

await client.login(process.env.DISCORD_TOKEN);
