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
        .setName("panneau")
        .setDescription("Publier le panneau d'ouverture d'une entreprise")
        .addAttachmentOption((option) =>
            option
                .setName("image")
                .setDescription("Image du panneau de l'entreprise")
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

        const panelId = interaction.id;

        interaction.client.pendingPanels.set(panelId, {
            imageUrl: image.url,
            imageName: image.name || "panneau.png",
            creatorId: interaction.user.id,
            guildId: interaction.guildId,
            createdAt: Date.now()
        });

        setTimeout(() => {
            interaction.client.pendingPanels.delete(panelId);
        }, 15 * 60 * 1000);

        const modal = new ModalBuilder()
            .setCustomId(`panneau_modal:${panelId}`)
            .setTitle("Créer un panneau");

        const titleInput = new TextInputBuilder()
            .setCustomId("panneau_title")
            .setLabel("Titre de l'entreprise")
            .setPlaceholder("Exemple : Saloon de Valentine")
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(100)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId("panneau_description")
            .setLabel("Description")
            .setPlaceholder("Exemple : Nous sommes ouverts, venez nombreux !")
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
