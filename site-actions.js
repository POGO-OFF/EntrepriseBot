import { EmbedBuilder } from 'discord.js';
import { createSanction, db, ensureGuild, findMemberId, setMemberStatus } from './database.js';
import { syncMember } from './sync.js';
import { logger } from './logger.js';
import { bridgeEnabled, bridgeRequest, postBridge } from './site-bridge.js';

let polling = false;

async function executeAction(client, action) {
  let guildRowId = action.guild_id;
  let guild;
  if (guildRowId) {
    const { data: guildRow, error } = await db.from('discord_guilds').select('discord_guild_id').eq('id', guildRowId).single();
    if (error) throw error;
    guild = await client.guilds.fetch(guildRow.discord_guild_id);
  } else {
    guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    guildRowId = await ensureGuild(guild);
  }
  const payload = action.payload ?? {};
  const targetDiscordId = action.target_discord_id ?? action.targetDiscordId;
  const channelId = action.discord_channel_id ?? action.channelId;
  const requestedBy = action.requested_by_discord_id ?? action.requestedBy ?? 'Command Center';

  if (action.action_type === 'send_embed') {
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) throw new Error('Salon introuvable ou incompatible.');
    const embed = new EmbedBuilder(payload.embed ?? {});
    const message = await channel.send({ content: payload.content || undefined, embeds: [embed] });
    return { discord_message_id: message.id, discord_channel_id: channel.id };
  }

  if (action.action_type === 'unban') {
    await guild.members.unban(targetDiscordId, payload.reason || 'Action depuis le Command Center');
    const memberId = await findMemberId(guildRowId, targetDiscordId);
    if (memberId) await setMemberStatus(guildRowId, targetDiscordId, 'left');
    return { target_discord_id: targetDiscordId };
  }

  const member = await guild.members.fetch(targetDiscordId);
  const { guildId, memberId } = await syncMember(member);
  const reason = payload.reason || 'Action depuis le Command Center';
  const moderator = { id: requestedBy, username: 'Command Center' };
  let sanctionType = action.action_type;
  let status = 'active';
  let expiresAt = null;

  if (action.action_type === 'warn') sanctionType = 'warning';
  if (action.action_type === 'timeout') {
    const minutes = Math.min(Math.max(Number(payload.minutes || 10), 1), 40320);
    await member.timeout(minutes * 60_000, reason);
    expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  }
  if (action.action_type === 'kick') {
    if (!member.kickable) throw new Error('Le bot ne peut pas expulser ce membre.');
    status = 'completed';
    await member.kick(reason);
    await setMemberStatus(guildId, member.id, 'left');
  }
  if (action.action_type === 'ban') {
    if (!member.bannable) throw new Error('Le bot ne peut pas bannir ce membre.');
    await member.ban({ reason, deleteMessageSeconds: Math.min(Number(payload.delete_message_days || 0), 7) * 86400 });
    await setMemberStatus(guildId, member.id, 'banned');
  }

  const sanctionId = await createSanction({
    guildId, memberId, type: sanctionType, reason, moderator, status, expiresAt,
    evidenceUrls: Array.isArray(payload.evidence_urls) ? payload.evidence_urls : []
  });
  return { sanction_id: sanctionId, target_discord_id: member.id };
}

async function poll(client) {
  if (polling) return;
  polling = true;
  try {
    let actions;
    if (bridgeEnabled()) {
      const response = await bridgeRequest('/api/bot/bridge', { method: 'GET' });
      actions = response.actions ?? [];
    } else {
      const result = await db.from('bot_action_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(10);
      if (result.error) throw result.error;
      actions = result.data;
    }
    for (const action of actions) {
      if (!bridgeEnabled()) {
        const { data: claimed } = await db.from('bot_action_queue').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', action.id).eq('status', 'pending').select('id').maybeSingle();
        if (!claimed) continue;
      }
      try {
        const result = await executeAction(client, action);
        if (bridgeEnabled()) await postBridge('action_result', { actionId: action.id, ok: true, result });
        else await db.from('bot_action_queue').update({ status: 'completed', result, completed_at: new Date().toISOString() }).eq('id', action.id);
      } catch (actionError) {
        if (bridgeEnabled()) await postBridge('action_result', { actionId: action.id, ok: false, error: actionError.message });
        else await db.from('bot_action_queue').update({ status: 'failed', error_message: actionError.message, completed_at: new Date().toISOString() }).eq('id', action.id);
      }
    }
  } catch (error) {
    logger.error('Lecture des actions du site impossible', { message: error.message });
  } finally {
    polling = false;
  }
}

export function startSiteActionWorker(client) {
  const interval = Math.max(Number(process.env.ACTION_POLL_INTERVAL_MS || 5000), 2000);
  poll(client);
  setInterval(() => poll(client), interval);
}
