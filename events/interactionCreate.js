const {
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const config = require("../config");
const logger = require("../utils/logger");
const { settings, isStaff } = require("../utils/permissions");

function safeAttachmentName(originalName, prefix = "panneau") {
    const extension = originalName?.split(".").pop()?.toLowerCase() || "png";
    const allowedExtensions = ["png", "jpg", "jpeg", "gif", "webp"];

    return allowedExtensions.includes(extension)
        ? `${prefix}.${extension}`
        : `${prefix}.png`;
}

function canDeletePublication(interaction, creatorId) {
    const member = interaction.member;

    const isCreator = interaction.user.id === creatorId;

    const hasAdminRole = isStaff(member) ||
        (config.roles.admin && (member.roles?.cache?.has(config.roles.admin) ?? false));

    const isAdministrator =
        member.permissions?.has(
            PermissionFlagsBits.Administrator
        ) ?? false;

    return isCreator || hasAdminRole || isAdministrator;
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction) {
        try {
            /*
            ─────────────────────────────────────
            COMMANDES SLASH
            ─────────────────────────────────────
            */

            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(
                    interaction.commandName
                );

                if (!command) {
                    return interaction.reply({
                        content: "❌ Commande introuvable.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await logger.commandUsed(interaction);
                await command.execute(interaction);
                return;
            }

            /*
            ─────────────────────────────────────
            FORMULAIRE ENTREPRISE
            ─────────────────────────────────────
            */

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("panneau_modal:")
            ) {
                const panelId = interaction.customId.split(":")[1];

                const pendingPanel =
                    interaction.client.pendingPanels?.get(panelId);

                if (!pendingPanel) {
                    return interaction.reply({
                        content:
                            "❌ La demande a expiré. Relance `/panneau`.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (pendingPanel.creatorId !== interaction.user.id) {
                    return interaction.reply({
                        content:
                            "❌ Ce formulaire appartient à un autre utilisateur.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const title = interaction.fields
                    .getTextInputValue("panneau_title")
                    .trim();

                const description = interaction.fields
                    .getTextInputValue("panneau_description")
                    .trim();

                const panelChannelId = settings(interaction.guildId).panelChannelId;
                const panelChannel = await interaction.guild.channels
                    .fetch(panelChannelId)
                    .catch(() => null);

                if (!panelChannel?.isTextBased()) {
                    return interaction.editReply(
                        "❌ Le salon configuré est introuvable ou invalide."
                    );
                }

                const botMember = interaction.guild.members.me;
                const permissions = panelChannel.permissionsFor(botMember);

                const requiredPermissions = [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles
                ];

                if (!permissions?.has(requiredPermissions)) {
                    return interaction.editReply(
                        "❌ Le bot n'a pas les permissions nécessaires dans le salon."
                    );
                }

                const fileName = safeAttachmentName(
                    pendingPanel.imageName,
                    "panneau"
                );

                const embed = new EmbedBuilder()
                    .setColor(config.embed.color)
                    .setTitle(title)
                    .setImage(`attachment://${fileName}`)
                    .setFooter({
                        text: config.embed.footer
                    })
                    .setTimestamp();

                if (description) {
                    embed.setDescription(description);
                }

                const closeButton = new ButtonBuilder()
                    .setCustomId(
                        `close_company:${pendingPanel.creatorId}`
                    )
                    .setLabel("Entreprise Fermée")
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(
                    closeButton
                );

                const publishedMessage = await panelChannel.send({
                    embeds: [embed],
                    components: [row],
                    files: [
                        {
                            attachment: pendingPanel.imageUrl,
                            name: fileName
                        }
                    ]
                });

                interaction.client.pendingPanels.delete(panelId);

                await logger.companyCreated(
                    interaction,
                    title,
                    publishedMessage.url,
                    pendingPanel.imageUrl
                );

                await interaction.editReply(
                    `✅ Panneau publié dans ${panelChannel}.\n${publishedMessage.url}`
                );

                return;
            }

            /*
            ─────────────────────────────────────
            FORMULAIRE ÉVÉNEMENT
            ─────────────────────────────────────
            */

            if (
                interaction.isModalSubmit() &&
                interaction.customId.startsWith("evenement_modal:")
            ) {
                const eventId = interaction.customId.split(":")[1];

                const pendingEvent =
                    interaction.client.pendingEvents?.get(eventId);

                if (!pendingEvent) {
                    return interaction.reply({
                        content:
                            "❌ La demande a expiré. Relance `/event`.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                if (pendingEvent.creatorId !== interaction.user.id) {
                    return interaction.reply({
                        content:
                            "❌ Ce formulaire appartient à un autre utilisateur.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });

                const title = interaction.fields
                    .getTextInputValue("evenement_title")
                    .trim();

                const description = interaction.fields
                    .getTextInputValue("evenement_description")
                    .trim();

                const eventChannelId = settings(interaction.guildId).eventChannelId;
                const panelChannel = await interaction.guild.channels
                    .fetch(eventChannelId)
                    .catch(() => null);

                if (!panelChannel?.isTextBased()) {
                    return interaction.editReply(
                        "❌ Le salon configuré est introuvable ou invalide."
                    );
                }

                const botMember = interaction.guild.members.me;
                const permissions = panelChannel.permissionsFor(botMember);

                const requiredPermissions = [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles
                ];

                if (!permissions?.has(requiredPermissions)) {
                    return interaction.editReply(
                        "❌ Le bot n'a pas les permissions nécessaires dans le salon."
                    );
                }

                const fileName = safeAttachmentName(
                    pendingEvent.imageName,
                    "evenement"
                );

                const embed = new EmbedBuilder()
                    .setColor("#E67E22")
                    .setTitle(title)
                    .setImage(`attachment://${fileName}`)
                    .setFooter({
                        text: "Silver Creek RP — Événements"
                    })
                    .setTimestamp();

                if (description) {
                    embed.setDescription(description);
                }

                const finishButton = new ButtonBuilder()
                    .setCustomId(
                        `finish_event:${pendingEvent.creatorId}`
                    )
                    .setLabel("Événement terminé")
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(
                    finishButton
                );

                const publishedMessage = await panelChannel.send({
                    embeds: [embed],
                    components: [row],
                    files: [
                        {
                            attachment: pendingEvent.imageUrl,
                            name: fileName
                        }
                    ]
                });

                interaction.client.pendingEvents.delete(eventId);

                await logger.eventCreated(
                    interaction,
                    title,
                    publishedMessage.url,
                    pendingEvent.imageUrl
                );

                await interaction.editReply(
                    `✅ Événement publié dans ${panelChannel}.\n${publishedMessage.url}`
                );

                return;
            }

            /*
            ─────────────────────────────────────
            BOUTON ENTREPRISE FERMÉE
            ─────────────────────────────────────
            */

            if (
                interaction.isButton() &&
                interaction.customId.startsWith("close_company:")
            ) {
                const creatorId = interaction.customId.split(":")[1];

                if (!canDeletePublication(interaction, creatorId)) {
                    return interaction.reply({
                        content:
                            "❌ Seul le créateur du panneau ou un administrateur peut fermer cette entreprise.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const title =
                    interaction.message.embeds[0]?.title ||
                    "Entreprise inconnue";

                await logger.companyClosed(interaction, title);

                await interaction.deferUpdate();
                await interaction.message.delete();

                return;
            }

            /*
            ─────────────────────────────────────
            BOUTON ÉVÉNEMENT TERMINÉ
            ─────────────────────────────────────
            */

            if (
                interaction.isButton() &&
                interaction.customId.startsWith("finish_event:")
            ) {
                const creatorId = interaction.customId.split(":")[1];

                if (!canDeletePublication(interaction, creatorId)) {
                    return interaction.reply({
                        content:
                            "❌ Seul le créateur de l'événement ou un administrateur peut terminer cet événement.",
                        flags: MessageFlags.Ephemeral
                    });
                }

                const title =
                    interaction.message.embeds[0]?.title ||
                    "Événement inconnu";

                await logger.eventFinished(interaction, title);

                await interaction.deferUpdate();
                await interaction.message.delete();

                return;
            }
        } catch (error) {
            console.error("❌ Erreur interactionCreate :", error);

            await logger.error(
                interaction.client,
                error,
                interaction.customId ||
                    interaction.commandName ||
                    "interactionCreate"
            );

            const response = {
                content: "❌ Une erreur inattendue est survenue.",
                flags: MessageFlags.Ephemeral
            };

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp(response);
                } else {
                    await interaction.reply(response);
                }
            } catch (replyError) {
                console.error(
                    "❌ Impossible d'envoyer le message d'erreur :",
                    replyError
                );
            }
        }
    }
};
