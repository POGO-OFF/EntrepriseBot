const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
module.exports = {
    data: new SlashCommandBuilder().setName("ban").setDescription("Bannir un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Motif").setRequired(true))
        .addIntegerOption((o) => o.setName("supprimer-messages").setDescription("Heures de messages à supprimer").setMinValue(0).setMaxValue(168)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const user = interaction.options.getUser("membre");
        const member = interaction.options.getMember("membre");
        const reason = interaction.options.getString("raison");
        const hours = interaction.options.getInteger("supprimer-messages") || 0;
        if (member && !member.bannable) return interaction.reply({ content: "❌ Je ne peux pas bannir ce membre. Vérifie la hiérarchie de mes rôles.", flags: MessageFlags.Ephemeral });
        await user.send(`Tu as été banni de **${interaction.guild.name}**.\n**Raison :** ${reason}`).catch(() => null);
        await interaction.guild.members.ban(user.id, { deleteMessageSeconds: hours * 3600, reason: `${reason} — ${interaction.user.tag}` });
        await interaction.reply({ content: `✅ **${user.tag}** a été banni.`, flags: MessageFlags.Ephemeral });
    }
};
