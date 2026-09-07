const { Events } = require("discord.js");
const { settings } = require("../utils/permissions");

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const roleId = settings(member.guild.id).autoRoleId;
        if (!roleId) return;
        const role = await member.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return console.warn(`⚠️ Rôle automatique introuvable : ${roleId}`);
        if (!role.editable) return console.warn("⚠️ Le rôle automatique est placé au-dessus du rôle du bot.");
        await member.roles.add(role, "Rôle automatique à l'arrivée").catch((error) => console.error("❌ Auto-rôle :", error));
    }
};
