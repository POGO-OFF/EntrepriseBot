const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
const store = require("../utils/store");

module.exports = {
    data: new SlashCommandBuilder().setName("sanctions").setDescription("Afficher les avertissements d'un membre").addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const user = interaction.options.getUser("membre");
        const warnings = store.getWarnings(interaction.guildId, user.id);
        const description = warnings.length ? warnings.map((w, i) => `**${i + 1}.** ${w.reason}\nPar <@${w.staffId}> — <t:${Math.floor(new Date(w.at).getTime() / 1000)}:d>`).join("\n\n").slice(0, 4000) : "Aucun avertissement enregistré.";
        await interaction.reply({ embeds: [new EmbedBuilder().setColor("Orange").setTitle(`Sanctions de ${user.username}`).setDescription(description).setFooter({ text: `${warnings.length} avertissement(s)` })], flags: MessageFlags.Ephemeral });
    }
};
