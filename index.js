import 'dotenv/config';
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
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

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
    { body: [syncCommand.toJSON(), ...moderationCommands.map((command) => command.toJSON()), ...ticketCommands.map((command) => command.toJSON())] }
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
