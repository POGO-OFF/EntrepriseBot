const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
const store = require("../utils/store");
module.exports = {
    data: new SlashCommandBuilder().setName("membre").setDescription("Afficher les informations d'un membre").addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const member = interaction.options.getMember("membre");
        const user = interaction.options.getUser("membre");
        const warnings = store.getWarnings(interaction.guildId, user.id).length;
        const roles = member?.roles.cache.filter((r) => r.id !== interaction.guildId).map(String).slice(0, 15).join(", ") || "Aucun";
        const embed = new EmbedBuilder().setColor("Blurple").setTitle(`Informations — ${user.tag}`).setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: "Identifiant", value: `\`${user.id}\``, inline: true },
                { name: "Compte créé", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: "Arrivée sur le serveur", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Inconnue", inline: false },
                { name: "Avertissements", value: String(warnings), inline: true },
                { name: "Rôles", value: roles.slice(0, 1024), inline: false }
            );
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
