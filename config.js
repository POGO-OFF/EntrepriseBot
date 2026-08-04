require("dotenv").config();

const requiredVariables = [
    "TOKEN",
    "CLIENT_ID",
    "GUILD_ID",
    "PANEL_CHANNEL_ID",
    "ADMIN_ROLE_ID"
];

const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
    throw new Error(
        `Variables manquantes dans le fichier .env : ${missingVariables.join(", ")}`
    );
}

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,

    channels: {
        panel: process.env.PANEL_CHANNEL_ID,

        // Facultatif : si non renseigné, les événements seront publiés
        // dans le même salon que les entreprises.
        events:
            process.env.EVENT_CHANNEL_ID ||
            process.env.PANEL_CHANNEL_ID
    },

    roles: {
        admin: process.env.ADMIN_ROLE_ID
    },

    logs: {
        companies: process.env.LOG_COMPANIES || null,
        events: process.env.LOG_EVENTS || null,
        commands: process.env.LOG_COMMANDS || null,
        errors: process.env.LOG_ERRORS || null
    },

    embed: {
        color: "#38584a",
        footer: "Silver Creek RP — Entreprises"
    },

    eventEmbed: {
        color: "#E67E22",
        footer: "Silver Creek RP — Événements"
    }
};