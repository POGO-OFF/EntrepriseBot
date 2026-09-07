const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
module.exports = {
    data: new SlashCommandBuilder().setName("unban").setDescription("Débannir un utilisateur")
        .addStringOption((o) => o.setName("identifiant").setDescription("Identifiant Discord de l'utilisateur").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Motif")),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const id = interaction.options.getString("identifiant").trim();
        if (!/^\d{17,20}$/.test(id)) return interaction.reply({ content: "❌ L'identifiant Discord est invalide.", flags: MessageFlags.Ephemeral });
        const reason = interaction.options.getString("raison") || `Débanni par ${interaction.user.tag}`;
        await interaction.guild.members.unban(id, reason);
        await interaction.reply({ content: `✅ L'utilisateur \`${id}\` a été débanni.`, flags: MessageFlags.Ephemeral });
    }
};
