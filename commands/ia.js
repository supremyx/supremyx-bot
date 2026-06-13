const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const OpenAI = require('openai');
const IaConfig   = require('../database/models/IaConfig');
const IaUsage    = require('../database/models/IaUsage');
const Team       = require('../database/models/Team');
const Match      = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');

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

    // ── Helpers IA contextuels ────────────────────────────────────────────────
    async function iaCall(systemPrompt, userPrompt, thinkingMsg) {
      const ai = getOpenRouter();
      if (!ai) { await thinkingMsg.edit('❌ Clé OpenRouter manquante.'); return null; }
      const { model } = await getGuildModel(message.guild.id);
      try {
        const res = await ai.chat.completions.create({
          model: model.id,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          max_tokens: 1024,
        });
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

    const { alias: modelAlias, model } = await getGuildModel(message.guild.id);

    try {
      const userId = message.author.id;
      if (!conversations.has(userId)) {
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

      // Enregistrer l'utilisation
      IaUsage.create({
        guildId:    message.guild.id,
        userId:     message.author.id,
        username:   message.author.username,
        modelAlias,
      }).catch(err => console.error('[IA] Erreur tracking:', err));

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
