const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { settings } = require("./permissions");

async function sendLog(client, channelId, embed) {
    const effectiveChannelId = channelId || settings(config.guildId).logChannelId;
    if (!effectiveChannelId) {
        return;
    }

    const channel = await client.channels
        .fetch(effectiveChannelId)
        .catch(() => null);

    if (!channel?.isTextBased()) {
        console.warn(`⚠️ Salon de logs introuvable : ${effectiveChannelId}`);
        return;
    }

    await channel.send({ embeds: [embed] }).catch((error) => {
        console.error("❌ Erreur lors de l'envoi d'un log :", error);
    });
}

function commonFields(interaction) {
    return [
        {
            name: "Utilisateur",
            value: `<@${interaction.user.id}>\n\`${interaction.user.id}\``,
            inline: true
        },
        {
            name: "Serveur",
            value: interaction.guild?.name || "Inconnu",
            inline: true
        },
        {
            name: "Salon",
            value: interaction.channelId
                ? `<#${interaction.channelId}>`
                : "Inconnu",
            inline: true
        }
    ];
}

module.exports = {
    async commandUsed(interaction) {
        const embed = new EmbedBuilder()
            .setColor("Blurple")
            .setTitle("⌨️ Commande utilisée")
            .addFields(
                ...commonFields(interaction),
                {
                    name: "Commande",
                    value: `/${interaction.commandName}`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(
            interaction.client,
            config.logs.commands,
            embed
        );
    },

    async companyCreated(interaction, title, url, imageUrl = null) {
        const embed = new EmbedBuilder()
            .setColor("Green")
            .setTitle("🏢 Entreprise publiée")
            .addFields(
                ...commonFields(interaction),
                { name: "Titre", value: title, inline: false },
                {
                    name: "Publication",
                    value: `[Voir le panneau](${url})`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        if (imageUrl) embed.setImage(imageUrl);

        await sendLog(
            interaction.client,
            config.logs.companies,
            embed
        );
    },

    async companyClosed(interaction, title) {
        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🔴 Entreprise fermée")
            .addFields(
                ...commonFields(interaction),
                {
                    name: "Entreprise",
                    value: title || "Inconnue",
                    inline: false
                },
                {
                    name: "Fermée par",
                    value: `<@${interaction.user.id}>`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(
            interaction.client,
            config.logs.companies,
            embed
        );
    },

    async eventCreated(interaction, title, url, imageUrl = null) {
        const embed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("🎉 Événement publié")
            .addFields(
                ...commonFields(interaction),
                { name: "Titre", value: title, inline: false },
                {
                    name: "Publication",
                    value: `[Voir l'événement](${url})`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        if (imageUrl) embed.setImage(imageUrl);

        await sendLog(
            interaction.client,
            config.logs.events,
            embed
        );
    },

    async eventFinished(interaction, title) {
        const embed = new EmbedBuilder()
            .setColor("DarkOrange")
            .setTitle("🏁 Événement terminé")
            .addFields(
                ...commonFields(interaction),
                {
                    name: "Événement",
                    value: title || "Inconnu",
                    inline: false
                },
                {
                    name: "Terminé par",
                    value: `<@${interaction.user.id}>`,
                    inline: false
                }
            )
            .setThumbnail(interaction.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(
            interaction.client,
            config.logs.events,
            embed
        );
    },

    async error(client, error, context = "Inconnu") {
        const details = String(
            error?.stack || error || "Erreur inconnue"
        ).slice(0, 3800);

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("❌ Erreur du bot")
            .addFields({ name: "Contexte", value: context })
            .setDescription(`\`\`\`js\n${details}\n\`\`\``)
            .setTimestamp();

        await sendLog(client, config.logs.errors, embed);
    }
};
