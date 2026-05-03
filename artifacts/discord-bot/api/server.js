const express = require('express');
const cors    = require('cors');
const Team    = require('../database/models/Team');
const Match   = require('../database/models/Match');

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ─── Routes ────────────────────────────────────────────────────────────────

const router = express.Router();

// GET /health
router.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'MoSeTo' }));

// GET /ranking — classement complet trié par points
router.get('/ranking', async (req, res) => {
  try {
    const teams = await Team.find().sort({ points: -1, kills: -1 }).lean();
    const ranking = teams.map((t, i) => ({
      rank:   i + 1,
      team:   t.name,
      points: t.points,
      kills:  t.kills,
      wins:   t.wins,
      losses: t.losses
    }));
    return res.json({ success: true, total: ranking.length, ranking });
  } catch (err) {
    console.error('[API /ranking]', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /ranking/:team — stats + derniers matchs d'une équipe
router.get('/ranking/:team', async (req, res) => {
  try {
    const team = await Team.findOne({
      name: { $regex: new RegExp(`^${req.params.team}$`, 'i') }
    }).lean();

    if (!team) return res.status(404).json({ error: `Équipe introuvable : ${req.params.team}` });

    const rank = await Team.countDocuments({ points: { $gt: team.points } }) + 1;
    const recentMatches = await Match.find({ team: team.name })
      .sort({ createdAt: -1 }).limit(5).lean();

    return res.json({
      success: true, rank, team: team.name,
      points: team.points, kills: team.kills,
      wins: team.wins, losses: team.losses,
      recentMatches: recentMatches.map(m => ({
        matchId: m._id, points: m.points, kills: m.kills,
        placement: m.placement, addedBy: m.addedBy, date: m.createdAt
      }))
    });
  } catch (err) {
    console.error('[API /ranking/:team]', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /addpoints
router.post('/addpoints', async (req, res) => {
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
      added: { points, kills }
    });
  } catch (err) {
    console.error('[API /addpoints]', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /removematch
router.post('/removematch', async (req, res) => {
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
      team: team.name, totalPoints: team.points, totalKills: team.kills
    });
  } catch (err) {
    console.error('[API /removematch]', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Mount at both root (for internal localhost:3000 use) and /bot-api (for proxy)
app.use('/', router);
app.use('/bot-api', router);

function startApiServer() {
  app.listen(PORT, () => {
    console.log(`🌐 API HTTP démarrée sur le port ${PORT}`);
  });
}

module.exports = { startApiServer };
