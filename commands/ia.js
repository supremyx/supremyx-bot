const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');
const OpenAI = require('openai');
const IaConfig = require('../database/models/IaConfig');

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

    if (sub === 'reset') {
      conversations.delete(message.author.id);
      const msg = await message.reply('🧹 Ton historique de conversation avec l\'IA a été effacé.');
      setTimeout(() => msg.delete().catch(() => {}), 5000);
      return;
    }

    if (!content.startsWith('!ia ') && content !== '!ia') return;

    const question = content.slice(4).trim();
    if (!question) {
      const list = Object.keys(MODELS).map(k => `\`${k}\``).join(', ');
      return message.reply(
        '❓ Utilisation : `!ia <ta question>`\n' +
        'Exemple : `!ia Qui est le meilleur joueur de l\'équipe ?`\n\n' +
        `🤖 Modèles : \`!ia modeles\` · Changer (admin) : \`!ia modele <nom>\`\n` +
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

    const { model } = await getGuildModel(message.guild.id);

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

      if (history.length > 21) {
        history.splice(1, history.length - 21);
      }

      const response = await client_ai.chat.completions.create({
        model: model.id,
        messages: history,
        max_tokens: 1024,
      });

      const answer = response.choices[0]?.message?.content || 'Aucune réponse obtenue.';
      history.push({ role: 'assistant', content: answer });

      const chunks = answer.match(/[\s\S]{1,4000}/g) || [answer];

      const embed = new EmbedBuilder()
        .setColor(0xFF8C00)
        .setAuthor({ name: `SUPREMYX IA · ${model.emoji} ${model.label}`, iconURL: client.user.displayAvatarURL() })
        .setDescription(chunks[0])
        .setFooter({ text: `Demandé par ${message.author.username} · !ia reset pour effacer l'historique` })
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
