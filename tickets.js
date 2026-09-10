import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import { db, ensureGuild } from './database.js';
import { postBridge } from './site-bridge.js';

export const ticketCommands = [
  new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Publier le panneau d’ouverture des tickets')
    .addChannelOption((option) => option
      .setName('salon')
      .setDescription('Salon dans lequel publier le panneau')
      .addChannelTypes(ChannelType.GuildText))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const ticketButtons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('ticket_claim').setLabel('Prendre en charge').setEmoji('🙋').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger)
);

const ticketTypes = {
  support: { label: 'Assistance générale', emoji: '🛠️', description: 'Question ou problème sur le serveur' },
  moderation: { label: 'Signaler un membre', emoji: '🛡️', description: 'Harcèlement, comportement ou sanction' },
  impersonation: { label: 'Faux profil / usurpation', emoji: '🚨', description: 'Compte utilisant une identité ou des photos' },
  partnership: { label: 'Entreprise / partenariat', emoji: '🤝', description: 'Demande liée à une entreprise ou un projet' }
};

const ticketTypeMenu = () => new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId('ticket_type')
    .setPlaceholder('Choisis le motif de ta demande…')
    .addOptions(Object.entries(ticketTypes).map(([value, item]) => ({ value, label: item.label, description: item.description, emoji: item.emoji })))
);

export async function handleTicketCommand(interaction) {
  if (interaction.commandName !== 'ticket-panel') return false;
  const channel = interaction.options.getChannel('salon') ?? interaction.channel;
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🎫 Centre d’assistance Silver Creek')
    .setDescription('Sélectionne le motif de ta demande. Un salon privé sera créé uniquement pour toi et l’équipe concernée.')
    .addFields(
      { name: 'Avant de commencer', value: 'Décris les faits dans l’ordre, joins les captures utiles et ne crée pas plusieurs tickets pour le même problème.' },
      { name: 'Confidentialité', value: 'Ne publie jamais de mot de passe, token ou document d’identité.' }
    ).setFooter({ text: 'Un ticket par personne • Respecte l’équipe de modération' });
  await channel.send({ embeds: [embed], components: [ticketTypeMenu()] });
  await interaction.reply({ content: `✅ Panneau publié dans ${channel}.`, ephemeral: true });
  return true;
}

async function openTicket(interaction, type = 'support') {
  await interaction.deferReply({ ephemeral: true });
  const guildId = await ensureGuild(interaction.guild);
  const { data: existing } = await db.from('discord_tickets').select('discord_channel_id')
    .eq('guild_id', guildId).eq('opener_discord_id', interaction.user.id)
    .in('status', ['open', 'claimed']).maybeSingle();
  if (existing) {
    await interaction.editReply(`Tu as déjà un ticket ouvert : <#${existing.discord_channel_id}>`);
    return;
  }

  const supportRoleId = process.env.TICKET_SUPPORT_ROLE_ID;
  const permissionOverwrites = [
    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
    { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory] }
  ];
  if (supportRoleId) permissionOverwrites.push({ id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 15) || interaction.user.id;
  const ticketType = ticketTypes[type] ? type : 'support';
  const channel = await interaction.guild.channels.create({
    name: `${ticketType}-${safeName}`,
    type: ChannelType.GuildText,
    parent: process.env.TICKET_CATEGORY_ID || null,
    topic: `Ticket ${ticketType} | ${interaction.user.tag} | ${interaction.user.id}`,
    permissionOverwrites
  });

  await db.from('discord_tickets').insert({
    guild_id: guildId,
    discord_channel_id: channel.id,
    opener_discord_id: interaction.user.id,
    opener_name: interaction.user.tag,
    ticket_type: ticketType
  });
  await postBridge('ticket', { ticket: { channelId: channel.id, openerDiscordId: interaction.user.id, openerName: interaction.user.tag, status: 'open', createdAt: new Date().toISOString() } });
  const typeInfo = ticketTypes[ticketType];
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`${typeInfo.emoji} ${typeInfo.label}`)
    .setDescription(`Bienvenue ${interaction.user}. Décris ta demande ci-dessous ; l’équipe pourra te répondre dans ce salon privé.`)
    .addFields(
      { name: 'Demandeur', value: `${interaction.user} \`${interaction.user.id}\``, inline: true },
      { name: 'Statut', value: '🟡 En attente', inline: true },
      { name: 'Consignes', value: 'Reste courtois. Pour fermer le ticket, utilise le bouton 🔒. La conversation sera archivée.' }
    ).setTimestamp().setFooter({ text: 'Silver Creek • Ticket ouvert' });
  await channel.send({ content: supportRoleId ? `<@&${supportRoleId}>` : undefined, embeds: [embed], components: [ticketButtons()] });
  await channel.send({ content: '📝 **Premier message conseillé :** explique ce qui s’est passé, quand, avec qui et joins les liens ou captures utiles.' });
  await interaction.editReply(`✅ Ton ticket est ouvert : ${channel}`);
}

