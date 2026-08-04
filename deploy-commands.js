const fs = require("fs");
const path = require("path");

const { REST, Routes } = require("discord.js");
const config = require("./config");

const commands = [];
const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
    console.error("❌ Le dossier commands est introuvable.");
    process.exit(1);
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

    commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
    try {
        console.log(`🔄 Déploiement de ${commands.length} commande(s)...`);

        const result = await rest.put(
            Routes.applicationGuildCommands(
                config.clientId,
                config.guildId
            ),
            { body: commands }
        );

        console.log(
            `✅ ${result.length} commande(s) déployée(s) sur le serveur.`
        );
    } catch (error) {
        console.error("❌ Échec du déploiement :", error);
        process.exit(1);
    }
})();
