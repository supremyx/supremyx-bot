process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const OpenAI = require('openai');

let openai = null;
if (process.env.OPENROUTER_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1"
  });
}

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

// Conversation memory: userId → [{ role, content }, ...]
const aiConversations = new Map();
const AI_MAX_HISTORY = 10;        // max messages gardés (5 échanges)
const AI_IDLE_TIMEOUT = 30 * 60 * 1000; // reset après 30min d'inactivité
const aiIdleTimers = new Map();

function resetConversation(userId) {
  aiConversations.delete(userId);
  const t = aiIdleTimers.get(userId);
  if (t) { clearTimeout(t); aiIdleTimers.delete(userId); }
}

function scheduleIdleReset(userId) {
  const existing = aiIdleTimers.get(userId);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => resetConversation(userId), AI_IDLE_TIMEOUT);
  aiIdleTimers.set(userId, t);
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!ia')) return;

  if (!openai) {
    return message.reply("⚠️ La fonctionnalité IA n'est pas configurée sur ce serveur.");
  }

  const prompt = message.content.slice(3).trim();

  // !ia reset — efface la mémoire de conversation
  if (prompt.toLowerCase() === 'reset') {
    resetConversation(message.author.id);
    return message.reply("🗑️ Ta conversation avec l'IA a été réinitialisée.");
  }

  if (!prompt) {
    return message.reply("❗ Mets un texte après `!ia` (ou `!ia reset` pour effacer la mémoire).");
  }

  const now = Date.now();
  const lastUsed = aiCooldowns.get(message.author.id) || 0;
  const remaining = AI_COOLDOWN_MS - (now - lastUsed);
  if (remaining > 0) {
    return message.reply(`⏳ Cooldown IA : attends encore **${Math.ceil(remaining / 1000)}s** avant de réutiliser \`!ia\`.`);
  }
  aiCooldowns.set(message.author.id, now);
  setTimeout(() => aiCooldowns.delete(message.author.id), AI_COOLDOWN_MS);

  // Récupère ou crée l'historique de cet utilisateur
  const history = aiConversations.get(message.author.id) || [];
  history.push({ role: 'user', content: prompt });

  try {
    console.log(`[IA] ${message.author.tag} — ${history.length} msg(s) en contexte`);

    const response = await openai.chat.completions.create({
      model: "openrouter/auto",
      messages: [
        { role: 'system', content: "Tu es SUPREMYX, un assistant IA pour une communauté gaming. Réponds en français, sois concis et utile." },
        ...history
      ]
    });

    const reply = response?.choices?.[0]?.message?.content;

    if (!reply) {
      history.pop(); // annule l'ajout si pas de réponse
      return message.reply("⚠️ Réponse vide de l'IA.");
    }

    // Ajoute la réponse à l'historique et limite la taille
    history.push({ role: 'assistant', content: reply });
    if (history.length > AI_MAX_HISTORY) history.splice(0, history.length - AI_MAX_HISTORY);
    aiConversations.set(message.author.id, history);
    scheduleIdleReset(message.author.id);

    // Discord limite les messages à 2000 caractères
    if (reply.length <= 2000) {
      await message.reply(reply);
    } else {
      const chunks = reply.match(/[\s\S]{1,2000}/g) || [];
      await message.reply(chunks[0]);
      for (const chunk of chunks.slice(1)) {
        await message.channel.send(chunk);
      }
    }

  } catch (err) {
    history.pop(); // annule l'ajout en cas d'erreur
    console.error("[IA] ERREUR :", err);
    message.reply("⚠️ IA indisponible.");
  }
});

// --- Utilitaires ---
require('./commands/help')(client);
require('./commands/helpadmin')(client);
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

// --- Inscriptions tournoi ---
require('./commands/inscription')(client);
require('./commands/inscrire')(client);

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
