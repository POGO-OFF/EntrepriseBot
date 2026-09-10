import { Events, PermissionFlagsBits } from 'discord.js';
import { createSanction, ensureGuild } from './database.js';
import { syncMember } from './sync.js';
import { logger } from './logger.js';

const activity = new Map();
const recentJoins = new Map();
const raidUntil = new Map();
const invitePattern = /(discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;
const linkPattern = /https?:\/\/\S+/i;

const numberEnv = (key, fallback) => Number(process.env[key] ?? fallback);

async function punish(message, reason, minutes) {
  await message.delete().catch(() => {});
  if (message.member?.moderatable) await message.member.timeout(minutes * 60_000, reason).catch(() => {});
  const { guildId, memberId } = await syncMember(message.member);
  await createSanction({
    guildId, memberId, type: 'timeout', reason,
    moderator: message.client.user,
    expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
    automatic: true
  });
  await message.channel.send({ content: `${message.author}, protection automatique : **${reason}**`, allowedMentions: { users: [message.author.id] } })
    .then((sent) => setTimeout(() => sent.delete().catch(() => {}), 8000)).catch(() => {});
}

export function registerProtection(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot || message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;
    try {
      const mentions = message.mentions.users.size + message.mentions.roles.size;
      if (mentions >= numberEnv('MAX_MENTIONS', 5)) return punish(message, 'Mentions abusives', numberEnv('ANTI_SPAM_TIMEOUT_MINUTES', 10));
      if (process.env.ANTI_INVITES_ENABLED !== 'false' && invitePattern.test(message.content)) return punish(message, 'Invitation Discord interdite', numberEnv('ANTI_SPAM_TIMEOUT_MINUTES', 10));
      if (process.env.ANTI_LINKS_ENABLED === 'true' && linkPattern.test(message.content)) return punish(message, 'Lien interdit', numberEnv('ANTI_SPAM_TIMEOUT_MINUTES', 10));
      if (process.env.ANTI_SPAM_ENABLED === 'false') return;

      const now = Date.now();
      const key = `${message.guildId}:${message.author.id}`;
      const windowMs = numberEnv('ANTI_SPAM_WINDOW_SECONDS', 8) * 1000;
      const entries = (activity.get(key) ?? []).filter((time) => now - time < windowMs);
      entries.push(now);
      activity.set(key, entries);
      if (entries.length >= numberEnv('ANTI_SPAM_MAX_MESSAGES', 6)) {
        activity.delete(key);
        await punish(message, 'Spam détecté', numberEnv('ANTI_SPAM_TIMEOUT_MINUTES', 10));
      }
    } catch (error) {
      logger.error('Protection automatique échouée', { message: error.message });
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const now = Date.now();
    const windowMs = numberEnv('RAID_WINDOW_SECONDS', 30) * 1000;
    const joins = (recentJoins.get(member.guild.id) ?? []).filter((time) => now - time < windowMs);
    joins.push(now);
    recentJoins.set(member.guild.id, joins);
    if (joins.length >= numberEnv('RAID_JOIN_LIMIT', 8)) {
      raidUntil.set(member.guild.id, now + numberEnv('RAID_MODE_MINUTES', 10) * 60_000);
      logger.warn('Mode anti-raid activé', { guildId: member.guild.id });
    }

    const accountAgeDays = (now - member.user.createdTimestamp) / 86_400_000;
    const raidActive = (raidUntil.get(member.guild.id) ?? 0) > now;
    if (accountAgeDays < numberEnv('MIN_ACCOUNT_AGE_DAYS', 3) || raidActive) {
      const roleId = process.env.RAID_QUARANTINE_ROLE_ID;
      if (roleId) await member.roles.add(roleId, raidActive ? 'Protection anti-raid' : 'Compte récent').catch(() => {});
      const { guildId, memberId } = await syncMember(member);
      await createSanction({
        guildId, memberId, type: 'note',
        reason: raidActive ? 'Compte placé en quarantaine pendant un raid' : `Compte âgé de ${accountAgeDays.toFixed(1)} jour(s)`,
        moderator: client.user, status: 'completed', automatic: true
      });
    }
  });
}
