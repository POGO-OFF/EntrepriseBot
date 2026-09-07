const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
module.exports = {
    data: new SlashCommandBuilder().setName("untimeout").setDescription("Retirer l'exclusion temporaire").addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const member = interaction.options.getMember("membre");
        if (!member?.moderatable) return interaction.reply({ content: "❌ Je ne peux pas modifier ce membre.", flags: MessageFlags.Ephemeral });
        await member.timeout(null, `Retiré par ${interaction.user.tag}`);
        await interaction.reply({ content: `✅ L'exclusion temporaire de ${member} est retirée.`, flags: MessageFlags.Ephemeral });
    }
};
