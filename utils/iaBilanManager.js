const OpenAI        = require('openai');
const { EmbedBuilder } = require('discord.js');
const IaConfig      = require('../database/models/IaConfig');
const IaUsage       = require('../database/models/IaUsage');
const BilanHebdo    = require('../database/models/BilanHebdo');
const Match         = require('../database/models/Match');
const Team          = require('../database/models/Team');
const PlayerStat    = require('../database/models/PlayerStat');
const Tournament    = require('../database/models/Tournament');

const MODEL_IDS = {
  'gpt-4o-mini':   'openai/gpt-4o-mini',
  'gpt-4o':        'openai/gpt-4o',
  'claude-haiku':  'anthropic/claude-3.5-haiku',
  'claude-sonnet': 'anthropic/claude-3.5-sonnet',
  'gemini-flash':  'google/gemini-2.0-flash-exp:free',
  'mistral':       'mistralai/mistral-7b-instruct:free',
  'llama':         'meta-llama/llama-3.1-8b-instruct:free',
};
const DEFAULT_MODEL = 'gpt-4o-mini';

let _ai = null;
function getAI() {
  if (!_ai && process.env.OPENROUTER_API_KEY) {
    _ai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://discord.com', 'X-Title': 'SUPREMYX Bot' },
    });
  }
  return _ai;
}

// ── Collecte des données de la semaine ────────────────────────────────────────
async function collectWeeklyData(guildId) {
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [matches, allTeams, allPlayers] = await Promise.all([
    Match.find({ createdAt: { $gte: from } }).sort({ createdAt: -1 }).lean(),
    Team.find().sort({ points: -1 }).lean(),
    PlayerStat.find({ guildId }).lean(),
  ]);

  // ── Classement général (top 5) ───────────────────────────────────────────────
  const topTeams = allTeams.slice(0, 5).map((t, i) => ({
    rank: i + 1,
    name: t.name,
    points: t.points,
    kills: t.kills,
    wins: t.wins,
    losses: t.losses,
  }));

  // ── Stats semaine ────────────────────────────────────────────────────────────
  const weekMatches  = matches;
  const totalMatches = weekMatches.length;
  const totalKills   = weekMatches.reduce((s, m) => s + (m.kills || 0), 0);
  const avgKills     = totalMatches ? (totalKills / totalMatches).toFixed(1) : '0';

  // Meilleure performance semaine (placement #1 ou max kills)
  const wins = weekMatches.filter(m => m.placement === 1);
  const bestKillMatch = [...weekMatches].sort((a, b) => b.kills - a.kills)[0] ?? null;

  // Kills record par équipe cette semaine
  const weekKillsByTeam = {};
  for (const m of weekMatches) {
    if (!m.team) continue;
    weekKillsByTeam[m.team] = (weekKillsByTeam[m.team] || 0) + (m.kills || 0);
  }
  const topWeekTeams = Object.entries(weekKillsByTeam)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, kills]) => ({ name, kills }));

  // Record kills individuel semaine
  const playerWeekKills = {};
  for (const ps of allPlayers) {
    const wk = (ps.history || [])
      .filter(h => new Date(h.date) >= from)
      .reduce((s, h) => s + (h.kills || 0), 0);
    if (wk > 0) playerWeekKills[ps.displayName] = { kills: wk, team: ps.teamName };
  }
  const topWeekPlayers = Object.entries(playerWeekKills)
    .sort((a, b) => b[1].kills - a[1].kills)
    .slice(0, 3)
    .map(([name, d]) => ({ name, kills: d.kills, team: d.team }));

  // ── Tournoi actif ────────────────────────────────────────────────────────────
  const activeTournament = await Tournament.findOne({
    $or: [{ status: 'en_cours' }, { status: 'actif' }],
  }).lean().catch(() => null);

  return {
    topTeams, topWeekTeams, topWeekPlayers,
    totalMatches, totalKills, avgKills,
    wins: wins.length,
    bestKillMatch,
    activeTournament: activeTournament?.name ?? null,
    weekFrom: from,
  };
}

