import "dotenv/config";
import {
  REST,
  Routes,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";
import { moderationCommands } from "./moderation.js";
import { ticketCommands } from "./tickets.js";

const syncCommand = new SlashCommandBuilder()
  .setName("sync")
  .setDescription("Synchroniser le serveur")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const commands = [
  syncCommand.toJSON(),
  ...moderationCommands.map(command => command.toJSON()),
  ...ticketCommands.map(command => command.toJSON())
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

try {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.DISCORD_CLIENT_ID,
      process.env.DISCORD_GUILD_ID
    ),
    { body: commands }
  );

  console.log(`${commands.length} commandes déployées.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
