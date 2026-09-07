const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { requireStaff, settings } = require("../utils/permissions");
const store = require("../utils/store");

module.exports = {
    data: new SlashCommandBuilder().setName("warn").setDescription("Avertir un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Motif").setRequired(true).setMaxLength(1000)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const user = interaction.options.getUser("membre");
        const reason = interaction.options.getString("raison");
        const warnings = store.addWarning(interaction.guildId, user.id, { reason, staffId: interaction.user.id, at: new Date().toISOString() });
        await user.send(`⚠️ Tu as reçu un avertissement sur **${interaction.guild.name}**.\n**Raison :** ${reason}`).catch(() => null);
        await interaction.reply({ content: `✅ ${user} a reçu un avertissement. Total : **${warnings.length}**.`, flags: MessageFlags.Ephemeral });
        const channelId = settings(interaction.guildId).logChannelId;
        const channel = channelId && await interaction.guild.channels.fetch(channelId).catch(() => null);
        await channel?.send({ embeds: [new EmbedBuilder().setColor("Yellow").setTitle("⚠️ Avertissement").addFields({ name: "Membre", value: `${user} (\`${user.id}\`)` }, { name: "Staff", value: `${interaction.user}` }, { name: "Raison", value: reason }).setTimestamp()] }).catch(() => null);
    }
};
