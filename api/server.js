const express = require('express');
const cors    = require('cors');
const eventBus = require('../utils/eventBus');
const Team          = require('../database/models/Team');
const Match         = require('../database/models/Match');
const Schedule      = require('../database/models/Schedule');
const PlayerStat    = require('../database/models/PlayerStat');
const Roster        = require('../database/models/Roster');
const Tournament    = require('../database/models/Tournament');
const StaffLogEntry = require('../database/models/StaffLogEntry');
const Season        = require('../database/models/Season');
const Warning       = require('../database/models/Warning');
const Sanction      = require('../database/models/Sanction');
const Blacklist     = require('../database/models/Blacklist');
const CommandStat   = require('../database/models/CommandStat');
const IaConfig      = require('../database/models/IaConfig');
const IaUsage       = require('../database/models/IaUsage');

const mongoose = require('mongoose');
const { escapeRegex } = require('../utils/lib');
const rateLimit = require('express-rate-limit');
const app  = express();
const PORT = 3000;

// ─── Rate limiters ───────────────────────────────────────────────────────────
// Requests with a valid BOT_API_KEY bypass all limits (internal bot calls)
const skipIfAuthenticated = (req) => {
  const key = req.headers['x-api-key'] || req.query.key;
  return !!key && key === process.env.BOT_API_KEY;
};

// Public read endpoints: 60 req / min / IP
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfAuthenticated,
  message: { error: 'Trop de requêtes — réessayez dans une minute.' },
});

// Heavy / detail endpoints (DB-intensive): 20 req / min / IP
const detailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfAuthenticated,
  message: { error: 'Trop de requêtes — réessayez dans une minute.' },
});

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://supremyx.xyz',
  'https://www.supremyx.xyz',
  /\.supremyx\.xyz$/,
  /\.replit\.app$/,
  /\.replit\.dev$/,
  /\.github\.io$/,
  /\.up\.railway\.app$/,
  'http://localhost:3000',
  'http://localhost:5000',
];

// Trust the Replit / reverse-proxy layer so rate-limit can read the real client IP
app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / curl
    const ok = ALLOWED_ORIGINS.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    cb(ok ? null : new Error('CORS: origine non autorisée'), ok);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  credentials: true,
}));
app.use(express.json());

// ─── Auth middleware (lecture publique, écriture protégée) ───────────────────
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (!key || key !== process.env.BOT_API_KEY) {
    return res.status(401).json({ error: 'Clé API invalide ou manquante.' });
  }
  next();
}

// ─── Router ──────────────────────────────────────────────────────────────────
const router = express.Router();

// Apply global rate limit to all public routes (60 req/min/IP)
router.use(publicLimiter);

// ── GET /health ───────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'SUPREMYX', ts: new Date() }));

// ── GET /api-docs ─────────────────────────────────────────────────────────────
router.get('/api-docs', (_req, res) => res.json({
  name: 'SUPREMYX Bot API',
  version: '1.0.0',
  description: 'API publique du bot SUPREMYX — lecture libre, écriture protégée par x-api-key.',
  base: '/bot-api',
  endpoints: [
    { method: 'GET',  path: '/health',           auth: false, description: 'Statut du bot' },
    { method: 'GET',  path: '/ranking',           auth: false, description: 'Classement général des équipes' },
    { method: 'GET',  path: '/ranking/:team',     auth: false, description: 'Détail + timeline d\'une équipe' },
    { method: 'GET',  path: '/players',           auth: false, description: 'Classement joueurs par kills' },
    { method: 'GET',  path: '/players/:name',     auth: false, description: 'Détail d\'un joueur' },
    { method: 'GET',  path: '/results',           auth: false, description: 'Derniers résultats de matchs (query: limit, max 50)' },
    { method: 'GET',  path: '/schedule',          auth: false, description: 'Matchs à venir (query: past=true pour tout voir)' },
    { method: 'GET',  path: '/tournaments',       auth: false, description: 'Liste des tournois' },
    { method: 'GET',  path: '/tournaments/:id',   auth: false, description: 'Détail d\'un tournoi' },
    { method: 'GET',  path: '/rosters',           auth: false, description: 'Tous les rosters' },
    { method: 'GET',  path: '/rosters/:team',     auth: false, description: 'Roster d\'une équipe' },
    { method: 'GET',  path: '/logs',              auth: false, description: 'Logs d\'activité staff (query: limit, category)' },
    { method: 'GET',  path: '/seasons',           auth: false, description: 'Historique des saisons et vainqueurs' },
    { method: 'GET',  path: '/warnings',          auth: false, description: 'Liste des avertissements actifs' },
    { method: 'GET',  path: '/sanctions',         auth: false, description: 'Liste des sanctions (kick, ban, mute)' },
    { method: 'GET',  path: '/blacklist',         auth: false, description: 'Liste noire des équipes/joueurs' },
    { method: 'GET',  path: '/botstats',          auth: false, description: 'Statistiques d\'utilisation des commandes + IA' },
    { method: 'POST', path: '/addpoints',         auth: true,  description: 'Ajouter des points/kills à une équipe (body: team, points, kills)' },
    { method: 'POST', path: '/removematch',       auth: true,  description: 'Supprimer un match (body: team ou matchId)' },
  ],
}));

