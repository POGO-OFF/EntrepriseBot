const fs = require("fs");
const path = require("path");

const {
    Client,
    Collection,
    GatewayIntentBits,
    Partials
} = require("discord.js");

const config = require("./config");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();
client.pendingPanels = new Map();
client.pendingEvents = new Map();

function loadCommands() {
    const commandsPath = path.join(__dirname, "commands");

    if (!fs.existsSync(commandsPath)) {
        console.warn("⚠️ Le dossier commands est introuvable.");
        return;
    }

    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));

        if (!command.data || typeof command.execute !== "function") {
            console.warn(`⚠️ Commande invalide ignorée : ${file}`);
            continue;
        }

        client.commands.set(command.data.name, command);
        console.log(`✅ Commande chargée : /${command.data.name}`);
    }
}

function loadEvents() {
    const eventsPath = path.join(__dirname, "events");

    if (!fs.existsSync(eventsPath)) {
        console.warn("⚠️ Le dossier events est introuvable.");
        return;
    }

    const eventFiles = fs
        .readdirSync(eventsPath)
        .filter((file) => file.endsWith(".js"));

    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));

        if (!event.name || typeof event.execute !== "function") {
            console.warn(`⚠️ Événement invalide ignoré : ${file}`);
            continue;
        }

        const handler = (...args) => event.execute(...args);

        if (event.once) {
            client.once(event.name, handler);
        } else {
            client.on(event.name, handler);
        }

        console.log(`✅ Événement chargé : ${event.name}`);
    }
}

process.on("unhandledRejection", (error) => {
    console.error("❌ Promesse rejetée :", error);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Erreur non interceptée :", error);
});

loadCommands();
loadEvents();

client.login(config.token);