// ── Génération du bilan IA ────────────────────────────────────────────────────
async function generateBilanIA(data, modelAlias) {
  const ai = getAI();
  if (!ai) return null;

  const modelId = MODEL_IDS[modelAlias] ?? MODEL_IDS[DEFAULT_MODEL];
  const medals  = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  const classement = data.topTeams.map((t, i) =>
    `  ${medals[i] ?? `${i + 1}.`} ${t.name} — ${t.points} pts | ${t.kills} kills | ${t.wins}V/${t.losses}D`
  ).join('\n');

  const topEquipesSemaine = data.topWeekTeams.map((t, i) =>
    `  ${medals[i]} ${t.name} — ${t.kills} kills cette semaine`
  ).join('\n') || '  Aucun match enregistré';

  const topJoueurs = data.topWeekPlayers.map((p, i) =>
    `  ${medals[i]} ${p.name} (${p.team}) — ${p.kills} kills`
  ).join('\n') || '  Aucune stat disponible';

  const records = data.bestKillMatch
    ? `  🔥 Record kills : ${data.bestKillMatch.kills} kills par ${data.bestKillMatch.team} le ${new Date(data.bestKillMatch.createdAt).toLocaleDateString('fr-FR')}`
    : '  Aucun record cette semaine';

  const ctx = [
    `=== BILAN SEMAINE SUPREMYX ===`,
    `Période : ${data.weekFrom.toLocaleDateString('fr-FR')} → aujourd'hui`,
    data.activeTournament ? `Tournoi en cours : ${data.activeTournament}` : '',
    `\nClassement général (Top 5) :\n${classement}`,
    `\nPerformances de la semaine :`,
    `  Matchs joués : ${data.totalMatches}`,
    `  Kills totaux : ${data.totalKills} | Moyenne : ${data.avgKills} kills/match`,
    `  Victoires (#1) : ${data.wins}`,
    `\nTop équipes (kills semaine) :\n${topEquipesSemaine}`,
    `\nTop joueurs (kills semaine) :\n${topJoueurs}`,
    `\nRecords :\n${records}`,
  ].filter(Boolean).join('\n');

  const res = await ai.chat.completions.create({
    model: modelId,
    messages: [
      {
        role: 'system',
        content: `Tu es le chroniqueur officiel de la compétition esport SUPREMYX. Chaque dimanche, tu rédiges le bilan de la semaine en français. Ton style est dynamique, motivant, précis et structuré. Tu utilises des emojis avec parcimonie. Tu dois toujours féliciter les meilleures performances, pointer les tendances clés et terminer par un message d'encouragement pour la semaine suivante. Max 800 tokens.`,
      },
      {
        role: 'user',
        content: `Voici les données de la semaine. Rédige le bilan hebdomadaire en 4 parties :\n\n1) **🏆 Classement & Tendances** — état du classement général, qui progresse, qui régresse\n2) **⚡ Performances de la semaine** — highlights des matchs, kills, victoires marquantes\n3) **🌟 Stars de la semaine** — top joueurs et équipes à mettre en avant\n4) **🎯 Objectifs semaine prochaine** — conseils et motivations pour la suite\n\nDonnées :\n${ctx}`,
      },
    ],
    max_tokens: 900,
  });

  return res.choices[0]?.message?.content ?? null;
}

