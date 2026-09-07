const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");

module.exports = {
    data: new SlashCommandBuilder().setName("timeout").setDescription("Exclure temporairement un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addIntegerOption((o) => o.setName("minutes").setDescription("Durée en minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption((o) => o.setName("raison").setDescription("Motif").setRequired(true)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const member = interaction.options.getMember("membre");
        const minutes = interaction.options.getInteger("minutes");
        const reason = interaction.options.getString("raison");
        if (!member?.moderatable) return interaction.reply({ content: "❌ Je ne peux pas sanctionner ce membre. Vérifie la hiérarchie de mes rôles.", flags: MessageFlags.Ephemeral });
        await member.timeout(minutes * 60_000, `${reason} — ${interaction.user.tag}`);
        await interaction.reply({ content: `✅ ${member} est exclu pendant **${minutes} minute(s)**.`, flags: MessageFlags.Ephemeral });
    }
};
