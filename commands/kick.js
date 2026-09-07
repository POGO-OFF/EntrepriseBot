const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
module.exports = {
    data: new SlashCommandBuilder().setName("kick").setDescription("Expulser un membre")
        .addUserOption((o) => o.setName("membre").setDescription("Membre concerné").setRequired(true))
        .addStringOption((o) => o.setName("raison").setDescription("Motif").setRequired(true)),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const member = interaction.options.getMember("membre");
        const reason = interaction.options.getString("raison");
        if (!member?.kickable) return interaction.reply({ content: "❌ Je ne peux pas expulser ce membre. Vérifie la hiérarchie de mes rôles.", flags: MessageFlags.Ephemeral });
        await member.user.send(`Tu as été expulsé de **${interaction.guild.name}**.\n**Raison :** ${reason}`).catch(() => null);
        await member.kick(`${reason} — ${interaction.user.tag}`);
        await interaction.reply({ content: `✅ **${member.user.tag}** a été expulsé.`, flags: MessageFlags.Ephemeral });
    }
};
