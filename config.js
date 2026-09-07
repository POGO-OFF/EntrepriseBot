require("dotenv").config();

const requiredVariables = [
    "TOKEN",
    "CLIENT_ID",
    "GUILD_ID"
];

const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
);

if (missingVariables.length > 0) {
    throw new Error(
        `Variables d'environnement manquantes : ${missingVariables.join(", ")}`
    );
}

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID,

    channels: {
        panel: process.env.PANEL_CHANNEL_ID || null,

        // Facultatif : si non renseigné, les événements seront publiés
        // dans le même salon que les entreprises.
        events:
            process.env.EVENT_CHANNEL_ID ||
            process.env.PANEL_CHANNEL_ID || null
    },

    roles: {
        admin: process.env.ADMIN_ROLE_ID || null,
        staff: process.env.STAFF_ROLE_ID || null,
        auto: process.env.AUTO_ROLE_ID || null
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
