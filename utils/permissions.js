const { PermissionFlagsBits, MessageFlags } = require("discord.js");
const config = require("../config");
const store = require("./store");

function settings(guildId) {
    const saved = store.guild(guildId);
    return {
        panelChannelId: saved.panelChannelId || config.channels.panel,
        eventChannelId: saved.eventChannelId || config.channels.events,
        ticketForumId: saved.ticketForumId || process.env.TICKET_FORUM_ID || null,
        staffRoleId: saved.staffRoleId || config.roles.staff || config.roles.admin,
        autoRoleId: saved.autoRoleId || config.roles.auto,
        logChannelId: saved.logChannelId || process.env.LOG_MODERATION || null
    };
}

function isStaff(member) {
    if (!member) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    const roleId = settings(member.guild.id).staffRoleId;
    return Boolean(roleId && member.roles?.cache?.has(roleId));
}

async function requireStaff(interaction) {
    if (isStaff(interaction.member)) return true;
    await interaction.reply({ content: "❌ Cette commande est réservée au staff.", flags: MessageFlags.Ephemeral });
    return false;
}

module.exports = { settings, isStaff, requireStaff };
