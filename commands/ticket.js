const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { requireStaff } = require("../utils/permissions");
const store = require("../utils/store");

function currentTicket(interaction) {
    return store.getTicketByThread(interaction.channelId);
}

module.exports = {
    data: new SlashCommandBuilder().setName("ticket").setDescription("Gérer le ticket privé actuel")
        .addSubcommand((s) => s.setName("repondre").setDescription("Répondre au membre en message privé").addStringOption((o) => o.setName("message").setDescription("Réponse").setRequired(true).setMaxLength(1900)).addAttachmentOption((o) => o.setName("fichier").setDescription("Pièce jointe facultative")))
        .addSubcommand((s) => s.setName("prendre").setDescription("Prendre en charge le ticket"))
        .addSubcommand((s) => s.setName("ajouter").setDescription("Ajouter une personne à la publication").addUserOption((o) => o.setName("membre").setDescription("Personne à ajouter").setRequired(true)))
        .addSubcommand((s) => s.setName("fermer").setDescription("Fermer le ticket")),
    async execute(interaction) {
        if (!(await requireStaff(interaction))) return;
        const ticket = currentTicket(interaction);
        if (!ticket?.open) return interaction.reply({ content: "❌ Cette publication n'est pas un ticket ouvert.", flags: MessageFlags.Ephemeral });
        const sub = interaction.options.getSubcommand();
        if (sub === "repondre") {
            const message = interaction.options.getString("message");
            const file = interaction.options.getAttachment("fichier");
            const user = await interaction.client.users.fetch(ticket.userId);
            await user.send({ content: `**Réponse du staff de ${interaction.guild.name} :**\n${message}`, files: file ? [file.url] : [] });
            await interaction.reply({ content: `📤 **${interaction.user.tag} :** ${message}`, files: file ? [file.url] : [] });
        } else if (sub === "prendre") {
            ticket.claimedBy = interaction.user.id;
            store.putTicket(ticket);
            await interaction.reply(`🙋 Ticket pris en charge par ${interaction.user}.`);
        } else if (sub === "ajouter") {
            const member = interaction.options.getMember("membre");
            await interaction.channel.members.add(member.id);
            await interaction.reply(`✅ ${member} a été ajouté au ticket.`);
        } else {
            store.closeTicket(interaction.channelId, interaction.user.id);
            const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
            await user?.send(`🔒 Ton ticket sur **${interaction.guild.name}** a été fermé par le staff.`).catch(() => null);
            await interaction.reply("🔒 Ticket fermé. Cette publication sera verrouillée et archivée.");
            await interaction.channel.setLocked(true).catch(() => null);
            await interaction.channel.setArchived(true).catch(() => null);
        }
    }
};
