const { Events, MessageFlags } = require("discord.js");
const store = require("../utils/store");
const { isStaff } = require("../utils/permissions");

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith("ticket_")) return;
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Cette action est réservée au staff.", flags: MessageFlags.Ephemeral });
        const ticket = store.getTicketByThread(interaction.channelId);
        if (!ticket?.open) return interaction.reply({ content: "❌ Ce ticket est déjà fermé.", flags: MessageFlags.Ephemeral });
        if (interaction.customId.startsWith("ticket_claim:")) {
            ticket.claimedBy = interaction.user.id;
            store.putTicket(ticket);
            return interaction.reply(`🙋 Ticket pris en charge par ${interaction.user}.`);
        }
        store.closeTicket(interaction.channelId, interaction.user.id);
        const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);
        await user?.send(`🔒 Ton ticket sur **${interaction.guild.name}** a été fermé par le staff.`).catch(() => null);
        await interaction.reply("🔒 Ticket fermé. Archivage en cours…");
        setTimeout(async () => {
            await interaction.channel.setLocked(true).catch(() => null);
            await interaction.channel.setArchived(true).catch(() => null);
        }, 1500);
    }
};
