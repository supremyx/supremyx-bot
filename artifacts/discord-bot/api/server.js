const express = require('express');
const Team    = require('../database/models/Team');
const Match   = require('../database/models/Match');

const app  = express();
const PORT = 3000;

app.use(express.json());

// POST /addpoints — ajoute des points et kills à une équipe
app.post('/addpoints', async (req, res) => {
  const { team: teamName, points, kills } = req.body;

  if (!teamName || points == null || kills == null)
    return res.status(400).json({ error: 'Champs requis : team, points, kills' });

  if (typeof points !== 'number' || typeof kills !== 'number')
    return res.status(400).json({ error: '`points` et `kills` doivent être des nombres' });

  try {
    const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
    if (!team)
      return res.status(404).json({ error: `Équipe introuvable : ${teamName}` });

    team.points += points;
    team.kills  += kills;
    await team.save();

    await Match.create({
      team:     team.name,
      placement: 0,
      kills,
      points,
      addedBy:  'API'
    });

    return res.json({
      success:    true,
      team:       team.name,
      totalPoints: team.points,
      totalKills:  team.kills,
      added:      { points, kills }
    });

  } catch (err) {
    console.error('[API /addpoints]', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// POST /removematch — annule le dernier match ajouté pour une équipe (ou par matchId)
app.post('/removematch', async (req, res) => {
  const { team: teamName, matchId } = req.body;

  if (!teamName && !matchId)
    return res.status(400).json({ error: 'Fournir `team` ou `matchId`' });

  try {
    let match;

    if (matchId) {
      match = await Match.findById(matchId);
      if (!match) return res.status(404).json({ error: `Match introuvable : ${matchId}` });
    } else {
      match = await Match.findOne({
        team: { $regex: new RegExp(`^${teamName}$`, 'i') }
      }).sort({ createdAt: -1 });
      if (!match) return res.status(404).json({ error: `Aucun match trouvé pour : ${teamName}` });
    }

    const team = await Team.findOne({ name: { $regex: new RegExp(`^${match.team}$`, 'i') } });
    if (!team) return res.status(404).json({ error: `Équipe introuvable : ${match.team}` });

    // Rollback points et kills
    team.points = Math.max(0, team.points - match.points);
    team.kills  = Math.max(0, team.kills  - match.kills);
    await team.save();

    await Match.findByIdAndDelete(match._id);

    return res.json({
      success:     true,
      removed:     { matchId: match._id, points: match.points, kills: match.kills },
      team:        team.name,
      totalPoints: team.points,
      totalKills:  team.kills
    });

  } catch (err) {
    console.error('[API /removematch]', err);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// GET /health — vérification rapide
app.get('/health', (_req, res) => res.json({ status: 'ok', bot: 'MoSeTo' }));

function startApiServer() {
  app.listen(PORT, () => {
    console.log(`🌐 API HTTP démarrée sur le port ${PORT}`);
  });
}

module.exports = { startApiServer };
