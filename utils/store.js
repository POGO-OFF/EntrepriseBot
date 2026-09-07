const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "store.json");

const emptyData = () => ({ guilds: {}, tickets: {}, warnings: {} });
let data = emptyData();

function load() {
    try {
        if (fs.existsSync(dataFile)) {
            data = { ...emptyData(), ...JSON.parse(fs.readFileSync(dataFile, "utf8")) };
        }
    } catch (error) {
        console.error("❌ Impossible de lire les données :", error);
    }
}

function save() {
    fs.mkdirSync(dataDir, { recursive: true });
    const temporary = `${dataFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, dataFile);
}

function guild(guildId) {
    data.guilds[guildId] ||= {};
    return data.guilds[guildId];
}

function setGuild(guildId, values) {
    Object.assign(guild(guildId), values);
    save();
    return guild(guildId);
}

function getTicketByUser(userId) {
    return Object.values(data.tickets).find((ticket) => ticket.userId === userId && ticket.open);
}

function getTicketByThread(threadId) {
    return data.tickets[threadId] || null;
}

function putTicket(ticket) {
    data.tickets[ticket.threadId] = ticket;
    save();
}

function closeTicket(threadId, closedBy) {
    const ticket = data.tickets[threadId];
    if (!ticket) return null;
    ticket.open = false;
    ticket.closedBy = closedBy;
    ticket.closedAt = new Date().toISOString();
    save();
    return ticket;
}

function addWarning(guildId, userId, warning) {
    const key = `${guildId}:${userId}`;
    data.warnings[key] ||= [];
    data.warnings[key].push(warning);
    save();
    return data.warnings[key];
}

function getWarnings(guildId, userId) {
    return data.warnings[`${guildId}:${userId}`] || [];
}

load();

module.exports = { guild, setGuild, getTicketByUser, getTicketByThread, putTicket, closeTicket, addWarning, getWarnings };