async function claimTicket(interaction) {
  const supportRoleId = process.env.TICKET_SUPPORT_ROLE_ID;
  if (supportRoleId && !interaction.member.roles.cache.has(supportRoleId) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: '❌ Cette action est réservée au staff.', ephemeral: true });
    return;
  }
  const { data, error } = await db.from('discord_tickets').update({
    status: 'claimed', claimed_by_discord_id: interaction.user.id,
    claimed_by_name: interaction.user.tag, claimed_at: new Date().toISOString()
  }).eq('discord_channel_id', interaction.channelId).in('status', ['open', 'claimed']).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Ce salon n’est pas un ticket ouvert.');
  await postBridge('ticket', { ticket: { channelId: interaction.channelId, openerDiscordId: interaction.channel.topic?.split('|')[1]?.trim() || 'unknown', openerName: interaction.channel.topic?.split('|')[0]?.replace('Ticket de ', '') || 'Inconnu', claimedBy: interaction.user.tag, status: 'claimed', createdAt: interaction.channel.createdAt.toISOString() } });
  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription(`🙋 Ticket pris en charge par **${interaction.user.tag}**.`)] });
}

async function fetchTranscript(channel) {
  const collected = [];
  let before;
  while (collected.length < 500) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;
    collected.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return collected.reverse().map((message) => {
    const attachments = [...message.attachments.values()].map((item) => item.url).join(' ');
    return `[${message.createdAt.toISOString()}] ${message.author.tag}: ${message.content || ''}${attachments ? ` ${attachments}` : ''}`;
  }).join('\n');
}

async function closeTicket(interaction) {
  const transcript = await fetchTranscript(interaction.channel);
  const { data: ticket, error } = await db.from('discord_tickets').update({
    status: 'closed', transcript_text: transcript, closed_at: new Date().toISOString(),
    closed_by_discord_id: interaction.user.id, close_reason: 'Fermé depuis Discord'
  }).eq('discord_channel_id', interaction.channelId).neq('status', 'closed').select('*').maybeSingle();
  if (error) throw error;
  if (!ticket) throw new Error('Ce ticket est déjà fermé ou introuvable.');
  await postBridge('ticket', { ticket: { channelId: interaction.channelId, openerDiscordId: ticket.opener_discord_id, openerName: ticket.opener_name, claimedBy: ticket.claimed_by_name, status: 'closed', transcript, createdAt: ticket.created_at, closedAt: new Date().toISOString() } });

  const logChannel = process.env.TICKET_LOG_CHANNEL_ID
    ? await interaction.guild.channels.fetch(process.env.TICKET_LOG_CHANNEL_ID).catch(() => null)
    : null;
  if (logChannel?.isTextBased()) {
    const file = new AttachmentBuilder(Buffer.from(transcript || 'Aucun message.', 'utf8'), { name: `ticket-${interaction.channelId}.txt` });
    await logChannel.send({ content: `🔒 Ticket de <@${ticket.opener_discord_id}> fermé par ${interaction.user}.`, files: [file] });
  }
  await interaction.update({ content: `🔒 Ticket fermé par ${interaction.user}. Transcription envoyée aux archives. Suppression dans 5 secondes…`, embeds: [], components: [] });
  setTimeout(() => interaction.channel.delete('Ticket fermé et transcript sauvegardé').catch(() => {}), 5000);
}

export async function handleTicketButton(interaction) {
  if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_type') {
    await openTicket(interaction, interaction.values[0]);
    return true;
  }
  if (!interaction.isButton() || !interaction.customId.startsWith('ticket_')) return false;
  if (interaction.customId === 'ticket_open') await openTicket(interaction);
  if (interaction.customId === 'ticket_claim') await claimTicket(interaction);
  if (interaction.customId === 'ticket_close') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Confirmer la fermeture').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ content: 'Veux-tu vraiment fermer ce ticket ? La transcription sera sauvegardée.', components: [row], ephemeral: true });
  }
  if (interaction.customId === 'ticket_close_confirm') await closeTicket(interaction);
  if (interaction.customId === 'ticket_close_cancel') await interaction.update({ content: 'Fermeture annulée.', components: [] });
  return true;
}
