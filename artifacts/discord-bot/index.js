const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { setupErrorHandler } = require('./utils/errorHandler');
const { startReminder } = require('./utils/reminder');
const { startAutomod } = require('./utils/automod');
const { startAntispam } = require('./utils/antispam');
const { startReactionRoles } = require('./utils/reactionRoles');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

client.setMaxListeners(50);
setupErrorHandler(client);

client.once('ready', () => {
  console.log(`🔥 MoSeTo connecté en tant que ${client.user.tag}`);
  startReminder(client);
  console.log('⏰ Système de rappels activé');
  startAutomod(client);
  console.log('🚨 Système automod activé');
  startAntispam(client);
  console.log('⏱️ Système anti-spam activé');
  startReactionRoles(client);
  console.log('🎭 Système reaction-roles activé');
});

// --- Utilitaires ---
require('./commands/help')(client);
require('./commands/ping')(client);
require('./commands/status')(client);

// --- Annonces ---
require('./commands/announce')(client);
require('./commands/motd')(client, true);

// --- Équipes ---
require('./commands/register')(client);
require('./commands/unregister')(client);
require('./commands/team_manage')(client);

// --- Matchs ---
require('./commands/addmatch')(client);
require('./commands/resetmatch')(client);
require('./commands/export')(client);
require('./commands/backup')(client);
require('./commands/restore')(client);

// --- Stats ---
require('./commands/ranking')(client);
require('./commands/stats')(client);
require('./commands/search')(client);
require('./commands/compare')(client);
require('./commands/history')(client);
require('./commands/top')(client);
require('./commands/matchs')(client);
require('./commands/mvp')(client);
require('./commands/stats_advanced')(client);

// --- Tournois ---
require('./commands/newtournoi')(client);
require('./commands/endtournoi')(client);
require('./commands/tournois')(client);
require('./commands/deletetournoi')(client);
require('./commands/bracket')(client);

// --- Saisons ---
require('./commands/season')(client);

// --- Calendrier ---
require('./commands/schedule')(client);

// --- Sondages & Giveaway ---
require('./commands/poll')(client);
require('./commands/giveaway')(client);

// --- Modération ---
require('./commands/warn')(client);
require('./commands/moderation')(client);
require('./commands/ticket')(client);

// --- Règles ---
require('./commands/rules')(client);

// --- Notes & Achievements ---
require('./commands/note')(client);
require('./commands/achievement')(client);

// --- Aléatoire ---
require('./commands/random')(client);

// --- Rappels ---
require('./commands/remind')(client);

// --- Rangs automatiques ---
require('./commands/rankroles')(client);

// --- Config ---
require('./commands/configbot')(client);

// --- Blacklist ---
require('./commands/blacklist')(client);

// --- Historique logs ---
require('./commands/loghistory')(client);

// --- Automod ---
require('./commands/automod')(client);

// --- Anti-spam ---
require('./commands/antispam')(client);

// --- Cooldowns ---
require('./commands/cooldowncmd')(client);

// --- Reaction roles ---
require('./commands/reactionrole')(client);

// --- Signalements ---
require('./commands/report')(client);

client.login(process.env.TOKEN);