// ── GET /ranking ──────────────────────────────────────────────────────────────
router.get('/ranking', async (req, res) => {
  try {
    const teams = await Team.find().sort({ points: -1, kills: -1 }).lean();
    const ranking = teams.map((t, i) => ({
      rank:   i + 1,
      team:   t.name,
      points: t.points,
      kills:  t.kills,
      wins:   t.wins,
      losses: t.losses,
    }));
    return res.json({ success: true, total: ranking.length, ranking });
  } catch (err) {
    console.error('[API /ranking]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /ranking/:team ────────────────────────────────────────────────────────
router.get('/ranking/:team', detailLimiter, async (req, res) => {
  try {
    const escapedTeam = req.params.team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const team = await Team.findOne({
      name: { $regex: new RegExp(`^${escapedTeam}$`, 'i') }
    }).lean();
    if (!team) return res.status(404).json({ error: `Équipe introuvable : ${req.params.team}` });

    const rank       = await Team.countDocuments({ points: { $gt: team.points } }) + 1;
    const allMatches = await Match.find({ team: team.name }).sort({ createdAt: 1 }).lean();

    let cumul = 0;
    const timeline = allMatches.map(m => {
      cumul += m.points;
      return { date: m.createdAt, pts: cumul, match_pts: m.points, kills: m.kills, placement: m.placement };
    });

    const matchCount = allMatches.length;
    const validPlacements = allMatches.filter(m => m.placement > 0);
    const avgPlacement = validPlacements.length
      ? (validPlacements.reduce((s, m) => s + m.placement, 0) / validPlacements.length).toFixed(2)
      : null;
    const killsPerMatch = matchCount ? (team.kills / matchCount).toFixed(2) : null;
    const winRate = matchCount ? ((team.wins / matchCount) * 100).toFixed(1) : null;

    const matchHistory = [...allMatches].reverse().map(m => ({
      matchId: m._id, points: m.points, kills: m.kills,
      placement: m.placement, addedBy: m.addedBy, date: m.createdAt,
      tournamentName: m.tournamentName,
    }));

    return res.json({
      success: true, rank,
      team: team.name, points: team.points, kills: team.kills,
      wins: team.wins, losses: team.losses,
      matchCount,
      avgPlacement: avgPlacement ? parseFloat(avgPlacement) : null,
      killsPerMatch: killsPerMatch ? parseFloat(killsPerMatch) : null,
      winRate: winRate ? parseFloat(winRate) : null,
      timeline,
      matchHistory,
      recentMatches: matchHistory.slice(0, 10),
    });
  } catch (err) {
    console.error('[API /ranking/:team]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /schedule ─────────────────────────────────────────────────────────────
// Matchs à venir (non terminés) triés par date
router.get('/schedule', async (req, res) => {
  try {
    const filter = { date: { $gte: new Date() }, completed: false };
    if (req.query.past === 'true') { delete filter.date; delete filter.completed; }

    const matches = await Schedule.find(filter).sort({ date: 1 }).lean();
    return res.json({
      success: true,
      total: matches.length,
      schedule: matches.map(m => ({
        id:             m._id,
        date:           m.date,
        teams:          m.teams,
        note:           m.note,
        tournamentName: m.tournamentName,
        completed:      m.completed,
        resultPostedAt: m.resultPostedAt,
      })),
    });
  } catch (err) {
    console.error('[API /schedule]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /results ──────────────────────────────────────────────────────────────
// Matchs planifiés terminés + historique des matchs récents
router.get('/results', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const completedSchedules = await Schedule.find({ completed: true })
      .sort({ resultPostedAt: -1 }).limit(limit).lean();

    const recentMatches = await Match.find()
      .sort({ createdAt: -1 }).limit(limit).lean();

    return res.json({
      success: true,
      completedMatches: completedSchedules.map(m => ({
        id:             m._id,
        date:           m.date,
        teams:          m.teams,
        tournamentName: m.tournamentName,
        resultPostedAt: m.resultPostedAt,
      })),
      recentMatchEntries: recentMatches.map(m => ({
        id:             m._id,
        team:           m.team,
        placement:      m.placement,
        kills:          m.kills,
        points:         m.points,
        tournamentName: m.tournamentName,
        date:           m.createdAt,
      })),
    });
  } catch (err) {
    console.error('[API /results]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /players ──────────────────────────────────────────────────────────────
// Classement joueurs par kills
router.get('/players', async (req, res) => {
  try {
    const limit     = Math.min(parseInt(req.query.limit) || 50, 100);
    const teamFilter = req.query.team;
    const query     = { totalMatches: { $gt: 0 } };
    if (teamFilter) query.teamName = { $regex: new RegExp(escapeRegex(teamFilter), 'i') };

    const players = await PlayerStat.find(query)
      .sort({ totalKills: -1 }).limit(limit).lean();

    return res.json({
      success: true,
      total: players.length,
      players: players.map((p, i) => ({
        rank:         i + 1,
        displayName:  p.displayName,
        teamName:     p.teamName,
        totalKills:   p.totalKills,
        totalMatches: p.totalMatches,
        bestKills:    p.bestKills,
        avgKills:     p.totalMatches > 0
          ? parseFloat((p.totalKills / p.totalMatches).toFixed(2))
          : 0,
        recentHistory: (p.history || []).slice(-5).reverse(),
      })),
    });
  } catch (err) {
    console.error('[API /players]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /players/:name ────────────────────────────────────────────────────────
router.get('/players/:name', detailLimiter, async (req, res) => {
  try {
    const escapedName = req.params.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stats = await PlayerStat.find({
      displayName: { $regex: new RegExp(`^${escapedName}$`, 'i') }
    }).lean();
    if (!stats.length) return res.status(404).json({ error: `Joueur introuvable : ${req.params.name}` });

    const totalKills   = stats.reduce((s, p) => s + p.totalKills,   0);
    const totalMatches = stats.reduce((s, p) => s + p.totalMatches, 0);
    const bestKills    = Math.max(...stats.map(p => p.bestKills), 0);
    const avgKills     = totalMatches > 0
      ? parseFloat((totalKills / totalMatches).toFixed(2)) : 0;

    const allHistory = stats.flatMap(p => p.history)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json({
      success: true,
      displayName:  stats[0].displayName,
      teams:        stats.map(p => p.teamName),
      totalKills, totalMatches, bestKills, avgKills,
      history: allHistory.slice(0, 20),
    });
  } catch (err) {
    console.error('[API /players/:name]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /rosters ──────────────────────────────────────────────────────────────
// Tous les rosters
router.get('/rosters', async (req, res) => {
  try {
    const rosters = await Roster.find().lean();
    return res.json({
      success: true,
      total: rosters.length,
      rosters: rosters.map(r => ({
        teamName: r.teamName,
        members:  r.members.map(m => ({
          displayName: m.displayName,
          role:        m.role,
          userId:      m.userId,
          joinedAt:    m.joinedAt,
        })),
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[API /rosters]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /rosters/:team ────────────────────────────────────────────────────────
router.get('/rosters/:team', detailLimiter, async (req, res) => {
  try {
    const escapedRosterTeam = req.params.team.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const roster = await Roster.findOne({
      teamName: { $regex: new RegExp(`^${escapedRosterTeam}$`, 'i') }
    }).lean();
    if (!roster) return res.status(404).json({ error: `Roster introuvable : ${req.params.team}` });

    return res.json({
      success: true,
      teamName: roster.teamName,
      members: roster.members.map(m => ({
        displayName: m.displayName,
        role:        m.role,
        userId:      m.userId,
        note:        m.note,
        joinedAt:    m.joinedAt,
      })),
      updatedAt: roster.updatedAt,
    });
  } catch (err) {
    console.error('[API /rosters/:team]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /logs ─────────────────────────────────────────────────────────────────
// Dernières entrées du log staff, triées par date décroissante
router.get('/logs', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit) || 100, 500);
    const category = req.query.category;
    const query    = category ? { category } : {};
    const entries  = await StaffLogEntry.find(query)
      .sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      success: true,
      total: entries.length,
      logs: entries.map(e => ({
        _id:       e._id,
        message:   e.message,
        category:  e.category,
        createdAt: e.createdAt,
      })),
    });
  } catch (err) {
    console.error('[API /logs]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /tournaments ──────────────────────────────────────────────────────────
router.get('/tournaments/:id', detailLimiter, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: `ID de tournoi invalide : ${req.params.id}` });
    const t = await Tournament.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: 'Tournoi introuvable' });

    const matches = await Match.find({ tournamentId: String(t._id) })
      .sort({ createdAt: 1 }).lean();

    // Group matches into rounds: matches within 10 minutes of each other = same round
    const rounds = [];
    let currentRound = [];
    for (const m of matches) {
      if (currentRound.length === 0) {
        currentRound.push(m);
      } else {
        const last = currentRound[currentRound.length - 1];
        const diffMs = new Date(m.createdAt) - new Date(last.createdAt);
        if (diffMs <= 10 * 60 * 1000) {
          currentRound.push(m);
        } else {
          rounds.push(currentRound);
          currentRound = [m];
        }
      }
    }
    if (currentRound.length > 0) rounds.push(currentRound);

    // Per-team standings
    const standingsMap = new Map();
    for (const m of matches) {
      const s = standingsMap.get(m.team) || { team: m.team, points: 0, kills: 0, wins: 0, matches: 0 };
      s.points  += m.points;
      s.kills   += m.kills;
      s.matches += 1;
      if (m.placement === 1) s.wins += 1;
      standingsMap.set(m.team, s);
    }
    const standings = Array.from(standingsMap.values())
      .sort((a, b) => b.points - a.points || b.kills - a.kills)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return res.json({
      success: true,
      tournament: { id: t._id, name: t.name, active: t.active, createdAt: t.createdAt, endedAt: t.endedAt || null },
      standings,
      rounds: rounds.map((r, i) => ({
        roundNumber: i + 1,
        date: r[0].createdAt,
        entries: r.sort((a, b) => a.placement - b.placement || b.kills - a.kills)
          .map(m => ({ team: m.team, placement: m.placement, kills: m.kills, points: m.points })),
      })),
      matchCount: matches.length,
      teamCount: standingsMap.size,
    });
  } catch (err) {
    console.error('[API /tournaments/:id]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

router.get('/tournaments', async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      total: tournaments.length,
      tournaments: tournaments.map(t => ({
        id:        t._id,
        name:      t.name,
        active:    t.active,
        createdAt: t.createdAt,
        endedAt:   t.endedAt || null,
      })),
    });
  } catch (err) {
    console.error('[API /tournaments]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── POST /addpoints  (protégé par clé API) ────────────────────────────────────
router.post('/addpoints', requireApiKey, async (req, res) => {
  const { team: teamName, points, kills } = req.body;
  if (!teamName || points == null || kills == null)
    return res.status(400).json({ error: 'Champs requis : team, points, kills' });
  if (typeof points !== 'number' || typeof kills !== 'number')
    return res.status(400).json({ error: '`points` et `kills` doivent être des nombres' });

  try {
    const found = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
    if (!found) return res.status(404).json({ error: `Équipe introuvable : ${teamName}` });

    const team = await Team.findOneAndUpdate(
      { name: found.name },
      { $inc: { points, kills } },
      { new: true }
    );
    await Match.create({ team: team.name, placement: 0, kills, points, addedBy: 'API' });

    return res.json({
      success: true, team: team.name,
      totalPoints: team.points, totalKills: team.kills,
      added: { points, kills },
    });
  } catch (err) {
    console.error('[API /addpoints]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── POST /removematch  (protégé par clé API) ──────────────────────────────────
router.post('/removematch', requireApiKey, async (req, res) => {
  const { team: teamName, matchId } = req.body;
  if (!teamName && !matchId)
    return res.status(400).json({ error: 'Fournir `team` ou `matchId`' });

  try {
    let match;
    if (matchId) {
      if (!mongoose.isValidObjectId(matchId))
        return res.status(400).json({ error: `matchId invalide : ${matchId}` });
      match = await Match.findById(matchId);
      if (!match) return res.status(404).json({ error: `Match introuvable : ${matchId}` });
    } else {
      match = await Match.findOne({ team: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } })
        .sort({ createdAt: -1 });
      if (!match) return res.status(404).json({ error: `Aucun match trouvé pour : ${teamName}` });
    }

    const found = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(match.team)}$`, 'i') } });
    if (!found) return res.status(404).json({ error: `Équipe introuvable : ${match.team}` });

    await Match.findByIdAndDelete(match._id);

    // Recalculate totals from remaining matches to ensure accuracy
    const remaining = await Match.find({ team: found.name });
    const totalPoints = remaining.reduce((s, m) => s + m.points, 0);
    const totalKills  = remaining.reduce((s, m) => s + m.kills,  0);
    const wins        = remaining.filter(m => m.placement === 1).length;
    const losses      = remaining.filter(m => m.placement !== 1 && m.placement > 0).length;

    const team = await Team.findOneAndUpdate(
      { name: found.name },
      { $set: { points: totalPoints, kills: totalKills, wins, losses } },
      { new: true }
    );

    return res.json({
      success: true,
      removed: { matchId: match._id, points: match.points, kills: match.kills },
      team: team.name, totalPoints: team.points, totalKills: team.kills,
    });
  } catch (err) {
    console.error('[API /removematch]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /seasons ──────────────────────────────────────────────────────────────
router.get('/seasons', async (req, res) => {
  try {
    const seasons = await Season.find().sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      total: seasons.length,
      seasons: seasons.map(s => ({
        _id:       s._id,
        name:      s.name,
        active:    s.active,
        startedBy: s.startedBy,
        endedBy:   s.endedBy,
        endedAt:   s.endedAt || null,
        createdAt: s.createdAt,
        snapshot:  s.snapshot || [],
      })),
    });
  } catch (err) {
    console.error('[API /seasons]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /warnings ─────────────────────────────────────────────────────────────
router.get('/warnings', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const entries = await Warning.find().sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      success: true,
      total: entries.length,
      warnings: entries.map(w => ({
        _id:       w._id,
        target:    w.target,
        targetId:  w.targetId,
        reason:    w.reason,
        warnedBy:  w.warnedBy,
        createdAt: w.createdAt,
      })),
    });
  } catch (err) {
    console.error('[API /warnings]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /sanctions ────────────────────────────────────────────────────────────
router.get('/sanctions', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const entries = await Sanction.find().sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      success: true,
      total: entries.length,
      sanctions: entries.map(s => ({
        _id:            s._id,
        userTag:        s.userTag,
        userId:         s.userId,
        type:           s.type,
        reason:         s.reason,
        duration:       s.duration,
        moderatorTag:   s.moderatorTag,
        autoEscalation: s.autoEscalation,
        active:         s.active,
        createdAt:      s.createdAt,
      })),
    });
  } catch (err) {
    console.error('[API /sanctions]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /blacklist ─────────────────────────────────────────────────────────────
router.get('/blacklist', async (req, res) => {
  try {
    const entries = await Blacklist.find().sort({ createdAt: -1 }).lean();
    return res.json({
      success: true,
      total: entries.length,
      blacklist: entries.map(b => ({
        _id:       b._id,
        target:    b.target,
        reason:    b.reason,
        addedBy:   b.addedBy,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('[API /blacklist]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /botstats ─────────────────────────────────────────────────────────────
router.get('/botstats', async (req, res) => {
  try {
    const all = await CommandStat.find().lean();

    // Aggregate by command
    const cmdMap = new Map();
    const userMap = new Map();
    const dayMap = new Map();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const e of all) {
      // Per command
      if (!cmdMap.has(e.command)) cmdMap.set(e.command, { count: 0, lastUsed: null, users: new Map() });
      const cmd = cmdMap.get(e.command);
      cmd.count++;
      const usedAt = new Date(e.usedAt);
      if (!cmd.lastUsed || usedAt > new Date(cmd.lastUsed)) cmd.lastUsed = e.usedAt;
      cmd.users.set(e.username, (cmd.users.get(e.username) || 0) + 1);

      // Global top users
      userMap.set(e.username, (userMap.get(e.username) || 0) + 1);

      // Daily activity (last 7 days)
      if (usedAt >= sevenDaysAgo) {
        const day = usedAt.toISOString().slice(0, 10);
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      }
    }

    const commands = Array.from(cmdMap.entries())
      .map(([command, v]) => ({
        command,
        count: v.count,
        lastUsed: v.lastUsed,
        topUsers: Array.from(v.users.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([username, count]) => ({ username, count })),
      }))
      .sort((a, b) => b.count - a.count);

    const topUsers = Array.from(userMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([username, count]) => ({ username, count }));

    // Fill missing days in last 7 days
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dailyActivity.push({ date: d, count: dayMap.get(d) || 0 });
    }

    const MODELS = {
      'gpt-4o-mini':   { label: 'GPT-4o Mini',       emoji: '🟢' },
      'gpt-4o':        { label: 'GPT-4o',             emoji: '🔵' },
      'claude-haiku':  { label: 'Claude 3.5 Haiku',  emoji: '🟣' },
      'claude-sonnet': { label: 'Claude 3.5 Sonnet', emoji: '🟤' },
      'gemini-flash':  { label: 'Gemini 2.0 Flash',  emoji: '🔴' },
      'mistral':       { label: 'Mistral 7B',         emoji: '⚪' },
      'llama':         { label: 'LLaMA 3.1 8B',      emoji: '🟡' },
    };

    // ── IA models config per guild ──────────────────────────────────────────
    const iaConfigs = await IaConfig.find().lean();
    const iaModels = iaConfigs.map(c => {
      const alias = c.model || 'gpt-4o-mini';
      const m = MODELS[alias] || { label: alias, emoji: '🤖' };
      return { guildId: c.guildId, alias, label: m.label, emoji: m.emoji };
    });

    // ── IA usage stats ──────────────────────────────────────────────────────
    const iaAll = await IaUsage.find().lean();
    const iaUserMap = new Map();
    const iaModelMap = new Map();
    const iaDayMap = new Map();

    for (const u of iaAll) {
      iaUserMap.set(u.username, (iaUserMap.get(u.username) || 0) + 1);
      iaModelMap.set(u.modelAlias, (iaModelMap.get(u.modelAlias) || 0) + 1);
      const usedAt = new Date(u.usedAt);
      if (usedAt >= sevenDaysAgo) {
        const day = usedAt.toISOString().slice(0, 10);
        iaDayMap.set(day, (iaDayMap.get(day) || 0) + 1);
      }
    }

    const iaTopUsers = [...iaUserMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([username, count]) => ({ username, count }));

    const iaByModel = [...iaModelMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([alias, count]) => {
        const m = MODELS[alias] || { label: alias, emoji: '🤖' };
        return { alias, label: m.label, emoji: m.emoji, count, pct: iaAll.length ? Math.round((count / iaAll.length) * 100) : 0 };
      });

    const iaDailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      iaDailyActivity.push({ date: d, count: iaDayMap.get(d) || 0 });
    }

    const iaRecent = iaAll.filter(u => new Date(u.usedAt) >= sevenDaysAgo).length;

    return res.json({
      success: true,
      totalUsage: all.length,
      uniqueCommands: cmdMap.size,
      commands,
      topUsers,
      dailyActivity,
      iaModels,
      iaStats: {
        total: iaAll.length,
        recent: iaRecent,
        topUsers: iaTopUsers,
        byModel: iaByModel,
        dailyActivity: iaDailyActivity,
      },
    });
  } catch (err) {
    console.error('[API /botstats]', err);
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /events (SSE) ─────────────────────────────────────────────────────────
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send a heartbeat every 25s to keep the connection alive
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 25_000);

  const onMatch = (data) => {
    res.write(`event: newMatch\ndata: ${JSON.stringify(data)}\n\n`);
  };

  eventBus.on('newMatch', onMatch);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventBus.off('newMatch', onMatch);
  });
});

// ─── Modèles supplémentaires ─────────────────────────────────────────────────
const GuildEvent  = require('../database/models/GuildEvent');
const Ticket      = require('../database/models/Ticket');
const Birthday    = require('../database/models/Birthday');
const Suggestion  = require('../database/models/Suggestion');
const Sondage          = require('../database/models/Sondage');
const ScheduledEmbed   = require('../database/models/ScheduledEmbed');
const PerfAlert        = require('../database/models/PerfAlert');
const Pronostic   = require('../database/models/Pronostic');
const Disponibilite = require('../database/models/Disponibilite');
const Poule       = require('../database/models/Poule');

// ── GET /api/guild-events ─────────────────────────────────────────────────────
router.get('/guild-events', publicLimiter, async (req, res) => {
  try {
    const { guildId, limit = 20 } = req.query;
    const filter = guildId ? { guildId } : {};
    const events = await GuildEvent.find(filter)
      .sort({ date: 1 }).limit(Number(limit)).lean();
    res.json({ events });
  } catch (err) {
    console.error('[API /guild-events]', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/tickets ──────────────────────────────────────────────────────────
router.get('/tickets', publicLimiter, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 }).limit(Number(limit)).lean();
    const stats = {
      open:     await Ticket.countDocuments({ closed: false }),
      closed:   await Ticket.countDocuments({ closed: true }),
      claimed:  await Ticket.countDocuments({ claimedBy: { $ne: null }, closed: false }),
    };
    res.json({ tickets, stats });
  } catch (err) {
    console.error('[API /tickets]', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/birthdays ────────────────────────────────────────────────────────
router.get('/birthdays', publicLimiter, async (req, res) => {
  try {
    const { guildId } = req.query;
    const filter = guildId ? { guildId } : {};
    const birthdays = await Birthday.find(filter).sort({ month: 1, day: 1 }).lean();

    // Calcul des prochains anniversaires
    const now   = new Date();
    const today = { month: now.getMonth() + 1, day: now.getDate() };
    const upcoming = birthdays
      .map(b => {
        let diff = (b.month - today.month) * 30 + (b.day - today.day);
        if (diff < 0) diff += 365;
        return { ...b, daysUntil: diff };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 30);

    res.json({ birthdays, upcoming });
  } catch (err) {
    console.error('[API /birthdays]', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/suggestions ──────────────────────────────────────────────────────
router.get('/suggestions', publicLimiter, async (req, res) => {
  try {
    const { guildId, status, limit = 50 } = req.query;
    const filter = {};
    if (guildId) filter.guildId = guildId;
    if (status)  filter.status  = status;
    const suggestions = await Suggestion.find(filter)
      .sort({ createdAt: -1 }).limit(Number(limit)).lean();
    const stats = {
      pending:  await Suggestion.countDocuments({ ...filter, status: 'pending' }),
      accepted: await Suggestion.countDocuments({ ...filter, status: 'accepted' }),
      refused:  await Suggestion.countDocuments({ ...filter, status: 'refused' }),
      total:    await Suggestion.countDocuments(guildId ? { guildId } : {}),
    };
    res.json({ suggestions, stats });
  } catch (err) {
    console.error('[API /suggestions]', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/ia/usage ─────────────────────────────────────────────────────────
router.get('/ia/usage', publicLimiter, async (req, res) => {
  try {
    const { guildId, days = 7 } = req.query;
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const filter = { usedAt: { $gte: since } };
    if (guildId) filter.guildId = guildId;

    const all = await IaUsage.find(filter).lean();

    // Activité journalière
    const dayMap = new Map();
    for (let i = Number(days) - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }
    for (const u of all) {
      const key = new Date(u.usedAt).toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.set(key, dayMap.get(key) + 1);
    }
    const dailyActivity = [...dayMap.entries()].map(([date, count]) => ({ date, count }));

    // Top utilisateurs
    const userMap = new Map();
    for (const u of all) {
      const e = userMap.get(u.userId) || { username: u.username, count: 0 };
      e.count++;
      userMap.set(u.userId, e);
    }
    const topUsers = [...userMap.values()].sort((a, b) => b.count - a.count).slice(0, 10);

    // Par modèle
    const modelMap = new Map();
    for (const u of all) {
      const alias = u.modelAlias || 'gpt-4o-mini';
      modelMap.set(alias, (modelMap.get(alias) || 0) + 1);
    }
    const total = all.length;
    const byModel = [...modelMap.entries()].map(([alias, count]) => ({
      alias, count, pct: total > 0 ? Math.round((count / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    // Config quota
    const cfgFilter = guildId ? { guildId } : {};
    const config = await IaConfig.findOne(cfgFilter).lean();

    res.json({ total, dailyActivity, topUsers, byModel, quota: config?.dailyQuota ?? 0, days: Number(days) });
  } catch (err) {
    console.error('[API /ia/usage]', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/pronostics ───────────────────────────────────────────────────────
router.get('/pronostics', publicLimiter, async (req, res) => {
  try {
    const { guildId, limit = 30 } = req.query;
    const filter = guildId ? { guildId } : {};
    const pronostics = await Pronostic.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    const correct = pronostics.filter(p => p.correct === true).length;
    const resolved = pronostics.filter(p => p.correct !== null).length;
    res.json({ pronostics, stats: { correct, resolved, total: pronostics.length } });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/poules ───────────────────────────────────────────────────────────
router.get('/poules', publicLimiter, async (req, res) => {
  try {
    const { guildId } = req.query;
    const filter = guildId ? { guildId } : {};
    const poules = await Poule.find(filter).sort({ letter: 1 }).lean();
    res.json({ poules });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/dispos ───────────────────────────────────────────────────────────
router.get('/dispos', publicLimiter, async (req, res) => {
  try {
    const { guildId, teamName } = req.query;
    const filter = {};
    if (guildId)  filter.guildId  = guildId;
    if (teamName) filter.teamName = new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const dispos = await Disponibilite.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ dispos });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/sondages ─────────────────────────────────────────────────────────
router.get('/sondages', publicLimiter, async (req, res) => {
  try {
    const { guildId } = req.query;
    const filter = guildId ? { guildId } : {};

    const [all, closedAll, openCount] = await Promise.all([
      Sondage.countDocuments(filter),
      Sondage.find({ ...filter, closed: true }).sort({ updatedAt: -1 }).lean(),
      Sondage.countDocuments({ ...filter, closed: false }),
    ]);

    const closedCount = closedAll.length;
    const avgVotes = closedCount > 0
      ? parseFloat((closedAll.reduce((s, x) => s + (x.totalVotes || 0), 0) / closedCount).toFixed(1))
      : 0;

    const mostPopular = closedAll.reduce((best, s) =>
      (!best || (s.totalVotes || 0) > (best.totalVotes || 0)) ? s : best, null);

    let topOption = null;
    let topCount = 0;
    for (const s of closedAll) {
      for (const r of (s.results || [])) {
        if (r.count > topCount) { topCount = r.count; topOption = { label: r.option, question: s.question, count: r.count }; }
      }
    }

    const winnerFreq = {};
    for (const s of closedAll) {
      if (s.winner) winnerFreq[s.winner] = (winnerFreq[s.winner] || 0) + 1;
    }
    const topWinnerEntry = Object.entries(winnerFreq).sort((a, b) => b[1] - a[1])[0];
    const topWinner = topWinnerEntry ? { label: topWinnerEntry[0], wins: topWinnerEntry[1] } : null;

    res.json({
      stats: {
        total: all,
        closed: closedCount,
        open: openCount,
        closeRate: all > 0 ? Math.round((closedCount / all) * 100) : 0,
        avgVotes,
        mostPopular: mostPopular ? { question: mostPopular.question, totalVotes: mostPopular.totalVotes || 0 } : null,
        topOption,
        topWinner,
      },
      history: closedAll,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── GET /api/scheduled-embeds ─────────────────────────────────────────────────
router.get('/scheduled-embeds', publicLimiter, async (req, res) => {
  try {
    const { guildId } = req.query;
    const filter = guildId ? { guildId } : {};

    const [pending, recentSent] = await Promise.all([
      ScheduledEmbed.find({ ...filter, sent: false }).sort({ scheduledAt: 1 }).lean(),
      ScheduledEmbed.find({ ...filter, sent: true  }).sort({ scheduledAt: -1 }).limit(20).lean(),
    ]);

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart  = new Date(todayStart.getTime() - 6 * 86400000);

    const sentToday = recentSent.filter(d => new Date(d.scheduledAt) >= todayStart).length;
    const sentWeek  = recentSent.filter(d => new Date(d.scheduledAt) >= weekStart).length;
    const next      = pending.length > 0 ? pending[0] : null;

    res.json({
      stats: { pending: pending.length, sentToday, sentWeek, next: next ? next.scheduledAt : null },
      pending,
      history: recentSent,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ── DELETE /api/scheduled-embeds/:id ─────────────────────────────────────────
router.delete('/scheduled-embeds/:id', requireApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const docs = await ScheduledEmbed.find({ sent: false });
    const doc  = docs.find(d => d._id.toString().slice(-6) === id || d._id.toString() === id);
    if (!doc) return res.status(404).json({ error: 'Embed introuvable' });
    await ScheduledEmbed.findByIdAndDelete(doc._id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ─── Mount ───────────────────────────────────────────────────────────────────
app.use('/', router);
app.use('/bot-api', router);

function startApiServer() {
  const server = app.listen(PORT, () => {
    console.log(`🌐 API SUPREMYX démarrée sur le port ${PORT}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${PORT} déjà occupé — API standalone ignorée (bot déjà actif).`);
    } else {
      console.error('❌ Erreur serveur API:', err);
    }
  });
}

module.exports = { startApiServer };
