const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("evenements")
        .setDescription("Publier un panneau pour un événement")
        .addAttachmentOption((option) =>
            option
                .setName("image")
                .setDescription("Image de l'événement")
                .setRequired(true)
        ),

    async execute(interaction) {
        const image = interaction.options.getAttachment("image");

        if (!image.contentType?.startsWith("image/")) {
            return interaction.reply({
                content: "❌ Le fichier doit être une image.",
                flags: MessageFlags.Ephemeral
            });
        }

        if (image.size > 10 * 1024 * 1024) {
            return interaction.reply({
                content: "❌ L'image ne doit pas dépasser 10 Mo.",
                flags: MessageFlags.Ephemeral
            });
        }

        const eventId = interaction.id;

        if (!interaction.client.pendingEvents) {
            interaction.client.pendingEvents = new Map();
        }

        interaction.client.pendingEvents.set(eventId, {
            imageUrl: image.url,
            imageName: image.name || "evenement.png",
            creatorId: interaction.user.id,
            guildId: interaction.guildId,
            createdAt: Date.now()
        });

        setTimeout(() => {
            interaction.client.pendingEvents?.delete(eventId);
        }, 15 * 60 * 1000);

        const modal = new ModalBuilder()
            .setCustomId(`evenement_modal:${eventId}`)
            .setTitle("Créer un événement");

        const titleInput = new TextInputBuilder()
            .setCustomId("evenement_title")
            .setLabel("Titre de l'événement")
            .setPlaceholder("Exemple : Bal de Saint-Denis")
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(100)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId("evenement_description")
            .setLabel("Description")
            .setPlaceholder(
                "Exemple : Rendez-vous samedi à 21 h devant la mairie."
            )
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descriptionInput)
        );

        await interaction.showModal(modal);
    }
};