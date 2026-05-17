const express = require('express');
const cors    = require('cors');
const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const Schedule   = require('../database/models/Schedule');
const PlayerStat = require('../database/models/PlayerStat');
const Roster     = require('../database/models/Roster');
const Tournament = require('../database/models/Tournament');

const app  = express();
const PORT = 3000;

// ─── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://supremyx.vercel.app',
  'http://localhost:3000',
  'http://localhost:5000',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS non autorisé'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
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

// ── GET /health ───────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'SUPREMYX' }));

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
router.get('/ranking/:team', async (req, res) => {
  try {
    const team = await Team.findOne({
      name: { $regex: new RegExp(`^${req.params.team}$`, 'i') }
    }).lean();
    if (!team) return res.status(404).json({ error: `Équipe introuvable : ${req.params.team}` });

    const rank       = await Team.countDocuments({ points: { $gt: team.points } }) + 1;
    const allMatches = await Match.find({ team: team.name }).sort({ createdAt: 1 }).lean();

    let cumul = 0;
    const timeline = allMatches.map(m => {
      cumul += m.points;
      return { date: m.createdAt, pts: cumul, match_pts: m.points, kills: m.kills, placement: m.placement };
    });

    const recentMatches = [...allMatches].reverse().slice(0, 10);

    return res.json({
      success: true, rank,
      team: team.name, points: team.points, kills: team.kills,
      wins: team.wins, losses: team.losses,
      matchCount: allMatches.length,
      timeline,
      recentMatches: recentMatches.map(m => ({
        matchId: m._id, points: m.points, kills: m.kills,
        placement: m.placement, addedBy: m.addedBy, date: m.createdAt,
        tournamentName: m.tournamentName,
      })),
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
    if (req.query.past === 'true') delete filter.date;

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
    if (teamFilter) query.teamName = { $regex: new RegExp(teamFilter, 'i') };

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
router.get('/players/:name', async (req, res) => {
  try {
    const stats = await PlayerStat.find({
      displayName: { $regex: new RegExp(`^${req.params.name}$`, 'i') }
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
router.get('/rosters/:team', async (req, res) => {
  try {
    const roster = await Roster.findOne({
      teamName: { $regex: new RegExp(`^${req.params.team}$`, 'i') }
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

// ── GET /tournaments ──────────────────────────────────────────────────────────
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
    const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
    if (!team) return res.status(404).json({ error: `Équipe introuvable : ${teamName}` });

    team.points += points;
    team.kills  += kills;
    await team.save();
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
      match = await Match.findById(matchId);
      if (!match) return res.status(404).json({ error: `Match introuvable : ${matchId}` });
    } else {
      match = await Match.findOne({ team: { $regex: new RegExp(`^${teamName}$`, 'i') } })
        .sort({ createdAt: -1 });
      if (!match) return res.status(404).json({ error: `Aucun match trouvé pour : ${teamName}` });
    }

    const team = await Team.findOne({ name: { $regex: new RegExp(`^${match.team}$`, 'i') } });
    if (!team) return res.status(404).json({ error: `Équipe introuvable : ${match.team}` });

    team.points = Math.max(0, team.points - match.points);
    team.kills  = Math.max(0, team.kills  - match.kills);
    await team.save();
    await Match.findByIdAndDelete(match._id);

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

// ─── Mount ───────────────────────────────────────────────────────────────────
app.use('/', router);
app.use('/bot-api', router);

function startApiServer() {
  app.listen(PORT, () => {
    console.log(`🌐 API SUPREMYX démarrée sur le port ${PORT}`);
  });
}

module.exports = { startApiServer };
