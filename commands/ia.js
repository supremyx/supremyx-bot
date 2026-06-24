const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const OpenAI = require('openai');
const IaConfig   = require('../database/models/IaConfig');
const IaUsage    = require('../database/models/IaUsage');
const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const PlayerStat = require('../database/models/PlayerStat');

let openrouter = null;
function getOpenRouter() {
  if (!openrouter) {
    if (!process.env.OPENROUTER_API_KEY) return null;
    openrouter = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://discord.com',
        'X-Title': 'SUPREMYX Bot',
      },
    });
  }
  return openrouter;
}

const MODELS = {
  'gpt-4o-mini':   { id: 'openai/gpt-4o-mini',                      label: 'GPT-4o Mini',       emoji: '🟢', desc: 'Rapide et efficace (défaut)' },
  'gpt-4o':        { id: 'openai/gpt-4o',                            label: 'GPT-4o',             emoji: '🔵', desc: 'Très puissant (OpenAI)' },
  'claude-haiku':  { id: 'anthropic/claude-3.5-haiku',               label: 'Claude 3.5 Haiku',  emoji: '🟣', desc: 'Rapide et précis (Anthropic)' },
  'claude-sonnet': { id: 'anthropic/claude-3.5-sonnet',              label: 'Claude 3.5 Sonnet', emoji: '🟤', desc: 'Très puissant (Anthropic)' },
  'gemini-flash':  { id: 'google/gemini-2.0-flash-exp:free',         label: 'Gemini 2.0 Flash',  emoji: '🔴', desc: 'Ultra rapide (Google) — gratuit' },
  'mistral':       { id: 'mistralai/mistral-7b-instruct:free',       label: 'Mistral 7B',         emoji: '⚪', desc: 'Open-source léger — gratuit' },
  'llama':         { id: 'meta-llama/llama-3.1-8b-instruct:free',    label: 'LLaMA 3.1 8B',      emoji: '🟡', desc: 'Open-source (Meta) — gratuit' },
};

const DEFAULT_MODEL = 'gpt-4o-mini';
const conversations = new Map();

async function getGuildModel(guildId) {
  const config = await IaConfig.findOne({ guildId });
  const alias = config?.model || DEFAULT_MODEL;
  return { alias, model: MODELS[alias] || MODELS[DEFAULT_MODEL] };
}

async function setGuildModel(guildId, alias) {
  await IaConfig.findOneAndUpdate(
    { guildId },
    { model: alias },
    { upsert: true, new: true }
  );
}

async function getDailyUsage(guildId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return IaUsage.countDocuments({ guildId, usedAt: { $gte: start } });
}

async function getQuota(guildId) {
  const config = await IaConfig.findOne({ guildId });
  return config?.dailyQuota ?? 0;
}

async function setQuota(guildId, quota) {
  await IaConfig.findOneAndUpdate(
    { guildId },
    { dailyQuota: quota },
    { upsert: true, new: true }
  );
}

async function setAlertChannel(guildId, channelId) {
  await IaConfig.findOneAndUpdate(
    { guildId },
    { quotaAlertChannelId: channelId },
    { upsert: true, new: true }
  );
}

async function checkAndNotifyQuota(guildId, used, quota, client) {
  if (!quota || quota === 0) return;

  const config = await IaConfig.findOne({ guildId });
  const channelId = config?.quotaAlertChannelId;
  if (!channelId) return;

  const channel = client.channels.cache.get(channelId);
  if (!channel) return;

  const pct = used / quota;
  const threshold80 = Math.ceil(quota * 0.8);

  if (used === threshold80 && quota > 1) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('⚠️ Quota IA — 80% atteint')
      .setDescription(`Le quota journalier de l'IA est à **${used}/${quota}** utilisations.\n\nIl reste **${quota - used}** utilisation(s) avant la coupure automatique.`)
      .addFields({ name: '📈 Progression', value: `[${'█'.repeat(8)}${'░'.repeat(2)}] 80%`, inline: false })
      .setFooter({ text: 'Admin : !ia quota <nombre> pour augmenter · !ia quota réinitialiser pour remettre à zéro' })
      .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
  } else if (used >= quota) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚨 Quota IA — 100% atteint')
      .setDescription(`Le quota journalier est **épuisé** (**${used}/${quota}** utilisations).\n\nL'IA est maintenant **coupée** jusqu'à minuit ou jusqu'à ce qu'un admin réinitialise le compteur.`)
      .addFields({ name: '📈 Progression', value: `[${'█'.repeat(10)}] 100%`, inline: false })
      .setFooter({ text: 'Admin : !ia quota réinitialiser pour remettre à zéro · !ia quota <nombre> pour changer la limite' })
      .setTimestamp();
    channel.send({ embeds: [embed] }).catch(() => {});
  }
}

