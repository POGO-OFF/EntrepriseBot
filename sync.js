import {
  ensureGuild,
  replaceChannels,
  replaceMemberRoles,
  upsertMember,
  writeAuditLog
} from './database.js';
import { logger } from './logger.js';

export async function syncMember(member) {
  const guildId = await ensureGuild(member.guild);
  const memberId = await upsertMember(guildId, member);
  await replaceMemberRoles(memberId, member);
  return { guildId, memberId };
}

export async function syncGuild(guild, onProgress = () => {}) {
  const guildId = await ensureGuild(guild);
  const members = await guild.members.fetch();
  let completed = 0;

  for (const member of members.values()) {
    const memberId = await upsertMember(guildId, member);
    await replaceMemberRoles(memberId, member);
    completed += 1;
    if (completed % 25 === 0 || completed === members.size) {
      onProgress(completed, members.size);
    }
  }

  if (process.env.SYNC_CHANNELS !== 'false') {
    await guild.channels.fetch();
    await replaceChannels(guildId, guild, guild.members.me);
  }

  await writeAuditLog(guildId, 'guild.sync.completed', 'discord_guild', guild.id, {
    member_count: completed
  });
  logger.info('Synchronisation terminée', { guild: guild.name, members: completed });
  return completed;
}
