const OpenAI        = require('openai');
const { EmbedBuilder } = require('discord.js');
const IaConfig      = require('../database/models/IaConfig');
const IaUsage       = require('../database/models/IaUsage');
const Match         = require('../database/models/Match');

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

let _aiClient = null;
function getAI() {
  if (!_aiClient) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    _aiClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://discord.com',
        'X-Title': 'SUPREMYX Bot',
      },
    });
  }
  return _aiClient;
}

async function setDebriefChannel(guildId, channelId) {
  await IaConfig.findOneAndUpdate({ guildId }, { debriefChannelId: channelId }, { upsert: true });
}

async function clearDebriefChannel(guildId) {
  await IaConfig.findOneAndUpdate({ guildId }, { debriefChannelId: null }, { upsert: true });
}

async function getDebriefChannelId(guildId) {
  const cfg = await IaConfig.findOne({ guildId });
  return cfg?.debriefChannelId || null;
}

async function autoDebrief(client, guildId, teamName) {
  try {
    const cfg = await IaConfig.findOne({ guildId });
    const channelId = cfg?.debriefChannelId;
    if (!channelId) return;

    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    const ai = getAI();
    if (!ai) return;

    const quota = cfg?.dailyQuota ?? 0;
    if (quota > 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const used = await IaUsage.countDocuments({ guildId, usedAt: { $gte: start } });
      if (used >= quota) return;
    }

    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = await Match.find({
      team: new RegExp(`^${esc(teamName)}$`, 'i'),
    }).sort({ createdAt: -1 }).limit(5);
    if (!matches.length) return;

    const lastMatch    = matches[0];
    const n            = matches.length;
    const avgKills     = (matches.reduce((s, m) => s + m.kills, 0) / n).toFixed(1);
    const avgPoints    = (matches.reduce((s, m) => s + m.points, 0) / n).toFixed(1);
    const avgPlacement = (matches.reduce((s, m) => s + m.placement, 0) / n).toFixed(1);
    const lastDate     = new Date(lastMatch.createdAt).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const historyStr = matches.map((m, i) =>
      `  ${i === 0 ? '→' : ' '} ${i === 0 ? 'Dernier' : `J-${i}`} : #${m.placement} | ${m.kills}k | ${m.points}pts`
    ).join('\n');

    const ctx = [
      `Équipe : ${teamName}`,
      `Dernier match (${lastDate}) : Placement #${lastMatch.placement} | ${lastMatch.kills} kills | ${lastMatch.points} pts`,
      `Moyennes sur ${n} matchs : placement #${avgPlacement} | ${avgKills}k | ${avgPoints}pts`,
      `Historique récent :\n${historyStr}`,
      lastMatch.tournamentName ? `Tournoi : ${lastMatch.tournamentName}` : '',
    ].filter(Boolean).join('\n');

    const modelAlias = cfg?.model || DEFAULT_MODEL;
    const modelId    = MODEL_IDS[modelAlias] || MODEL_IDS[DEFAULT_MODEL];

    const res = await ai.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: 'Tu es un coach esport professionnel spécialisé dans les jeux Battle Royale et de tir compétitif. Tu rédiges des débriefs post-match détaillés, constructifs et motivants pour des équipes. Tu réponds toujours en français, avec un ton dynamique et professionnel. Sois précis, concis et actionable.',
        },
        {
          role: 'user',
          content: `Données du dernier match et historique récent :\n${ctx}\n\nRédige un débrief post-match structuré en 4 parties :\n1) **📊 Résultat & Analyse** — contexte du match, résultat objectif\n2) **✅ Points positifs** — ce qui a fonctionné, à conserver\n3) **⚠️ Points à améliorer** — axes de progression concrets basés sur les stats\n4) **🎯 Objectifs prochain match** — 2-3 actions précises et mesurables à mettre en place`,
        },
      ],
      max_tokens: 1024,
    });

    const answer = res.choices[0]?.message?.content;
    if (!answer) return;

    await IaUsage.create({
      guildId,
      userId:      'auto',
      username:    'AutoDebrief',
      modelAlias,
      commandType: 'debrief-auto',
      usedAt:      new Date(),
    }).catch(() => {});

    const placementEmoji = lastMatch.placement === 1 ? '🥇' : lastMatch.placement <= 3 ? '🥈' : lastMatch.placement <= 5 ? '🏅' : '📊';
    const embedColor     = lastMatch.placement === 1 ? 0x57F287 : lastMatch.placement <= 3 ? 0xFEE75C : 0xFF8C00;

    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setAuthor({ name: `${placementEmoji} Débrief IA automatique — ${teamName}`, iconURL: client.user.displayAvatarURL() })
      .setDescription(answer)
      .addFields({
        name:   '📈 Dernière performance',
        value:  `**Placement :** #${lastMatch.placement} · **Kills :** ${lastMatch.kills} · **Points :** +${lastMatch.points}${lastMatch.tournamentName ? ` · *${lastMatch.tournamentName}*` : ''}`,
        inline: false,
      })
      .setTimestamp()
      .setFooter({ text: 'Débrief automatique · Généré par IA après enregistrement des résultats' });

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[autoDebrief:${teamName}]`, err?.message || err);
  }
}

module.exports = { autoDebrief, setDebriefChannel, clearDebriefChannel, getDebriefChannelId };
