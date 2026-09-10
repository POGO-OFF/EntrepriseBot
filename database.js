import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont obligatoires.');
}

export const db = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function ensureGuild(guild) {
  const payload = {
    discord_guild_id: guild.id,
    name: guild.name,
    icon_url: guild.iconURL({ extension: 'png', size: 256 }),
    is_active: true
  };

  const { data, error } = await db
    .from('discord_guilds')
    .upsert(payload, { onConflict: 'discord_guild_id' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function upsertMember(guildId, member, status = 'active') {
  const user = member.user;
  const payload = {
    guild_id: guildId,
    discord_user_id: user.id,
    username: user.username,
    global_name: user.globalName,
    display_name: member.displayName,
    avatar_url: member.displayAvatarURL({ extension: 'png', size: 256 }),
    nickname: member.nickname,
    status,
    joined_at: member.joinedAt?.toISOString() ?? null,
    left_at: status === 'left' ? new Date().toISOString() : null,
    metadata: {
      bot: user.bot,
      pending: member.pending ?? false,
      communication_disabled_until: member.communicationDisabledUntil?.toISOString() ?? null
    }
  };

  const { data, error } = await db
    .from('discord_members')
    .upsert(payload, { onConflict: 'guild_id,discord_user_id' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function markMemberLeft(guildId, member) {
  const { error } = await db
    .from('discord_members')
    .update({ status: 'left', left_at: new Date().toISOString() })
    .eq('guild_id', guildId)
    .eq('discord_user_id', member.id);

  if (error) throw error;
}

export async function replaceMemberRoles(memberId, member) {
  const { error: deleteError } = await db
    .from('member_roles')
    .delete()
    .eq('member_id', memberId);
  if (deleteError) throw deleteError;

  const roles = [...member.roles.cache.values()]
    .filter((role) => role.id !== member.guild.id)
    .map((role) => ({
      member_id: memberId,
      discord_role_id: role.id,
      role_name: role.name,
      role_color: role.hexColor,
      position: role.position,
      synced_at: new Date().toISOString()
    }));

  if (!roles.length) return;
  const { error } = await db.from('member_roles').insert(roles);
  if (error) throw error;
}

export async function replaceChannels(guildId, guild, botMember) {
  const { error: deleteError } = await db
    .from('discord_channels')
    .delete()
    .eq('guild_id', guildId);
  if (deleteError) throw deleteError;

  const channels = [...guild.channels.cache.values()].map((channel) => ({
    guild_id: guildId,
    discord_channel_id: channel.id,
    name: channel.name,
    channel_type: channel.type,
    category_id: channel.parentId,
    category_name: channel.parent?.name ?? null,
    position: channel.rawPosition ?? 0,
    can_bot_send: channel.isTextBased()
      ? channel.permissionsFor(botMember)?.has(['ViewChannel', 'SendMessages']) ?? false
      : false,
    synced_at: new Date().toISOString()
  }));

  if (!channels.length) return;
  const { error } = await db.from('discord_channels').insert(channels);
  if (error) throw error;
}

export async function writeAuditLog(guildId, action, entityType, entityId, newData = null) {
  const { error } = await db.from('audit_logs').insert({
    guild_id: guildId,
    actor_discord_id: null,
    actor_name: 'Discord Bot',
    action,
    entity_type: entityType,
    entity_id: entityId,
    new_data: newData
  });
  if (error) throw error;
}

export async function setMemberStatus(guildId, discordUserId, status) {
  const payload = { status };
  if (status === 'left' || status === 'banned') payload.left_at = new Date().toISOString();
  if (status === 'active') payload.left_at = null;

  const { error } = await db
    .from('discord_members')
    .update(payload)
    .eq('guild_id', guildId)
    .eq('discord_user_id', discordUserId);
  if (error) throw error;
}

export async function findMemberId(guildId, discordUserId) {
  const { data, error } = await db
    .from('discord_members')
    .select('id')
    .eq('guild_id', guildId)
    .eq('discord_user_id', discordUserId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createSanction({
  guildId,
  memberId,
  type,
  reason,
  moderator,
  expiresAt = null,
  status = 'active',
  evidenceUrls = [],
  automatic = false
}) {
  const { data, error } = await db
    .from('sanctions')
    .insert({
      guild_id: guildId,
      member_id: memberId,
      sanction_type: type,
      title: type === 'note' ? 'Note interne' : null,
      reason,
      moderator_discord_id: moderator.id,
      moderator_name: moderator.tag ?? moderator.username,
      expires_at: expiresAt,
      status,
      evidence_urls: evidenceUrls,
      automatic
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function listMemberSanctions(guildId, memberId, limit = 10) {
  const { data, error } = await db
    .from('sanctions')
    .select('id,sanction_type,reason,status,moderator_name,starts_at,expires_at')
    .eq('guild_id', guildId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function revokeLatestSanction(guildId, memberId, type, moderator, reason) {
  const { data, error } = await db
    .from('sanctions')
    .select('id')
    .eq('guild_id', guildId)
    .eq('member_id', memberId)
    .eq('sanction_type', type)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;

  const { error: updateError } = await db
    .from('sanctions')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by_discord_id: moderator.id,
      revoke_reason: reason
    })
    .eq('id', data.id);
  if (updateError) throw updateError;
  return true;
}
