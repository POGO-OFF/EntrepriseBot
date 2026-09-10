import { EmbedBuilder, Events } from 'discord.js';
import { db, ensureGuild } from './database.js';
import { logger } from './logger.js';
import { postBridge } from './site-bridge.js';

const truncate = (value, max = 1000) => String(value ?? 'Indisponible').slice(0, max);

async function saveAndSend(guild, eventType, title, description, data = {}) {
  try {
    const guildId = await ensureGuild(guild);
    await db.from('discord_event_logs').insert({
      guild_id: guildId,
      event_type: eventType,
      actor_discord_id: data.actorId ?? null,
      target_discord_id: data.targetId ?? null,
      discord_channel_id: data.channelId ?? null,
      discord_message_id: data.messageId ?? null,
      summary: truncate(description, 2000),
      event_data: data
    });
    await postBridge('log', { eventType, actorDiscordId: data.actorId, targetDiscordId: data.targetId, channelId: data.channelId, summary: description, data });

    const logChannelId = process.env.GENERAL_LOG_CHANNEL_ID;
    if (!logChannelId) return;
    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder()
      .setColor(0x64748b)
      .setTitle(title)
      .setDescription(truncate(description, 4000))
      .setFooter({ text: eventType })
      .setTimestamp();
    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Échec d’enregistrement d’un log', { eventType, message: error.message });
  }
}

export function registerLogListeners(client) {
  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || message.author?.bot) return;
    return saveAndSend(message.guild, 'message.deleted', 'Message supprimé',
      `**Auteur :** ${message.author ?? 'Inconnu'}\n**Salon :** ${message.channel}\n**Contenu :** ${truncate(message.content)}`,
      { actorId: message.author?.id, channelId: message.channelId, messageId: message.id, content: message.content });
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    return saveAndSend(newMessage.guild, 'message.updated', 'Message modifié',
      `**Auteur :** ${newMessage.author ?? 'Inconnu'}\n**Salon :** ${newMessage.channel}\n**Avant :** ${truncate(oldMessage.content)}\n**Après :** ${truncate(newMessage.content)}`,
      { actorId: newMessage.author?.id, channelId: newMessage.channelId, messageId: newMessage.id, before: oldMessage.content, after: newMessage.content });
  });

  client.on(Events.GuildMemberAdd, (member) => saveAndSend(member.guild, 'member.joined', 'Membre arrivé',
    `${member.user} — **${member.user.tag}**`, { targetId: member.id, accountCreatedAt: member.user.createdAt.toISOString() }));
  client.on(Events.GuildMemberRemove, (member) => saveAndSend(member.guild, 'member.left', 'Membre parti',
    `**${member.user.tag}** (${member.id})`, { targetId: member.id }));

  client.on(Events.GuildMemberUpdate, (before, after) => {
    const added = after.roles.cache.filter((role) => !before.roles.cache.has(role.id));
    const removed = before.roles.cache.filter((role) => !after.roles.cache.has(role.id));
    if (added.size || removed.size) {
      return saveAndSend(after.guild, 'member.roles_updated', 'Rôles modifiés',
        `**Membre :** ${after.user}\n**Ajoutés :** ${added.map((r) => r.name).join(', ') || 'Aucun'}\n**Retirés :** ${removed.map((r) => r.name).join(', ') || 'Aucun'}`,
        { targetId: after.id, added: added.map((r) => r.id), removed: removed.map((r) => r.id) });
    }
    if (before.nickname !== after.nickname) {
      return saveAndSend(after.guild, 'member.nickname_updated', 'Surnom modifié',
        `**Membre :** ${after.user}\n**Avant :** ${before.nickname ?? 'Aucun'}\n**Après :** ${after.nickname ?? 'Aucun'}`,
        { targetId: after.id, before: before.nickname, after: after.nickname });
    }
  });

  client.on(Events.VoiceStateUpdate, (before, after) => {
    if (before.channelId === after.channelId) return;
    const description = !before.channelId
      ? `${after.member} a rejoint ${after.channel}.`
      : !after.channelId
        ? `${before.member} a quitté ${before.channel}.`
        : `${after.member} est passé de ${before.channel} à ${after.channel}.`;
    return saveAndSend(after.guild, 'voice.updated', 'Activité vocale', description,
      { targetId: after.id, beforeChannelId: before.channelId, afterChannelId: after.channelId });
  });

  client.on(Events.ChannelCreate, (channel) => channel.guild && saveAndSend(channel.guild, 'channel.created', 'Salon créé',
    `**${channel.name}** (${channel.id})`, { channelId: channel.id }));
  client.on(Events.ChannelDelete, (channel) => channel.guild && saveAndSend(channel.guild, 'channel.deleted', 'Salon supprimé',
    `**${channel.name}** (${channel.id})`, { channelId: channel.id }));
  client.on(Events.GuildBanAdd, (ban) => saveAndSend(ban.guild, 'member.banned', 'Membre banni',
    `**${ban.user.tag}** (${ban.user.id})`, { targetId: ban.user.id, reason: ban.reason }));
  client.on(Events.GuildBanRemove, (ban) => saveAndSend(ban.guild, 'member.unbanned', 'Membre débanni',
    `**${ban.user.tag}** (${ban.user.id})`, { targetId: ban.user.id }));
}
