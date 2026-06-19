process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { setupErrorHandler, logError } = require('./utils/errorHandler');
const { setupMaintenanceGuard } = require('./utils/maintenanceGuard');
const BotInstance = require('./database/models/BotInstance');
const crypto = require('crypto');
const INSTANCE_ID = crypto.randomBytes(6).toString('hex');
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
setupMaintenanceGuard(client);

client.once('clientReady', async () => {
  console.log(`🔥 SUPREMYX connecté en tant que ${client.user.tag}`);

  // ── Détection d'instances multiples ────────────────────────────────────────
  try {
    const recent = await BotInstance.find({
      instanceId: { $ne: INSTANCE_ID },
      heartbeat:  { $gte: new Date(Date.now() - 20000) }
    }).lean();

    if (recent.length > 0) {
      console.warn('⚠️  ATTENTION : Une autre instance du bot semble active (même token).');
      console.warn('⚠️  Cela provoque des réponses en double. Arrête l\'autre instance.');
      recent.forEach(r => console.warn(`   → Instance ${r.instanceId} | PID ${r.pid} | démarrée ${r.startedAt}`));
    }

    await BotInstance.findOneAndUpdate(
      { instanceId: INSTANCE_ID },
      { pid: process.pid, heartbeat: new Date(), startedAt: new Date() },
      { upsert: true }
    );

    setInterval(async () => {
      await BotInstance.findOneAndUpdate(
        { instanceId: INSTANCE_ID },
        { heartbeat: new Date() }
      ).catch(() => {});
    }, 10000);

  } catch (e) {
    console.error('[BotInstance] Erreur détection:', e.message);
  }
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

// --- Intelligence Artificielle ---
require('./commands/ia')(client);

// --- Aide ---
require('./commands/aide')(client);
require('./commands/aidestaff')(client);
require('./commands/repertoire')(client);

// --- Erreurs ---
require('./commands/erreurs')(client);

// --- Maintenance ---
require('./commands/maintenance')(client);

// --- Diffusion ---
require('./commands/diffuser')(client);

// --- Utilitaires ---
require('./commands/ping')(client);
require('./commands/status')(client);
require('./commands/gitpush')(client);
require('./commands/gitstatus')(client);
const { startApiServer } = require('./api/server');
startApiServer();
require('./commands/changelog')(client);
require('./commands/botstats')(client);
require('./utils/commandTracker')(client);

// --- Annonces ---
require('./commands/lien')(client);
require('./commands/planifier')(client);
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

// --- Profil joueur ---
require('./commands/profil')(client);

// --- Objectifs d'équipe ---
require('./commands/objectif')(client);

// --- Lineup d'équipe ---
require('./commands/lineup')(client);

// --- Absences joueurs ---
require('./commands/absence')(client);

// --- Stats avancées (moyennes, tendance, podium, résumé) ---
require('./commands/statsplus')(client);

// --- Équipes avancées (equipes, freeagents, transfert, capitaine, comparerjoueur) ---
require('./commands/equipesplus')(client);

// --- Modération avancée (casier, rapport, topwarn) ---
require('./commands/moderationplus')(client);

// --- Gestion XP (donnerxp, retirerxp, progression) ---
require('./commands/xpmanage')(client);

// --- Tournois avancés (vainqueurs, prochainmatch, annulermatch, saisoncourante, classementsaison) ---
require('./commands/tournoiplus')(client);

// --- Utilitaires avancés (countdown, uptime, memoire, lienbot) ---
require('./commands/utilitairesplus')(client);

client.login(process.env.TOKEN);
