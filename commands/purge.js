const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
module.exports = {
    data: new SlashCommandBuilder().setName("purge").setDescription("Supprimer plusieurs messages")
        .addIntegerOption((o) => o.setName("nombre").setDescription("Nombre de messages").setRequired(true).setMinValue(1).setMaxValue(100)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        if (!interaction.channel?.bulkDelete) return interaction.reply({ content: "❌ Cette commande ne fonctionne pas dans ce salon.", flags: MessageFlags.Ephemeral });
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const deleted = await interaction.channel.bulkDelete(interaction.options.getInteger("nombre"), true);
        await interaction.editReply(`✅ **${deleted.size}** message(s) supprimé(s). Les messages de plus de 14 jours sont ignorés.`);
    }
};
