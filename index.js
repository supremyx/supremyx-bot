process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { setupErrorHandler } = require('./utils/errorHandler');
const { startReminder } = require('./utils/reminder');
const { startAutomod } = require('./utils/automod');
const { startAntispam } = require('./utils/antispam');
const { startReactionRoles } = require('./utils/reactionRoles');
const { startSondageManager } = require('./utils/sondageManager');
const { startBirthdayManager } = require('./utils/birthdayManager');
const { startLevelManager } = require('./utils/levelManager');
const { startDashboardManager } = require('./utils/dashboardManager');
const { startScheduleManager } = require('./utils/scheduleManager');
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

client.setMaxListeners(100);
setupErrorHandler(client);

client.once('clientReady', () => {
  console.log(`🔥 SUPREMYX connecté en tant que ${client.user.tag}`);
  startReminder(client);
  console.log('⏰ Système de rappels activé');
  startAutomod(client);
  console.log('🚨 Système automod activé');
  startAntispam(client);
  console.log('⏱️ Système anti-spam activé');
  startReactionRoles(client);
  console.log('🎭 Système reaction-roles activé');
  startSondageManager(client);
  console.log('📊 Système sondages activé');
  startBirthdayManager(client);
  console.log('🎂 Système anniversaires activé');
  startLevelManager(client);
  console.log('📈 Système niveaux/XP activé');
  startDashboardManager(client);
  console.log('📊 Système dashboard automatique activé');
  startScheduleManager(client);
  console.log('📅 Système rappels calendrier activé');
});

const aiCooldowns = new Map();
const AI_COOLDOWN_MS = 15000; // 15s par utilisateur

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (!message.content.startsWith('!ai')) return;

  const now = Date.now();
  const lastUsed = aiCooldowns.get(message.author.id) || 0;
  const remaining = AI_COOLDOWN_MS - (now - lastUsed);
  if (remaining > 0) {
    return message.reply(`⏳ Cooldown IA : attends encore **${Math.ceil(remaining / 1000)}s** avant de réutiliser \`!ai\`.`);
  }
  aiCooldowns.set(message.author.id, now);
  setTimeout(() => aiCooldowns.delete(message.author.id), AI_COOLDOWN_MS);

  const prompt = message.content.slice(3).trim();

  if (!prompt) {
    return message.reply("❗ Mets un texte après !ai");
  }

  try {
    console.log("Envoi à OpenRouter...");

    const response = await openai.chat.completions.create({
      model: "openrouter/auto",
      messages: [
        { role: "user", content: prompt }
      ]
    });

    console.log("Réponse reçue");

    const reply = response?.choices?.[0]?.message?.content;

    if (!reply) {
      return message.reply("⚠️ Réponse vide de l'IA.");
    }

    await message.reply(reply);

  } catch (err) {
    console.error("ERREUR COMPLETE :", err);
    message.reply("⚠️ IA indisponible.");
  }
});

// --- Utilitaires ---
require('./commands/help')(client);
require('./commands/helpstaff')(client);
require('./commands/ping')(client);
require('./commands/status')(client);
require('./commands/gitpush')(client);
const { startApiServer } = require('./api/server');
startApiServer();
require('./commands/changelog')(client);
require('./commands/botstats')(client);
require('./utils/commandTracker')(client);

// --- Annonces ---
require('./commands/announce')(client);
require('./commands/say')(client);
require('./commands/result')(client);
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
require('./commands/teaminfo')(client);

// --- Tournois ---
require('./commands/newtournoi')(client);
require('./commands/endtournoi')(client);
require('./commands/tournois')(client);
require('./commands/tournoidetail')(client);
require('./commands/deletetournoi')(client);
require('./commands/bracket')(client);

// --- Saisons ---
require('./commands/season')(client);
require('./commands/mvpseason')(client);

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

// --- Stats joueurs ---
require('./commands/playerstats')(client);

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

// --- Sondages temporisés ---
require('./commands/sondage')(client);

// --- Suggestions ---
require('./commands/suggestion')(client);

// --- Événements RSVP ---
require('./commands/eventcmd')(client);

// --- AFK ---
require('./commands/afk')(client);

// --- Anniversaires ---
require('./commands/birthday')(client);

// --- Embed builder ---
require('./commands/embedbuilder')(client);

// --- Welcome & Autorole ---
require('./commands/welcome')(client);
require('./commands/autorole')(client);

// --- Infos ---
require('./commands/userinfo')(client);
require('./commands/serverinfo')(client);
require('./commands/roleinfo')(client);

// --- Niveaux XP ---
require('./commands/level')(client);

// --- Lock/Unlock ---
require('./commands/lockdown')(client);

// --- Sanctions & Escalade ---
require('./commands/sanctions')(client);

// --- Dashboard ---
require('./commands/dashboard')(client);

// --- Règlement interactif ---
require('./commands/reglementcmd')(client);

// --- Signalements ---
require('./commands/report')(client);

// --- Roster équipes ---
require('./commands/roster')(client);

client.login(process.env.TOKEN);