module.exports = (client) => {

  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.content.startsWith('!ia')) return;

    const content = message.content.trim();
    const args = content.slice(3).trim().split(/\s+/);
    const sub = args[0]?.toLowerCase();

    // ── !ia modeles ────────────────────────────────────────────────────────────
    if (sub === 'modeles' || sub === 'modèles') {
      const { alias: current } = await getGuildModel(message.guild.id);
      const lines = Object.entries(MODELS).map(([alias, m]) => {
        const isCurrent = alias === current ? ' ← **actuel**' : '';
        return `${m.emoji} \`!ia modele ${alias}\` — **${m.label}** : ${m.desc}${isCurrent}`;
      });
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('🤖 Modèles IA disponibles')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Seuls les admins peuvent changer le modèle.' })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // ── !ia modele <alias> ─────────────────────────────────────────────────────
    if (sub === 'modele' || sub === 'modèle') {
      if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ Seuls les administrateurs peuvent changer le modèle IA.');
      }
      const alias = args[1]?.toLowerCase();
      if (!alias || !MODELS[alias]) {
        const list = Object.keys(MODELS).map(k => `\`${k}\``).join(', ');
        return message.reply(`❓ Modèle invalide. Choix disponibles : ${list}\nUtilise \`!ia modeles\` pour voir les détails.`);
      }
      await setGuildModel(message.guild.id, alias);
      conversations.clear();
      const m = MODELS[alias];
      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setTitle('✅ Modèle IA mis à jour')
        .setDescription(`Le modèle est maintenant **${m.label}** ${m.emoji}\n${m.desc}\n\n> Les historiques de conversation ont été réinitialisés.`)
        .setFooter({ text: `Changé par ${message.author.username}` })
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    // ── !ia réinitialiser ──────────────────────────────────────────────────────
    if (sub === 'réinitialiser' || sub === 'reinitialiser') {
      conversations.delete(message.author.id);
      const msg = await message.reply('🧹 Ton historique de conversation avec l\'IA a été effacé.');
      setTimeout(() => msg.delete().catch(() => {}), 5000);
      return;
    }

    // ── !ia statistiques ───────────────────────────────────────────────────────
    if (sub === 'statistiques') {
      const guildId = message.guild.id;
      const all = await IaUsage.find({ guildId }).lean();

      if (all.length === 0) {
        return message.reply('📊 Aucune utilisation de l\'IA enregistrée sur ce serveur pour l\'instant.');
      }

      // Top utilisateurs
      const userMap = new Map();
      for (const u of all) {
        userMap.set(u.username, (userMap.get(u.username) || 0) + 1);
      }
      const topUsers = [...userMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Répartition par modèle
      const modelMap = new Map();
      for (const u of all) {
        modelMap.set(u.modelAlias, (modelMap.get(u.modelAlias) || 0) + 1);
      }
      const modelLines = [...modelMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([alias, count]) => {
          const m = MODELS[alias];
          const pct = Math.round((count / all.length) * 100);
          return `${m ? m.emoji : '🤖'} **${m ? m.label : alias}** — ${count} fois (${pct}%)`;
        });

      // Activité 7 derniers jours
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent = all.filter(u => new Date(u.usedAt) >= sevenDaysAgo).length;

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const userLines = topUsers.map(([username, count], i) =>
        `${medals[i]} **${username}** — ${count} question${count > 1 ? 's' : ''}`
      );

      const { alias: currentAlias } = await getGuildModel(guildId);
      const currentModel = MODELS[currentAlias];

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: 'SUPREMYX IA · Statistiques', iconURL: client.user.displayAvatarURL() })
        .addFields(
          {
            name: '📊 Vue d\'ensemble',
            value: [
              `**Total questions :** ${all.length}`,
              `**7 derniers jours :** ${recent}`,
              `**Modèle actuel :** ${currentModel.emoji} ${currentModel.label}`,
            ].join('\n'),
            inline: false,
          },
          {
            name: '👑 Top utilisateurs',
            value: userLines.join('\n') || '—',
            inline: true,
          },
          {
            name: '🤖 Par modèle',
            value: modelLines.join('\n') || '—',
            inline: true,
          }
        )
        .setFooter({ text: `Statistiques du serveur ${message.guild.name}` })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ── !ia quota ─────────────────────────────────────────────────────────────
    if (sub === 'quota') {
      const guildId = message.guild.id;
      const val = args[1]?.toLowerCase();

      if (!val) {
        const [quota, used, config] = await Promise.all([getQuota(guildId), getDailyUsage(guildId), IaConfig.findOne({ guildId })]);

        // ── Barre de progression colorée (20 blocs) ──────────────────────────
        let color, statusLabel, barStr, pctStr, remainStr;

        if (quota === 0) {
          // Illimité
          color       = 0x57F287;
          statusLabel = '✅ Illimité';
          barStr      = '`' + '█'.repeat(20) + '` ∞';
          pctStr      = '∞';
          remainStr   = '∞ restantes';
        } else {
          const pct    = used / quota;
          const filled = Math.min(20, Math.round(pct * 20));
          barStr = '`' + '█'.repeat(filled) + '░'.repeat(20 - filled) + '`';
          pctStr = `${Math.round(pct * 100)} %`;
          const left = Math.max(0, quota - used);
          remainStr = left === 0 ? '**0** — épuisé ❌' : `**${left}** restante(s)`;

          if (pct < 0.5) {
            color = 0x57F287; statusLabel = '🟢 Libre';
          } else if (pct < 0.8) {
            color = 0xFEE75C; statusLabel = '🟡 Attention';
          } else if (pct < 1) {
            color = 0xF1840F; statusLabel = '🟠 Critique';
          } else {
            color = 0xED4245; statusLabel = '🔴 Épuisé';
          }
        }

        const limitText = quota === 0 ? '∞ illimité' : `${quota} / jour`;
        const alertCh   = config?.quotaAlertChannelId ? `<#${config.quotaAlertChannelId}>` : '❌ Non configuré';

        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle('📊 Quota IA — Aujourd\'hui')
          .setDescription(`${barStr}  **${pctStr}** — ${statusLabel}`)
          .addFields(
            { name: '⚡ Utilisé',           value: `**${used}**`,    inline: true },
            { name: '🔒 Limite / jour',     value: `**${limitText}**`, inline: true },
            { name: '🎯 Restant',           value: remainStr,          inline: true },
            { name: '🔔 Salon d\'alerte',   value: alertCh,            inline: false },
          )
          .setFooter({ text: 'Admin : !ia quota <nombre> · !ia quota désactiver · !ia quota réinitialiser · !ia quota salon #salon' })
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      if (!message.member?.permissions.has('Administrator')) {
        return message.reply('❌ Seuls les administrateurs peuvent modifier le quota IA.');
      }

      if (val === 'désactiver' || val === 'desactiver' || val === '0') {
        await setQuota(guildId, 0);
        return message.reply('✅ Quota IA **désactivé** — utilisation illimitée.');
      }

      if (val === 'réinitialiser' || val === 'reinitialiser') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const deleted = await IaUsage.deleteMany({ guildId, usedAt: { $gte: start } });
        return message.reply(`✅ Compteur journalier réinitialisé — **${deleted.deletedCount}** utilisation(s) effacée(s).`);
      }

      if (val === 'salon') {
        const mentioned = message.mentions.channels.first();
        if (!mentioned) {
          return message.reply('❌ Mentionne un salon textuel. Ex : `!ia quota salon #logs-admin`');
        }
        await setAlertChannel(guildId, mentioned.id);
        return message.reply(`✅ Salon d'alerte quota IA défini sur ${mentioned}.\nUne notification sera envoyée à **80%** et **100%** du quota journalier.`);
      }

      const n = parseInt(val, 10);
      if (isNaN(n) || n < 1) {
        return message.reply('❌ Valeur invalide. Utilise un nombre entier positif ou `désactiver`.\nEx : `!ia quota 50`');
      }
      await setQuota(guildId, n);
      return message.reply(`✅ Quota IA défini à **${n} utilisations par jour** pour ce serveur.`);
    }

    // ── Helpers IA contextuels ────────────────────────────────────────────────
    async function iaCall(systemPrompt, userPrompt, thinkingMsg) {
      const ai = getOpenRouter();
      if (!ai) { await thinkingMsg.edit('❌ Clé OpenRouter manquante.'); return null; }
      const guildId = message.guild.id;
      const [quota, used] = await Promise.all([getQuota(guildId), getDailyUsage(guildId)]);
      if (quota > 0 && used >= quota) {
        await thinkingMsg.edit(`❌ Quota journalier atteint (**${quota}** utilisations). Reviens demain ou demande à un admin d'augmenter la limite avec \`!ia quota <nombre>\`.`);
        return null;
      }
      const { model } = await getGuildModel(guildId);
      try {
        const res = await ai.chat.completions.create({
          model: model.id,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          max_tokens: 1024,
        });
        const { alias: usedAlias } = await getGuildModel(guildId);
        await IaUsage.create({ guildId, userId: message.author.id, username: message.author.username, modelAlias: usedAlias, commandType: sub || 'chat' }).catch(() => {});
        const newUsed = await getDailyUsage(guildId);
        checkAndNotifyQuota(guildId, newUsed, quota, client).catch(() => {});
        return res.choices[0]?.message?.content ?? 'Aucune réponse.';
      } catch (err) {
        console.error('[IA contextuell]', err);
        await thinkingMsg.edit('❌ Erreur IA. Réessaie dans un instant.');
        return null;
      }
    }

    // ── !ia analyser <équipe> ─────────────────────────────────────────────────
    if (sub === 'analyser') {
      const teamName = args.slice(1).join(' ').trim();
      if (!teamName) return message.reply('Usage : `!ia analyser <équipe>`');

      const thinking = await message.channel.send('🤖 Analyse en cours...');
      const team   = await Team.findOne({ name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!team) return thinking.edit(`❌ Équipe **${teamName}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(10);
      const n = matches.length || 1;
      const avgKills = (team.kills / n).toFixed(1);
      const avgPts   = (team.points / n).toFixed(1);
      const wr       = (team.wins + team.losses) > 0 ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(0) : 0;

      const context = `Équipe : ${team.name}\nPoints : ${team.points} | Kills : ${team.kills} | V/D : ${team.wins}/${team.losses} | Win rate : ${wr}%\nMoyenne/match : ${avgKills} kills, ${avgPts} pts\nDerniers matchs : ${matches.map(m => `#${m.placement} ${m.kills}k ${m.points}pts`).join(', ')}`;
      const answer  = await iaCall(
        'Tu es un analyste esport expert. Analyse les stats d\'une équipe de manière concise et professionnelle en français.',
        `Voici les stats de l\'équipe :\n${context}\n\nDonne une analyse en 3-4 points : forces, faiblesses, tendance actuelle.`,
        thinking
      );
      if (!answer) return;

      const embed = new EmbedBuilder().setColor(0xFF8C00)
        .setAuthor({ name: `🤖 Analyse IA — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Demandé par ${message.author.username}` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia predire <T1> <T2> ─────────────────────────────────────────────────
    if (sub === 'predire' || sub === 'prédire') {
      const rest  = args.slice(1).join(' ');
      const parts = rest.split(/ vs /i);
      if (parts.length < 2) return message.reply('Usage : `!ia predire <équipe1> vs <équipe2>`');

      const thinking = await message.channel.send('🤖 Prédiction en cours...');
      const esc = s => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [t1, t2] = await Promise.all([
        Team.findOne({ name: new RegExp(`^${esc(parts[0])}$`, 'i') }),
        Team.findOne({ name: new RegExp(`^${esc(parts[1])}$`, 'i') }),
      ]);
      if (!t1) return thinking.edit(`❌ Équipe **${parts[0].trim()}** introuvable.`);
      if (!t2) return thinking.edit(`❌ Équipe **${parts[1].trim()}** introuvable.`);

      const ctx = `T1: ${t1.name} — ${t1.points}pts, ${t1.kills}k, ${t1.wins}V/${t1.losses}D\nT2: ${t2.name} — ${t2.points}pts, ${t2.kills}k, ${t2.wins}V/${t2.losses}D`;
      const answer = await iaCall(
        'Tu es un analyste esport. Prédit le résultat d\'un match en te basant uniquement sur les stats fournies. Réponds en français, sois direct et argumente.',
        `Stats :\n${ctx}\n\nQui va gagner et pourquoi ? Donne une probabilité estimée.`,
        thinking
      );
      if (!answer) return;

      const embed = new EmbedBuilder().setColor(0x5865F2)
        .setAuthor({ name: `🔮 Prédiction IA — ${t1.name} vs ${t2.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Demandé par ${message.author.username} · Prédiction non garantie` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia conseil <équipe> ──────────────────────────────────────────────────
    if (sub === 'conseil') {
      const teamName = args.slice(1).join(' ').trim();
      if (!teamName) return message.reply('Usage : `!ia conseil <équipe>`');

      const thinking = await message.channel.send('🤖 Génération des conseils...');
      const team    = await Team.findOne({ name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!team) return thinking.edit(`❌ Équipe **${teamName}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(5);
      const n  = matches.length || 1;
      const wr = (team.wins + team.losses) > 0 ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(0) : 0;
      const ctx = `Équipe : ${team.name} | WR : ${wr}% | Moy kills : ${(team.kills/n).toFixed(1)} | Moy pts : ${(team.points/n).toFixed(1)}\nDerniers matchs : ${matches.map(m => `#${m.placement} ${m.kills}k`).join(', ')}`;

      const answer = await iaCall(
        'Tu es un coach esport professionnel. Donne des conseils actionables et précis basés sur les stats. Réponds en français.',
        `Stats :\n${ctx}\n\nDonne exactement 3 conseils concrets et spécifiques pour améliorer les performances de cette équipe.`,
        thinking
      );
      if (!answer) return;

      const embed = new EmbedBuilder().setColor(0xF1C40F)
        .setAuthor({ name: `💡 Conseils IA — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Demandé par ${message.author.username}` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia resume ────────────────────────────────────────────────────────────
    if (sub === 'resume' || sub === 'résumé') {
      const thinking = await message.channel.send('🤖 Rédaction du résumé...');
      const [tourn, topTeams, recentMatches] = await Promise.all([
        Tournament.findOne({ active: true }),
        Team.find().sort({ points: -1 }).limit(5),
        Match.find().sort({ createdAt: -1 }).limit(10),
      ]);

      const ranking = topTeams.map((t, i) => `#${i+1} ${t.name} (${t.points}pts, ${t.kills}k)`).join(', ');
      const recent  = recentMatches.map(m => `${m.team}: #${m.placement} ${m.kills}k ${m.points}pts`).join(', ');
      const ctx     = `Tournoi actif : ${tourn?.name ?? 'aucun'}\nClassement : ${ranking}\nDerniers matchs : ${recent}`;

      const answer = await iaCall(
        'Tu es le commentateur officiel de la communauté esport SUPREMYX CI. Tu rédiges des résumés dynamiques et enthousiastes en français, comme un vrai journaliste sportif.',
        `Voici les données actuelles :\n${ctx}\n\nRédige un résumé narratif dynamique du tournoi/compétition en cours (3-4 paragraphes).`,
        thinking
      );
      if (!answer) return;

      const embed = new EmbedBuilder().setColor(0xFF8C00)
        .setAuthor({ name: `📋 Résumé IA — ${tourn?.name ?? 'SUPREMYX'}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Résumé généré par IA · Demandé par ${message.author.username}` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia rapport <joueur> ─────────────────────────────────────────────────
    if (sub === 'rapport') {
      const cd = checkCooldown(message.author.id, 'ia-rapport', 30);
      if (cd) return replyCooldown(message, cd, 'ia-rapport');

      const playerName = args.slice(1).join(' ').trim();
      if (!playerName) return message.reply('Usage : `!ia rapport <nom_du_joueur>`');

      const guildId = message.guild.id;
      const stat    = await PlayerStat.findOne({
        guildId,
        displayName: new RegExp(`^${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (!stat) return message.reply(`❌ Joueur **${playerName}** introuvable sur ce serveur.`);

      const thinking = await message.channel.send(`🤖 Analyse du rapport de performance pour **${stat.displayName}**...`);

      const history = stat.history ?? [];
      const n       = stat.totalMatches || 1;
      const avgKills = (stat.totalKills / n).toFixed(2);

      // Top 3 meilleures performances
      const sorted  = [...history].sort((a, b) => b.kills - a.kills);
      const top3    = sorted.slice(0, 3).map(m =>
        `${m.kills} kills · #${m.teamPlacement}${m.tournamentName ? ` (${m.tournamentName})` : ''}`
      );

      // Top 3 pires performances
      const worst3  = sorted.slice(-3).reverse().map(m =>
        `${m.kills} kills · #${m.teamPlacement}${m.tournamentName ? ` (${m.tournamentName})` : ''}`
      );

      // Tendance récente (5 derniers vs 5 précédents)
      const recent  = history.slice(-5);
      const prev5   = history.slice(-10, -5);
      const recentAvg = recent.length  ? (recent.reduce((a, m) => a + m.kills, 0) / recent.length).toFixed(1) : 0;
      const prevAvg   = prev5.length   ? (prev5.reduce((a,   m) => a + m.kills, 0) / prev5.length).toFixed(1) : null;
      const trendText = prevAvg !== null
        ? `Moy 5 derniers : ${recentAvg} kills vs 5 précédents : ${prevAvg} kills`
        : `Moy 5 derniers matchs : ${recentAvg} kills`;

      // Constance (écart-type)
      const mean   = stat.totalKills / n;
      const stdDev = history.length > 1
        ? Math.sqrt(history.reduce((sum, m) => sum + Math.pow(m.kills - mean, 2), 0) / history.length).toFixed(1)
        : '—';

      // Tournois joués
      const tourneyCount = new Set(history.map(m => m.tournamentName).filter(Boolean)).size;

      const context = [
        `Joueur : ${stat.displayName} | Équipe : ${stat.teamName}`,
        `Matchs joués : ${stat.totalMatches} | Total kills : ${stat.totalKills} | Meilleur match : ${stat.bestKills} kills`,
        `Moyenne kills/match : ${avgKills} | Écart-type (constance) : ${stdDev}`,
        `Tournois disputés : ${tourneyCount}`,
        `Tendance : ${trendText}`,
        `Top 3 performances : ${top3.join(' / ') || '—'}`,
        `3 pires performances : ${worst3.join(' / ') || '—'}`,
      ].join('\n');

      const answer = await iaCall(
        'Tu es un coach esport professionnel qui rédige des rapports de performance détaillés et personnalisés pour des joueurs de gaming compétitif. Tu analyses les données statistiques de manière objective et bienveillante, en encourageant le joueur tout en étant honnête sur ses points faibles. Tu réponds exclusivement en français.',
        `Voici les données statistiques du joueur :\n${context}\n\nRédige un rapport de performance structuré avec les sections suivantes :\n1. 🎯 **Profil global** — résumé en 2-3 phrases\n2. 💪 **Points forts** — ce que le joueur fait bien\n3. 📉 **Axes d'amélioration** — ses faiblesses identifiées avec des données précises\n4. 🔥 **Pics de performance** — ses meilleurs matchs et ce qu'ils révèlent\n5. 📈 **Tendance actuelle** — progression ou régression récente\n6. 🎓 **Conseils personnalisés** — 2-3 recommandations concrètes`,
        thinking
      );
      if (!answer) return;

      // Découper si nécessaire (>4000 chars)
      const chunks = answer.match(/[\s\S]{1,3900}/g) ?? [answer];

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `📋 Rapport de performance — ${stat.displayName}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(chunks[0])
        .addFields(
          { name: '📊 Stats clés', value: [`🔫 **${stat.totalKills}** kills au total`, `⭐ Meilleur : **${stat.bestKills}** kills`, `📈 Moy : **${avgKills}** kills/match`].join('\n'), inline: true },
          { name: '🎮 Expérience', value: [`**${stat.totalMatches}** matchs joués`, `**${tourneyCount}** tournoi(s)`, `Constance : σ **${stdDev}**`].join('\n'), inline: true },
        )
        .setFooter({ text: `Rapport IA · Équipe ${stat.teamName} · Demandé par ${message.author.username}` })
        .setTimestamp();

      await thinking.edit({ content: '', embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        await message.channel.send({
          embeds: [new EmbedBuilder().setColor(0xFF8C00).setDescription(chunks[i])],
        });
      }
      return;
    }

    // ── !ia historique <joueur> ───────────────────────────────────────────────
    if (sub === 'historique') {
      const cd = checkCooldown(message.author.id, 'ia-historique', 10);
      if (cd) return replyCooldown(message, cd, 'ia-historique');

      const playerName = args.slice(1).join(' ').trim();
      if (!playerName) return message.reply('Usage : `!ia historique <nom_du_joueur>`');

      const guildId = message.guild.id;
      const stat    = await PlayerStat.findOne({
        guildId,
        displayName: new RegExp(`^${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });

      if (!stat) return message.reply(`❌ Joueur **${playerName}** introuvable sur ce serveur.`);

      const history = [...stat.history].reverse(); // du plus récent au plus ancien
      const PER_PAGE = 10;
      const totalPages = Math.max(1, Math.ceil(history.length / PER_PAGE));

      if (!history.length) {
        return message.reply(`❌ **${stat.displayName}** n'a aucun match dans son historique.`);
      }

      const buildEmbed = (page) => {
        const slice  = history.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
        const avgKills = stat.totalMatches > 0 ? (stat.totalKills / stat.totalMatches).toFixed(2) : '0.00';

        const lines = slice.map((m, i) => {
          const idx     = page * PER_PAGE + i + 1;
          const dateStr = m.date
            ? new Date(m.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';
          const tourn = m.tournamentName ? ` · *${m.tournamentName}*` : '';
          const killEmoji = m.kills >= 10 ? '🔥' : m.kills >= 5 ? '⭐' : '•';
          return `\`${String(idx).padStart(3)}\` ${killEmoji} **${m.kills}** kills · #${m.teamPlacement}${tourn} · ${dateStr}`;
        });

        return new EmbedBuilder()
          .setColor(0xFF8C00)
          .setAuthor({
            name: `📜 Historique — ${stat.displayName} (${stat.teamName})`,
            iconURL: client.user.displayAvatarURL(),
          })
          .setDescription(lines.join('\n'))
          .addFields(
            { name: '🔫 Total kills',   value: `**${stat.totalKills}**`,           inline: true },
            { name: '⭐ Meilleur match', value: `**${stat.bestKills}** kills`,       inline: true },
            { name: '📊 Moy. kills',    value: `**${avgKills}** / match`,           inline: true },
          )
          .setFooter({ text: `Page ${page + 1}/${totalPages} · ${history.length} match(s) au total · SUPREMYX Esports` })
          .setTimestamp();
      };

      const buildRow = (page, disabled = false) => new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('hist_prev')
          .setLabel('◀ Précédent')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === 0),
        new ButtonBuilder()
          .setCustomId('hist_next')
          .setLabel('Suivant ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page >= totalPages - 1),
        new ButtonBuilder()
          .setCustomId('hist_first')
          .setLabel('⏮ Début')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page === 0),
        new ButtonBuilder()
          .setCustomId('hist_last')
          .setLabel('Fin ⏭')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled || page >= totalPages - 1),
      );

      let currentPage = 0;
      const msg = await message.channel.send({
        embeds: [buildEmbed(currentPage)],
        components: totalPages > 1 ? [buildRow(currentPage)] : [],
      });

      if (totalPages <= 1) return;

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === message.author.id,
        time: 60_000,
      });

      collector.on('collect', async interaction => {
        if (interaction.customId === 'hist_prev')  currentPage = Math.max(0, currentPage - 1);
        if (interaction.customId === 'hist_next')  currentPage = Math.min(totalPages - 1, currentPage + 1);
        if (interaction.customId === 'hist_first') currentPage = 0;
        if (interaction.customId === 'hist_last')  currentPage = totalPages - 1;

        await interaction.update({
          embeds: [buildEmbed(currentPage)],
          components: [buildRow(currentPage)],
        });
      });

      collector.on('end', () => {
        msg.edit({ components: [buildRow(currentPage, true)] }).catch(() => {});
      });

      return;
    }

    // ── !ia entrainement <équipe> ─────────────────────────────────────────────
    if (sub === 'entrainement' || sub === 'entraînement') {
      const teamName = args.slice(1).join(' ').trim();
      if (!teamName) return message.reply('Usage : `!ia entrainement <équipe>`');
      const thinking = await message.channel.send('🤖 Génération du plan d\'entraînement...');
      const team = await Team.findOne({ name: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!team) return thinking.edit(`❌ Équipe **${teamName}** introuvable.`);
      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(10);
      const n = matches.length || 1;
      const avgKills = (team.kills / n).toFixed(1);
      const avgPts   = (team.points / n).toFixed(1);
      const wr       = (team.wins + team.losses) > 0 ? ((team.wins / (team.wins + team.losses)) * 100).toFixed(0) : 0;
      const ctx = `Équipe : ${team.name} | WR : ${wr}% | Kills/match : ${avgKills} | Points/match : ${avgPts} | Matchs joués : ${n}\nDerniers matchs : ${matches.map(m => `#${m.placement} ${m.kills}k ${m.points}pts`).join(', ')}`;
      const answer = await iaCall(
        'Tu es un coach esport professionnel spécialisé dans les jeux de battle royale compétitif. Tu crées des plans d\'entraînement personnalisés basés sur les statistiques réelles. Tu réponds en français.',
        `Stats de l\'équipe :\n${ctx}\n\nCrée un plan d\'entraînement sur 1 semaine adapté à ces stats. Identifie les points faibles (ex: placements, agressivité, constance) et propose des exercices spécifiques pour chaque problème. Structure : Lundi à Dimanche avec un focus différent chaque jour.`,
        thinking
      );
      if (!answer) return;
      const embed = new EmbedBuilder().setColor(0x57F287)
        .setAuthor({ name: `🏋️ Plan d\'entraînement IA — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Demandé par ${message.author.username} · Basé sur ${n} matchs` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia strategie <T1> vs <T2> ────────────────────────────────────────────
    if (sub === 'strategie' || sub === 'stratégie') {
      const rest = args.slice(1).join(' ');
      const parts = rest.split(/ vs /i);
      if (parts.length < 2) return message.reply('Usage : `!ia strategie <mon équipe> vs <équipe adverse>`');
      const thinking = await message.channel.send('🤖 Analyse tactique en cours...');
      const esc = s => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [t1, t2] = await Promise.all([
        Team.findOne({ name: new RegExp(`^${esc(parts[0])}$`, 'i') }),
        Team.findOne({ name: new RegExp(`^${esc(parts[1])}$`, 'i') }),
      ]);
      if (!t1) return thinking.edit(`❌ Équipe **${parts[0].trim()}** introuvable.`);
      if (!t2) return thinking.edit(`❌ Équipe **${parts[1].trim()}** introuvable.`);
      const m1 = await Match.find({ team: t1.name }).sort({ createdAt: -1 }).limit(5);
      const m2 = await Match.find({ team: t2.name }).sort({ createdAt: -1 }).limit(5);
      const ctx = `MON ÉQUIPE — ${t1.name} : ${t1.points}pts, ${t1.kills}k, ${t1.wins}V/${t1.losses}D\nForme : ${m1.map(m => `#${m.placement} ${m.kills}k`).join(', ')}\n\nADVERSAIRE — ${t2.name} : ${t2.points}pts, ${t2.kills}k, ${t2.wins}V/${t2.losses}D\nForme : ${m2.map(m => `#${m.placement} ${m.kills}k`).join(', ')}`;
      const answer = await iaCall(
        'Tu es un stratège esport expert en battle royale. Tu analyses les forces et faiblesses de deux équipes et tu proposes une stratégie concrète pour battre l\'adversaire. Tu réponds en français.',
        `Données :\n${ctx}\n\nPropose une stratégie complète pour que **${t1.name}** batte **${t2.name}** : comment exploiter leurs faiblesses, quels playstyles adopter, axes de jeu prioritaires. Sois précis et actionnable.`,
        thinking
      );
      if (!answer) return;
      const embed = new EmbedBuilder().setColor(0xED4245)
        .setAuthor({ name: `⚔️ Stratégie IA — ${t1.name} contre ${t2.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Demandé par ${message.author.username} · Analyse non garantie` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia bilan [saison] ────────────────────────────────────────────────────
    if (sub === 'bilan') {
      const thinking = await message.channel.send('🤖 Rédaction du bilan en cours...');
      const [tourn, topTeams, allMatches] = await Promise.all([
        Tournament.findOne({ active: true }),
        Team.find().sort({ points: -1 }).limit(10),
        Match.find().sort({ createdAt: -1 }).limit(50),
      ]);
      const teamStats = topTeams.map(t => {
        const ms = allMatches.filter(m => m.team === t.name);
        const avgK = ms.length ? (ms.reduce((s, m) => s + m.kills, 0) / ms.length).toFixed(1) : '0';
        return `${t.name}: ${t.points}pts, ${t.kills}k totaux, moy ${avgK}k/match, ${t.wins}V/${t.losses}D`;
      }).join('\n');
      const ctx = `Tournoi : ${tourn?.name ?? 'aucun actif'}\nNombre de matchs analysés : ${allMatches.length}\nClassement :\n${teamStats}`;
      const answer = await iaCall(
        'Tu es le journaliste sportif officiel de SUPREMYX CI. Tu rédiges des bilans de saison complets et engageants, comme un vrai journal sportif. Tu analyses les performances, identifies les surprises, les déceptions et les équipes en progression. Tu réponds en français.',
        `Données de la compétition :\n${ctx}\n\nRédige un bilan complet de la saison/tournoi avec : 1) Faits marquants, 2) Équipes en progression, 3) Surprises et déceptions, 4) Records notables, 5) Pronostic pour la suite.`,
        thinking
      );
      if (!answer) return;
      const embed = new EmbedBuilder().setColor(0xFEE75C)
        .setAuthor({ name: `📰 Bilan IA — ${tourn?.name ?? 'Saison courante'}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Bilan généré par IA · Demandé par ${message.author.username}` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia scouting <joueur> ─────────────────────────────────────────────────
    if (sub === 'scouting') {
      const playerName = args.slice(1).join(' ').trim();
      if (!playerName) return message.reply('Usage : `!ia scouting <nom_du_joueur>`');
      const guildId = message.guild.id;
      const stat = await PlayerStat.findOne({ guildId, displayName: new RegExp(`^${playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!stat) return message.reply(`❌ Joueur **${playerName}** introuvable.`);
      const thinking = await message.channel.send(`🤖 Rapport de scouting pour **${stat.displayName}** en cours...`);
      const n = stat.totalMatches || 1;
      const avgK = (stat.totalKills / n).toFixed(2);
      const recent = (stat.history ?? []).slice(-5);
      const avgRecent = recent.length ? (recent.reduce((s, m) => s + m.kills, 0) / recent.length).toFixed(1) : '—';
      const ctx = `Joueur : ${stat.displayName} | Équipe : ${stat.teamName ?? 'free agent'}\nMatchs : ${stat.totalMatches} | Kills totaux : ${stat.totalKills} | Meilleur : ${stat.bestKills}k\nMoyenne générale : ${avgK}k/match | Moy 5 derniers : ${avgRecent}k/match`;
      const answer = await iaCall(
        'Tu es un recruteur esport professionnel. Tu rédiges des fiches de scouting concises pour évaluer si un joueur mérite d\'être recruté dans une équipe compétitive. Tu évalues le potentiel, la régularité et la valeur de marché. Tu réponds en français.',
        `Données du joueur :\n${ctx}\n\nRédige une fiche de scouting avec : 1) Profil synthétique, 2) Points forts pour le recrutement, 3) Risques/points faibles, 4) Recommandation finale (Recruter/Observer/Passer) avec justification.`,
        thinking
      );
      if (!answer) return;
      const embed = new EmbedBuilder().setColor(0x5865F2)
        .setAuthor({ name: `🔍 Scouting IA — ${stat.displayName}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer).setTimestamp()
        .setFooter({ text: `Équipe : ${stat.teamName ?? 'free agent'} · Demandé par ${message.author.username}` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia debriefing ────────────────────────────────────────────────────────
    if (sub === 'debriefing') {
      const { setDebriefChannel, clearDebriefChannel, getDebriefChannelId } = require('../utils/iaDebrief');
      const arg1 = args[1]?.toLowerCase();

      // !ia debriefing salon #salon ─ configure le canal auto (admin)
      if (arg1 === 'salon') {
        if (!message.member?.permissions.has('Administrator'))
          return message.reply('⛔ Réservé aux administrateurs.');
        const channel = message.mentions.channels.first() ||
          (args[2] ? message.guild.channels.cache.get(args[2]) : null);
        if (!channel) return message.reply('Usage : `!ia debriefing salon #salon`');
        await setDebriefChannel(message.guild.id, channel.id);
        return message.reply(`✅ Les débriefs IA automatiques seront postés dans <#${channel.id}> après chaque \`!resultats\`.`);
      }

      // !ia debriefing desactiver ─ désactive le canal auto (admin)
      if (arg1 === 'desactiver' || arg1 === 'désactiver') {
        if (!message.member?.permissions.has('Administrator'))
          return message.reply('⛔ Réservé aux administrateurs.');
        await clearDebriefChannel(message.guild.id);
        return message.reply('✅ Débriefs IA automatiques désactivés.');
      }

      // !ia debriefing statut ─ affiche la configuration
      if (arg1 === 'statut') {
        const channelId = await getDebriefChannelId(message.guild.id);
        const statusLine = channelId
          ? `✅ **Actif** — débrief posté dans <#${channelId}> après chaque \`!resultats\``
          : '❌ **Désactivé** — aucun salon configuré';
        const cfgEmbed = new EmbedBuilder()
          .setColor(channelId ? 0x57F287 : 0xED4245)
          .setTitle('🤖 Débrief IA automatique — Configuration')
          .setDescription(statusLine)
          .addFields({
            name: '⚙️ Commandes',
            value: '`!ia debriefing salon #salon` — Activer et choisir le canal *(Admin)*\n`!ia debriefing desactiver` — Désactiver *(Admin)*',
          })
          .setTimestamp();
        return message.reply({ embeds: [cfgEmbed] });
      }

      // !ia debriefing <équipe> ─ génère un débrief maintenant
      const teamName = args.slice(1).join(' ').trim();
      if (!teamName) return message.reply(
        '**Usage `!ia debriefing` :**\n' +
        '`!ia debriefing <équipe>` — Débrief du dernier match enregistré\n' +
        '`!ia debriefing salon #salon` — Configurer le salon auto *(Admin)*\n' +
        '`!ia debriefing desactiver` — Désactiver le débrief auto *(Admin)*\n' +
        '`!ia debriefing statut` — Voir la configuration'
      );

      const cd = checkCooldown(message.author.id, 'ia-debriefing', 30);
      if (cd) return replyCooldown(message, cd, 'debriefing');

      const thinking = await message.channel.send('🤖 Génération du débrief post-match...');
      const esc = s => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const team = await Team.findOne({ name: new RegExp(`^${esc(teamName)}$`, 'i') });
      if (!team) return thinking.edit(`❌ Équipe **${teamName}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(5);
      if (!matches.length)
        return thinking.edit(`❌ Aucun match enregistré pour **${team.name}**. Enregistre des résultats d'abord avec \`!resultats\`.`);

      const lastMatch = matches[0];
      const n = matches.length;
      const avgKills     = (matches.reduce((s, m) => s + m.kills, 0) / n).toFixed(1);
      const avgPoints    = (matches.reduce((s, m) => s + m.points, 0) / n).toFixed(1);
      const avgPlacement = (matches.reduce((s, m) => s + m.placement, 0) / n).toFixed(1);
      const lastDate     = new Date(lastMatch.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const historyStr   = matches.map((m, i) =>
        `  ${i === 0 ? '→' : ' '} ${i === 0 ? 'Dernier' : `J-${i}`} : #${m.placement} | ${m.kills}k | ${m.points}pts`
      ).join('\n');

      const ctx = [
        `Équipe : ${team.name}`,
        `Dernier match (${lastDate}) : Placement #${lastMatch.placement} | ${lastMatch.kills} kills | ${lastMatch.points} pts`,
        `Bilan global : ${team.wins}V / ${team.losses}D | ${team.points} pts totaux`,
        `Moyennes sur ${n} matchs : placement #${avgPlacement} | ${avgKills}k | ${avgPoints}pts`,
        `Historique récent :\n${historyStr}`,
        lastMatch.tournamentName ? `Tournoi : ${lastMatch.tournamentName}` : '',
      ].filter(Boolean).join('\n');

      const answer = await iaCall(
        'Tu es un coach esport professionnel spécialisé dans les jeux Battle Royale et de tir compétitif. Tu rédiges des débriefs post-match détaillés, constructifs et motivants pour des équipes. Tu réponds toujours en français, avec un ton dynamique et professionnel. Sois précis, concis et actionable.',
        `Données du dernier match et historique récent :\n${ctx}\n\nRédige un débrief post-match structuré en 4 parties :\n1) **📊 Résultat & Analyse** — contexte du match, résultat objectif\n2) **✅ Points positifs** — ce qui a fonctionné, à conserver\n3) **⚠️ Points à améliorer** — axes de progression concrets basés sur les stats\n4) **🎯 Objectifs prochain match** — 2-3 actions précises et mesurables à mettre en place`,
        thinking
      );
      if (!answer) return;

      const placementEmoji = lastMatch.placement === 1 ? '🥇' : lastMatch.placement <= 3 ? '🥈' : lastMatch.placement <= 5 ? '🏅' : '📊';
      const embedColor     = lastMatch.placement === 1 ? 0x57F287 : lastMatch.placement <= 3 ? 0xFEE75C : 0xFF8C00;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: `${placementEmoji} Débrief IA — ${team.name}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(answer)
        .addFields({
          name: '📈 Dernière performance',
          value: `**Placement :** #${lastMatch.placement} · **Kills :** ${lastMatch.kills} · **Points :** +${lastMatch.points}${lastMatch.tournamentName ? ` · *${lastMatch.tournamentName}*` : ''}`,
          inline: false
        })
        .setTimestamp()
        .setFooter({ text: `Débrief généré par IA · Demandé par ${message.author.username}` });
      return thinking.edit({ content: '', embeds: [embed] });
    }

    // ── !ia <question> ─────────────────────────────────────────────────────────
    if (!content.startsWith('!ia ') && content !== '!ia') return;

    const question = content.slice(4).trim();
    if (!question) {
      const list = Object.keys(MODELS).map(k => `\`${k}\``).join(', ');
      return message.reply(
        '❓ Utilisation : `!ia <ta question>`\n' +
        'Exemple : `!ia Qui est le meilleur joueur de l\'équipe ?`\n\n' +
        `🤖 Modèles : \`!ia modeles\` · Stats : \`!ia statistiques\` · Changer (admin) : \`!ia modele <nom>\`\n` +
        `Modèles disponibles : ${list}`
      );
    }

    const cd = checkCooldown(message.author.id, 'ia', 15);
    if (cd) return replyCooldown(message, cd, 'ia');

    const thinking = await message.channel.send('🤖 Réflexion en cours...');

    const client_ai = getOpenRouter();
    if (!client_ai) {
      return thinking.edit('❌ La fonctionnalité IA n\'est pas configurée (clé OpenRouter manquante).');
    }

    const guildId = message.guild.id;
    const [quotaMain, usedMain] = await Promise.all([getQuota(guildId), getDailyUsage(guildId)]);
    if (quotaMain > 0 && usedMain >= quotaMain) {
      return thinking.edit(`❌ Quota journalier atteint (**${quotaMain}** utilisations). Reviens demain ou demande à un admin d'augmenter la limite avec \`!ia quota <nombre>\`.`);
    }

    const { alias: modelAlias, model } = await getGuildModel(guildId);

    try {
      const userId = message.author.id;
      if (!conversations.has(userId)) {
        // Evict oldest conversation if the Map grows too large (memory guard)
        if (conversations.size >= 200) {
          const oldestKey = conversations.keys().next().value;
          conversations.delete(oldestKey);
        }
        conversations.set(userId, [
          {
            role: 'system',
            content: `Tu es SUPREMYX, un assistant IA intégré au bot Discord de la communauté gaming SUPREMYX CI (Côte d'Ivoire). Tu aides les joueurs et les admins avec des questions sur les tournois, les équipes, les stats, les règles du serveur et tout sujet gaming. Tu réponds toujours en français, de façon concise et dynamique. Tu connais les concepts de jeux compétitifs, l'esport, et la gestion de communautés Discord.`
          }
        ]);
      }

      const history = conversations.get(userId);
      history.push({ role: 'user', content: question });
      if (history.length > 21) history.splice(1, history.length - 21);

      const response = await client_ai.chat.completions.create({
        model: model.id,
        messages: history,
        max_tokens: 1024,
      });

      const answer = response.choices[0]?.message?.content || 'Aucune réponse obtenue.';
      history.push({ role: 'assistant', content: answer });

      // Enregistrer l'utilisation et vérifier le quota
      await IaUsage.create({
        guildId:     guildId,
        userId:      message.author.id,
        username:    message.author.username,
        modelAlias,
        commandType: 'chat',
      }).catch(err => console.error('[IA] Erreur tracking:', err));
      const newUsedMain = await getDailyUsage(guildId);
      checkAndNotifyQuota(guildId, newUsedMain, quotaMain, client).catch(() => {});

      const chunks = answer.match(/[\s\S]{1,4000}/g) || [answer];

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `SUPREMYX IA · ${model.emoji} ${model.label}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(chunks[0])
        .setFooter({ text: `Demandé par ${message.author.username} · !ia réinitialiser pour effacer l'historique` })
        .setTimestamp();

      await thinking.edit({ content: '', embeds: [embed] });

      for (let i = 1; i < chunks.length; i++) {
        const followUp = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setDescription(chunks[i]);
        await message.channel.send({ embeds: [followUp] });
      }

    } catch (err) {
      console.error('[IA] Erreur OpenRouter:', err);
      await thinking.edit('❌ Une erreur est survenue avec l\'IA. Vérifie que la clé API OpenRouter est valide.');
    }
  });
};
