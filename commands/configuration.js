const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require("discord.js");
const store = require("../utils/store");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("configuration")
        .setDescription("Configurer le bot Silver Creek")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand((sub) => sub.setName("role-staff").setDescription("Choisir le rôle staff").addRoleOption((o) => o.setName("role").setDescription("Rôle du staff").setRequired(true)))
        .addSubcommand((sub) => sub.setName("role-arrivee").setDescription("Choisir le rôle automatique").addRoleOption((o) => o.setName("role").setDescription("Rôle donné aux nouveaux membres").setRequired(true)))
        .addSubcommand((sub) => sub.setName("forum-tickets").setDescription("Choisir le Forum des tickets").addChannelOption((o) => o.setName("forum").setDescription("Forum privé du staff").addChannelTypes(ChannelType.GuildForum).setRequired(true)))
        .addSubcommand((sub) => sub.setName("salon-panneau").setDescription("Choisir le salon des entreprises").addChannelOption((o) => o.setName("salon").setDescription("Salon des panneaux").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)))
        .addSubcommand((sub) => sub.setName("salon-event").setDescription("Choisir le salon des événements").addChannelOption((o) => o.setName("salon").setDescription("Salon des événements").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true)))
        .addSubcommand((sub) => sub.setName("salon-logs").setDescription("Choisir le salon des logs").addChannelOption((o) => o.setName("salon").setDescription("Salon des logs").addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand((sub) => sub.setName("voir").setDescription("Afficher la configuration actuelle")),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Seuls les administrateurs peuvent configurer le bot.", flags: MessageFlags.Ephemeral });
        }
        const sub = interaction.options.getSubcommand();
        const map = {
            "role-staff": ["staffRoleId", "role"],
            "role-arrivee": ["autoRoleId", "role"],
            "forum-tickets": ["ticketForumId", "forum"],
            "salon-panneau": ["panelChannelId", "salon"],
            "salon-event": ["eventChannelId", "salon"],
            "salon-logs": ["logChannelId", "salon"]
        };
        if (sub === "voir") {
            const s = store.guild(interaction.guildId);
            return interaction.reply({
                content: [
                    `**Rôle staff :** ${s.staffRoleId ? `<@&${s.staffRoleId}>` : "Non configuré"}`,
                    `**Rôle d'arrivée :** ${s.autoRoleId ? `<@&${s.autoRoleId}>` : "Non configuré"}`,
                    `**Forum tickets :** ${s.ticketForumId ? `<#${s.ticketForumId}>` : "Non configuré"}`,
                    `**Salon panneaux :** ${s.panelChannelId ? `<#${s.panelChannelId}>` : "Variable Env ou non configuré"}`,
                    `**Salon événements :** ${s.eventChannelId ? `<#${s.eventChannelId}>` : "Variable Env ou non configuré"}`,
                    `**Salon logs :** ${s.logChannelId ? `<#${s.logChannelId}>` : "Non configuré"}`
                ].join("\n"),
                flags: MessageFlags.Ephemeral
            });
        }
        const [key, option] = map[sub];
        const target = option === "role" ? interaction.options.getRole(option) : interaction.options.getChannel(option);
        store.setGuild(interaction.guildId, { [key]: target.id });
        return interaction.reply({ content: `✅ Configuration enregistrée : ${target}.`, flags: MessageFlags.Ephemeral });
    }
};
