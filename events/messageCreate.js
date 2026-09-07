const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const config = require("../config");
const store = require("../utils/store");
const { settings, isStaff } = require("../utils/permissions");

function cleanName(user) {
    return `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 90);
}

function attachments(message) {
    return [...message.attachments.values()].map((file) => file.url);
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        if (message.guild) {
            if (!message.channel.isThread() || !isStaff(message.member)) return;
            const ticket = store.getTicketByThread(message.channel.id);
            if (!ticket?.open) return;
            const user = await message.client.users.fetch(ticket.userId).catch(() => null);
            if (!user) return;
            const files = attachments(message);
            await user.send({
                content: `**${message.member.displayName} — Staff de ${message.guild.name} :**\n${message.content || "*Pièce jointe*"}`,
                files
            }).then(() => message.react("📤")).catch(() => message.react("❌").catch(() => null));
            return;
        }
        const guild = await message.client.guilds.fetch(config.guildId).catch(() => null);
        if (!guild) return message.reply("❌ Le serveur associé au bot est actuellement indisponible.");
        const forumId = settings(guild.id).ticketForumId;
        if (!forumId) return message.reply("❌ Le système de tickets n'est pas encore configuré. Contacte un administrateur du serveur.");
        const forum = await guild.channels.fetch(forumId).catch(() => null);
        if (!forum?.isThreadOnly()) return message.reply("❌ Le Forum des tickets est introuvable. Contacte un administrateur.");

        let ticket = store.getTicketByUser(message.author.id);
        let thread = ticket && await guild.channels.fetch(ticket.threadId).catch(() => null);
        const files = attachments(message);

        if (!thread) {
            const embed = new EmbedBuilder().setColor("Blue").setTitle("🎫 Nouveau ticket par message privé")
                .setDescription(message.content || "*Message avec pièce jointe*")
                .addFields({ name: "Membre", value: `${message.author} (\`${message.author.id}\`)` })
                .setThumbnail(message.author.displayAvatarURL()).setTimestamp();
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ticket_claim:${message.author.id}`).setLabel("Prendre").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`ticket_close:${message.author.id}`).setLabel("Fermer").setStyle(ButtonStyle.Danger)
            );
            thread = await forum.threads.create({
                name: cleanName(message.author),
                reason: `Ticket MP de ${message.author.tag}`,
                message: { embeds: [embed], components: [row], files }
            });
            ticket = { threadId: thread.id, userId: message.author.id, open: true, createdAt: new Date().toISOString(), claimedBy: null };
            store.putTicket(ticket);
            await message.reply(`✅ Ton ticket a été créé sur **${guild.name}**. Écris simplement ici pour ajouter des messages. Un membre du staff te répondra bientôt.`);
            return;
        }

        if (thread.archived) await thread.setArchived(false).catch(() => null);
        await thread.send({
            embeds: [new EmbedBuilder().setColor("Blue").setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() }).setDescription(message.content || "*Pièce jointe reçue*").setTimestamp()],
            files
        });
        await message.react("✅").catch(() => null);
    }
};
