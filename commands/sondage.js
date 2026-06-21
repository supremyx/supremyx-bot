const Sondage     = require('../database/models/Sondage');
const SondageProg = require('../database/models/SondageProg');
const { EmbedBuilder } = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/parseDuration');

const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDateTime(str) {
  // Accepte : "JJ/MM HH:MM" ou "JJ/MM/AAAA HH:MM"
  const m = str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mn] = m;
  const year = yyyy ? parseInt(yyyy) : new Date().getFullYear();
  const date = new Date(year, parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(mn), 0, 0);
  if (isNaN(date.getTime())) return null;
  return date;
}

// ── Fermeture d'un sondage ────────────────────────────────────────────────────

async function closeSondage(client, sondageOrId) {
  try {
    const sondage = typeof sondageOrId === 'object'
      ? sondageOrId
      : await Sondage.findById(sondageOrId);
    if (!sondage || sondage.closed) return;

    const channel = client.channels.cache.get(sondage.channelId);
    if (!channel) return;

    const msg = await channel.messages.fetch(sondage.messageId).catch(() => null);
    if (!msg) return;

    const results = [];
    for (let i = 0; i < sondage.options.length; i++) {
      const reaction = msg.reactions.cache.get(NUMBER_EMOJIS[i]);
      const count = reaction ? Math.max(0, reaction.count - 1) : 0;
      results.push({ option: sondage.options[i], count });
    }
    results.sort((a, b) => b.count - a.count);
    const total = results.reduce((s, r) => s + r.count, 0);
    const winner = results[0];

    const resultEmbed = new EmbedBuilder()
      .setTitle(`📊 Résultats — ${sondage.question}`)
      .setColor(0x57F287)
      .setDescription(
        results.map((r, i) => {
          const bar = total > 0 ? Math.round((r.count / total) * 10) : 0;
          const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
          const prefix = i === 0 && r.count > 0 ? '🏆 ' : `${i + 1}. `;
          return `${prefix}**${r.option}** — ${r.count} vote(s) (${pct}%)\n${'█'.repeat(bar)}${'░'.repeat(10 - bar)}`;
        }).join('\n\n')
      )
      .addFields(
        { name: '🗳️ Total votes', value: `${total}`, inline: true },
        { name: '🏆 Gagnant', value: winner.count > 0 ? winner.option : 'Aucun vote', inline: true }
      )
      .setFooter({ text: `Sondage clôturé • Créé par ${sondage.createdBy}` })
      .setTimestamp();

    await msg.edit({ embeds: [resultEmbed] });
    sondage.closed = true;
    await sondage.save();
  } catch {
    // Silent fail
  }
}

