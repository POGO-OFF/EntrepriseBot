const { Events, ActivityType } = require("discord.js");

module.exports = {
    name: Events.ClientReady,
    once: true,

    execute(client) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`✅ Connecté en tant que ${client.user.tag}`);
        console.log(`🌐 Présent sur ${client.guilds.cache.size} serveur(s)`);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        client.user.setPresence({
            activities: [
                {
                    name: "Les Entreprises de Silver Creek",
                    type: ActivityType.Watching
                }
            ],
            status: "online"
        });
    }
};