// ── Construction et envoi du bilan complet ────────────────────────────────────
async function sendBilan(client, guildId, channelId, triggeredBy = null) {
  const channel = client.channels.cache.get(channelId);
  if (!channel) return false;

  const cfg       = await IaConfig.findOne({ guildId }).lean();
  const modelAlias = cfg?.model ?? DEFAULT_MODEL;

  let data;
  try {
    data = await collectWeeklyData(guildId);
  } catch (err) {
    console.error('[iaBilan] Erreur collecte données:', err);
    return false;
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const fmt    = d => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });

  // ── Embed 1 : Stats chiffrées ─────────────────────────────────────────────
  const statsEmbed = new EmbedBuilder()
    .setColor(0xFF8C00)
    .setTitle('📊 Bilan Hebdomadaire SUPREMYX')
    .setDescription(
      `Semaine du **${fmt(data.weekFrom)}** au **${fmt(new Date())}**` +
      (data.activeTournament ? `\n🎮 Tournoi actif : **${data.activeTournament}**` : '')
    )
    .addFields(
      {
        name: '🏆 Classement général (Top 5)',
        value: data.topTeams.length
          ? data.topTeams.map((t, i) =>
              `${medals[i] ?? `${i + 1}.`} **${t.name}** — ${t.points} pts · ${t.kills} kills · ${t.wins}V/${t.losses}D`
            ).join('\n')
          : '_Aucune équipe enregistrée_',
        inline: false,
      },
      {
        name: '⚡ Top équipes (kills semaine)',
        value: data.topWeekTeams.length
          ? data.topWeekTeams.map((t, i) => `${medals[i]} **${t.name}** — ${t.kills} kills`).join('\n')
          : '_Aucun match cette semaine_',
        inline: true,
      },
      {
        name: '🌟 Top joueurs (kills semaine)',
        value: data.topWeekPlayers.length
          ? data.topWeekPlayers.map((p, i) => `${medals[i]} **${p.name}** (${p.team}) — ${p.kills} kills`).join('\n')
          : '_Aucune stat disponible_',
        inline: true,
      },
      {
        name: '\u200b',
        value: '\u200b',
        inline: false,
      },
      {
        name: '🎮 Activité semaine',
        value: `**${data.totalMatches}** match(s) · **${data.totalKills}** kills au total · Moy. **${data.avgKills}** kills/match · **${data.wins}** victoire(s)`,
        inline: false,
      },
      ...(data.bestKillMatch ? [{
        name: '🔥 Record de la semaine',
        value: `**${data.bestKillMatch.team}** — ${data.bestKillMatch.kills} kills le ${fmt(data.bestKillMatch.createdAt)}`,
        inline: false,
      }] : []),
    )
    .setFooter({ text: triggeredBy ? `Déclenché par ${triggeredBy}` : 'Rapport automatique · Chaque dimanche à 20h30' })
    .setTimestamp();

  await channel.send({ embeds: [statsEmbed] });

  // ── Embed 2 : Analyse IA ─────────────────────────────────────────────────
  let iaText = null;
  const ai = getAI();
  if (ai) {
    try {
      const thinkingMsg = await channel.send('🤖 Génération du commentaire IA en cours…');
      iaText = await generateBilanIA(data, modelAlias);

      if (iaText) {
        const iaEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: `🧠 Analyse IA — ${modelAlias}`,
            iconURL: client.user.displayAvatarURL(),
          })
          .setDescription(iaText.slice(0, 4000))
          .setFooter({ text: `Généré via OpenRouter · Modèle : ${modelAlias}` })
          .setTimestamp();

        await thinkingMsg.edit({ content: '', embeds: [iaEmbed] });

        await IaUsage.create({
          guildId,
          userId:      'auto',
          username:    'BilanHebdo',
          modelAlias,
          commandType: 'bilan',
        }).catch(() => {});
      } else {
        await thinkingMsg.edit('⚠️ Commentaire IA indisponible — clé OpenRouter non configurée.');
      }
    } catch (err) {
      console.error('[iaBilan] Erreur génération IA:', err?.message ?? err);
    }
  }

  // ── Sauvegarde en base pour l'historique dashboard ───────────────────────
  await BilanHebdo.create({
    guildId,
    weekFrom:    data.weekFrom,
    weekTo:      new Date(),
    triggeredBy: triggeredBy ?? 'auto',
    modelAlias,
    iaText,
    stats: {
      totalMatches:    data.totalMatches,
      totalKills:      data.totalKills,
      avgKills:        data.avgKills,
      wins:            data.wins,
      topTeams:        data.topTeams,
      topWeekTeams:    data.topWeekTeams,
      topWeekPlayers:  data.topWeekPlayers,
      bestKillMatch:   data.bestKillMatch ?? null,
      activeTournament:data.activeTournament ?? null,
    },
  }).catch(err => console.error('[iaBilan] Erreur sauvegarde BilanHebdo:', err));

  // ── Mise à jour de la date du dernier envoi ──────────────────────────────
  await IaConfig.findOneAndUpdate(
    { guildId },
    { bilanLastSentAt: new Date() },
    { upsert: true }
  ).catch(() => {});

  return true;
}

// ── Scheduler automatique (dimanche 20h30) ───────────────────────────────────
let bilanStarted = false;

function startIaBilanManager(client) {
  if (bilanStarted) return;
  bilanStarted = true;

  setInterval(async () => {
    try {
      const now = new Date();
      // Dimanche (0) à 20h30 (±1 minute)
      if (now.getDay() !== 0) return;
      if (now.getHours() !== 20 || now.getMinutes() !== 30) return;

      const configs = await IaConfig.find({ bilanChannelId: { $ne: null, $exists: true } }).lean();
      for (const cfg of configs) {
        if (!cfg.bilanChannelId) continue;
        // Anti-doublon : ne pas renvoyer si déjà envoyé dans la dernière heure
        if (cfg.bilanLastSentAt && (now - new Date(cfg.bilanLastSentAt)) < 60 * 60 * 1000) continue;
        await sendBilan(client, cfg.guildId, cfg.bilanChannelId);
      }
    } catch (err) {
      console.error('[iaBilan] Erreur planification:', err);
    }
  }, 60 * 1000);

  console.log('📋 Bilan IA hebdomadaire planifié (dimanche 20h30)');
}

module.exports = { startIaBilanManager, sendBilan };
