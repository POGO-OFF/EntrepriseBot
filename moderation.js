import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import {
  createSanction,
  db,
  ensureGuild,
  findMemberId,
  listMemberSanctions,
  revokeLatestSanction,
  setMemberStatus,
  writeAuditLog
} from './database.js';
import { syncMember } from './sync.js';
import { postBridge } from './site-bridge.js';

const reasonOption = (option) => option
  .setName('raison')
  .setDescription('Raison de la sanction')
  .setRequired(true)
  .setMaxLength(512);

const userOption = (option) => option
  .setName('membre')
  .setDescription('Membre concerné')
  .setRequired(true);

const evidenceAttachment = (option) => option.setName('preuve').setDescription('Capture, image ou fichier servant de preuve');
const evidenceLink = (option) => option.setName('lien_preuve').setDescription('Lien vers un message, une vidéo ou une preuve').setMaxLength(1000);

export const moderationCommands = [
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Ajouter un avertissement')
    .addUserOption(userOption)
    .addStringOption(reasonOption)
    .addAttachmentOption(evidenceAttachment)
    .addStringOption(evidenceLink)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('note')
    .setDescription('Ajouter une note interne au dossier du membre')
    .addUserOption(userOption)
    .addStringOption(reasonOption)
    .addAttachmentOption(evidenceAttachment)
    .addStringOption(evidenceLink)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Mettre temporairement un membre en sourdine')
    .addUserOption(userOption)
    .addIntegerOption((option) => option
      .setName('minutes')
      .setDescription('Durée entre 1 minute et 28 jours')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(40320))
    .addStringOption(reasonOption)
    .addAttachmentOption(evidenceAttachment)
    .addStringOption(evidenceLink)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Retirer le timeout d’un membre')
    .addUserOption(userOption)
    .addStringOption(reasonOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .addUserOption(userOption)
    .addStringOption(reasonOption)
    .addAttachmentOption(evidenceAttachment)
    .addStringOption(evidenceLink)
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption(userOption)
    .addStringOption(reasonOption)
    .addIntegerOption((option) => option
      .setName('supprimer_messages')
      .setDescription('Nombre de jours de messages à supprimer (0 à 7)')
      .setMinValue(0)
      .setMaxValue(7))
    .addAttachmentOption(evidenceAttachment)
    .addStringOption(evidenceLink)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un utilisateur avec son identifiant Discord')
    .addStringOption((option) => option
      .setName('identifiant')
      .setDescription('Identifiant Discord de l’utilisateur')
      .setRequired(true))
    .addStringOption(reasonOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder()
    .setName('sanctions')
    .setDescription('Consulter les dernières sanctions d’un membre')
    .addUserOption(userOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
];

function successEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function getTarget(interaction) {
  const user = interaction.options.getUser('membre', true);
  const member = await interaction.guild.members.fetch(user.id);
  if (user.id === interaction.user.id) throw new Error('Tu ne peux pas te sanctionner toi-même.');
  if (user.id === interaction.guild.ownerId) throw new Error('Le propriétaire du serveur ne peut pas être sanctionné.');
  return { user, member };
}

async function prepareMember(interaction) {
  const { user, member } = await getTarget(interaction);
  const { guildId, memberId } = await syncMember(member);
  return { user, member, guildId, memberId };
}

async function record(interaction, target, type, reason, options = {}) {
  const attachment = interaction.options.getAttachment('preuve');
  const evidenceLinkValue = interaction.options.getString('lien_preuve');
  const evidenceUrls = [attachment?.url, evidenceLinkValue].filter(Boolean);
  const sanctionId = await createSanction({
    guildId: target.guildId,
    memberId: target.memberId,
    type,
    reason,
    moderator: interaction.user,
    evidenceUrls,
    ...options
  });
  await writeAuditLog(target.guildId, `moderation.${type}`, 'sanction', sanctionId, {
    target_discord_id: target.user.id,
    reason
  });
  await postBridge('sanction', { targetDiscordId: target.user.id, type, reason, moderator: interaction.user.tag, status: options.status ?? 'active' });
  return sanctionId;
}

async function applyProgressivePenalty(interaction, target) {
  const { data: config } = await db.from('guild_moderation_config').select('*').eq('guild_id', target.guildId).maybeSingle();
  if (config?.progressive_enabled === false) return null;
  const timeoutThreshold = config?.warning_timeout_threshold ?? 2;
  const banThreshold = config?.warning_ban_threshold ?? 4;
  const timeoutMinutes = config?.timeout_minutes ?? 60;
  const { count, error } = await db.from('sanctions').select('id', { count: 'exact', head: true })
    .eq('guild_id', target.guildId).eq('member_id', target.memberId)
    .eq('sanction_type', 'warning').eq('status', 'active');
  if (error) throw error;

  if (count >= banThreshold && target.member.bannable) {
    const reason = `Sanction progressive : ${count} avertissements actifs`;
    await target.member.ban({ reason });
    await createSanction({ guildId: target.guildId, memberId: target.memberId, type: 'ban', reason,
      moderator: interaction.client.user, automatic: true });
    await setMemberStatus(target.guildId, target.user.id, 'banned');
    return ` Bannissement automatique appliqué après ${count} avertissements.`;
  }
  if (count >= timeoutThreshold && target.member.moderatable) {
    const reason = `Sanction progressive : ${count} avertissements actifs`;
    const expiresAt = new Date(Date.now() + timeoutMinutes * 60_000);
    await target.member.timeout(timeoutMinutes * 60_000, reason);
    await createSanction({ guildId: target.guildId, memberId: target.memberId, type: 'timeout', reason,
      moderator: interaction.client.user, expiresAt: expiresAt.toISOString(), automatic: true });
    return ` Timeout automatique de ${timeoutMinutes} minutes appliqué.`;
  }
  return '';
}

export async function handleModerationCommand(interaction) {
  if (!moderationCommands.some((command) => command.name === interaction.commandName)) return false;
  await interaction.deferReply({ ephemeral: true });

  if (interaction.commandName === 'unban') {
    const userId = interaction.options.getString('identifiant', true).trim();
    const reason = interaction.options.getString('raison', true);
    if (!/^\d{17,20}$/.test(userId)) throw new Error('L’identifiant Discord n’est pas valide.');
    const guildId = await ensureGuild(interaction.guild);
    const memberId = await findMemberId(guildId, userId);
    await interaction.guild.members.unban(userId, `${reason} — ${interaction.user.tag}`);
    if (memberId) {
      await revokeLatestSanction(guildId, memberId, 'ban', interaction.user, reason);
      await setMemberStatus(guildId, userId, 'left');
    }
    await writeAuditLog(guildId, 'moderation.unban', 'discord_member', memberId ?? userId, {
      target_discord_id: userId,
      reason
    });
    await interaction.editReply({ embeds: [successEmbed('Utilisateur débanni', `<@${userId}> a été débanni.\n**Raison :** ${reason}`)] });
    return true;
  }

  const target = await prepareMember(interaction);
  const reason = interaction.options.getString('raison');

  if (interaction.commandName === 'sanctions') {
    const sanctions = await listMemberSanctions(target.guildId, target.memberId);
    const description = sanctions.length
      ? sanctions.map((item, index) => {
          const date = Math.floor(new Date(item.starts_at).getTime() / 1000);
          return `**${index + 1}. ${item.sanction_type.toUpperCase()}** — ${item.status}\n${item.reason}\n<t:${date}:R> · ${item.moderator_name ?? 'Modérateur inconnu'}`;
        }).join('\n\n').slice(0, 4000)
      : 'Aucune sanction enregistrée.';
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Sanctions de ${target.user.tag}`)
      .setThumbnail(target.user.displayAvatarURL())
      .setDescription(description)
      .setFooter({ text: `${sanctions.length} résultat(s) affiché(s)` });
    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  if (interaction.commandName === 'warn') {
    await record(interaction, target, 'warning', reason);
    const progressiveResult = await applyProgressivePenalty(interaction, target);
    await interaction.editReply({ embeds: [successEmbed('Avertissement enregistré', `${target.user} a reçu un avertissement.\n**Raison :** ${reason}${progressiveResult ?? ''}`)] });
  }

  if (interaction.commandName === 'note') {
    await record(interaction, target, 'note', reason, { status: 'completed' });
    await interaction.editReply({ embeds: [successEmbed('Note enregistrée', `La note interne concernant ${target.user} a été ajoutée.`)] });
  }

  if (interaction.commandName === 'timeout') {
    if (!target.member.moderatable) throw new Error('Je ne peux pas modérer ce membre. Vérifie la hiérarchie de mes rôles.');
    const minutes = interaction.options.getInteger('minutes', true);
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    await target.member.timeout(minutes * 60_000, `${reason} — ${interaction.user.tag}`);
    await record(interaction, target, 'timeout', reason, { expiresAt: expiresAt.toISOString() });
    await interaction.editReply({ embeds: [successEmbed('Timeout appliqué', `${target.user} est en timeout pendant **${minutes} minute(s)**.\n**Raison :** ${reason}`)] });
  }

  if (interaction.commandName === 'untimeout') {
    if (!target.member.moderatable) throw new Error('Je ne peux pas modérer ce membre. Vérifie la hiérarchie de mes rôles.');
    await target.member.timeout(null, `${reason} — ${interaction.user.tag}`);
    await revokeLatestSanction(target.guildId, target.memberId, 'timeout', interaction.user, reason);
    await interaction.editReply({ embeds: [successEmbed('Timeout retiré', `Le timeout de ${target.user} a été retiré.\n**Raison :** ${reason}`)] });
  }

  if (interaction.commandName === 'kick') {
    if (!target.member.kickable) throw new Error('Je ne peux pas expulser ce membre. Vérifie la hiérarchie de mes rôles.');
    await record(interaction, target, 'kick', reason, { status: 'completed' });
    await target.member.kick(`${reason} — ${interaction.user.tag}`);
    await setMemberStatus(target.guildId, target.user.id, 'left');
    await interaction.editReply({ embeds: [successEmbed('Membre expulsé', `**${target.user.tag}** a été expulsé.\n**Raison :** ${reason}`)] });
  }

  if (interaction.commandName === 'ban') {
    if (!target.member.bannable) throw new Error('Je ne peux pas bannir ce membre. Vérifie la hiérarchie de mes rôles.');
    const days = interaction.options.getInteger('supprimer_messages') ?? 0;
    await record(interaction, target, 'ban', reason);
    await target.member.ban({ deleteMessageSeconds: days * 86_400, reason: `${reason} — ${interaction.user.tag}` });
    await setMemberStatus(target.guildId, target.user.id, 'banned');
    await interaction.editReply({ embeds: [successEmbed('Membre banni', `**${target.user.tag}** a été banni.\n**Raison :** ${reason}`)] });
  }

  return true;
}