// ── Commande principale ───────────────────────────────────────────────────────

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!sondage')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.slice('!sondage'.length).trim();

    // ══ !sondage (sans args) ══════════════════════════════════════════════════
    if (!args) {
      return message.reply(
        '**Sondage immédiat :**\n' +
        '`!sondage <durée> <question> | <opt1> | <opt2> | ...`\n' +
        'Ex : `!sondage 30m Quel jeu ce soir ? | Fortnite | Warzone | Apex`\n\n' +
        '**Sondage programmé :**\n' +
        '`!sondage programmer <question> | <opt1> | <opt2> | ... | <durée> | <JJ/MM HH:MM>`\n' +
        'Ex : `!sondage programmer Tournoi samedi ? | Oui | Non | 1h | 25/06 18:00`\n\n' +
        '**Gestion :**\n' +
        '`!sondage prog liste` — voir les sondages programmés\n' +
        '`!sondage prog annuler <n°>` — annuler un sondage programmé'
      );
    }

    if (!isStaff) return message.reply('❌ Staff uniquement.');

    const sub = args.split(' ')[0].toLowerCase();

    // ══ !sondage prog liste ════════════════════════════════════════════════════
    if (sub === 'prog') {
      const subArgs = args.slice(4).trim();
      const subSub  = subArgs.split(' ')[0].toLowerCase();

      if (subSub === 'liste') {
        const list = await SondageProg.find({ guildId: message.guild.id, launched: false })
          .sort({ scheduledAt: 1 }).limit(10);

        if (!list.length) {
          return message.reply('📭 Aucun sondage programmé en attente.');
        }

        const embed = new EmbedBuilder()
          .setTitle('📅 Sondages programmés')
          .setColor(0x5865F2)
          .setDescription(
            list.map((s, i) => {
              const dt = s.scheduledAt.toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', hour12: false });
              return `**${i + 1}.** ${s.question}\n   📌 ${s.options.join(' | ')} · ⏰ ${dt} · ⏳ ${formatDuration(s.durationMs)}`;
            }).join('\n\n')
          )
          .setFooter({ text: `${list.length} sondage(s) en attente` });

        return message.channel.send({ embeds: [embed] });
      }

      if (subSub === 'annuler') {
        const num = parseInt(subArgs.split(' ')[1]);
        const list = await SondageProg.find({ guildId: message.guild.id, launched: false })
          .sort({ scheduledAt: 1 });

        if (isNaN(num) || num < 1 || num > list.length) {
          return message.reply(`❌ Numéro invalide. Utilise \`!sondage prog liste\` pour voir les sondages.`);
        }

        const target = list[num - 1];
        await SondageProg.deleteOne({ _id: target._id });
        return message.reply(`✅ Sondage **"${target.question}"** annulé.`);
      }

      return message.reply('❌ Sous-commande inconnue. Utilise `prog liste` ou `prog annuler <n°>`.');
    }

    // ══ !sondage programmer ════════════════════════════════════════════════════
    if (sub === 'programmer') {
      const rest  = args.slice('programmer'.length).trim();
      const parts = rest.split('|').map(p => p.trim()).filter(Boolean);

      // Format : question | opt1 | opt2 | ... | durée | JJ/MM HH:MM
      // Minimum : question + 2 options + durée + date = 5 segments
      if (parts.length < 5) {
        return message.reply(
          '❌ Format invalide.\n' +
          '**Usage :** `!sondage programmer <question> | <opt1> | <opt2> | ... | <durée> | <JJ/MM HH:MM>`\n' +
          '**Ex :** `!sondage programmer Tournoi samedi ? | Oui | Non | 1h | 25/06 18:00`'
        );
      }

      const question  = parts[0];
      const dateStr   = parts[parts.length - 1];
      const durationStr = parts[parts.length - 2];
      const options   = parts.slice(1, parts.length - 2);

      if (options.length < 2) {
        return message.reply('❌ Il faut au moins 2 options.');
      }
      if (options.length > 8) {
        return message.reply('❌ Maximum 8 options.');
      }

      const durationMs = parseDuration(durationStr);
      if (!durationMs) {
        return message.reply(`❌ Durée invalide : \`${durationStr}\`. Ex: \`30m\`, \`1h\`, \`2h30m\``);
      }

      const scheduledAt = parseDateTime(dateStr);
      if (!scheduledAt) {
        return message.reply(`❌ Date invalide : \`${dateStr}\`. Format attendu : \`JJ/MM HH:MM\` ou \`JJ/MM/AAAA HH:MM\``);
      }
      if (scheduledAt <= new Date()) {
        return message.reply('❌ La date programmée doit être dans le futur.');
      }

      await SondageProg.create({
        guildId:     message.guild.id,
        channelId:   message.channel.id,
        question,
        options,
        scheduledAt,
        durationMs,
        createdBy:   message.author.tag
      });

      const dtStr = scheduledAt.toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', hour12: false });
      const delay = scheduledAt - new Date();
      const delayFmt = formatDuration(delay);

      const embed = new EmbedBuilder()
        .setTitle('📅 Sondage programmé !')
        .setColor(0xFEE75C)
        .addFields(
          { name: '❓ Question', value: question, inline: false },
          { name: '📌 Options', value: options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o}`).join('\n'), inline: true },
          { name: '⏰ Lancement', value: dtStr, inline: true },
          { name: '⏳ Durée du sondage', value: formatDuration(durationMs), inline: true },
          { name: '⌛ Dans', value: delayFmt, inline: true }
        )
        .setFooter({ text: `Programmé par ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ══ !sondage immédiat ══════════════════════════════════════════════════════
    const parts = args.split('|').map(p => p.trim()).filter(Boolean);

    const firstTokens = parts[0].split(' ');
    const durationStr  = firstTokens[0];
    const questionText = firstTokens.slice(1).join(' ').trim();
    const options      = parts.slice(1);

    const durationMs = parseDuration(durationStr);
    if (!durationMs) return message.reply('❌ Durée invalide. Ex: `30m`, `1h`, `2h30m`');
    if (!questionText) return message.reply('❌ Indique une question après la durée.');
    if (options.length < 2) return message.reply('❌ Il faut au moins 2 options séparées par `|`.');
    if (options.length > 8) return message.reply('❌ Maximum 8 options.');

    const endTime = new Date(Date.now() + durationMs);

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${questionText}`)
      .setColor(0x5865F2)
      .setDescription(options.map((o, i) => `${NUMBER_EMOJIS[i]} **${o}**`).join('\n'))
      .addFields({ name: '⏳ Durée', value: formatDuration(durationMs), inline: true })
      .setFooter({ text: `Sondage créé par ${message.author.tag} • Résultats à` })
      .setTimestamp(endTime);

    const sent = await message.channel.send({ embeds: [embed] });
    for (let i = 0; i < options.length; i++) {
      await sent.react(NUMBER_EMOJIS[i]).catch(() => {});
    }

    const sondage = await Sondage.create({
      guildId:   message.guild.id,
      channelId: message.channel.id,
      messageId: sent.id,
      question:  questionText,
      options,
      endTime,
      createdBy: message.author.tag
    });

    setTimeout(() => closeSondage(client, sondage._id), durationMs);
  });
};

module.exports.closeSondage = closeSondage;
