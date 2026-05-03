const Sondage = require('../database/models/Sondage');
const { EmbedBuilder } = require('discord.js');
const { parseDuration, formatDuration } = require('../utils/parseDuration');

const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!sondage')) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.slice('!sondage'.length).trim();
    const parts = args.split('|').map(p => p.trim()).filter(Boolean);

    // --- !sondage (no args) → help
    if (!args) {
      return message.reply(
        '**Usage :** `!sondage <durée> <question> | <opt1> | <opt2> | ...`\n' +
        '**Exemple :** `!sondage 30m Quel jeu ce soir ? | Fortnite | Warzone | Apex`\n' +
        'Durée : `30s`, `5m`, `1h`, `2h30m`, `1d` — jusqu\'à 8 options'
      );
    }

    if (!isStaff) return message.reply('Staff uniquement');

    // First token = duration
    const firstTokens = parts[0].split(' ');
    const durationStr = firstTokens[0];
    const question = [firstTokens.slice(1).join(' '), ...parts.slice(1, -parts.length + 2)].join('').trim() ||
      firstTokens.slice(1).join(' ').trim();
    const options = parts.slice(1);

    // Re-parse: durée + question in first segment
    const durationMs = parseDuration(durationStr);
    const questionText = firstTokens.slice(1).join(' ').trim();

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

    // Add reactions
    for (let i = 0; i < options.length; i++) {
      await sent.react(NUMBER_EMOJIS[i]).catch(() => {});
    }

    // Save to DB
    const sondage = await Sondage.create({
      guildId: message.guild.id,
      channelId: message.channel.id,
      messageId: sent.id,
      question: questionText,
      options,
      endTime,
      createdBy: message.author.tag
    });

    // Schedule close
    setTimeout(() => closeSondage(client, sondage._id), durationMs);
  });
};

async function closeSondage(client, id) {
  try {
    const sondage = await Sondage.findById(id);
    if (!sondage || sondage.closed) return;

    const channel = client.channels.cache.get(sondage.channelId);
    if (!channel) return;

    const msg = await channel.messages.fetch(sondage.messageId).catch(() => null);
    if (!msg) return;

    // Count reactions
    const results = [];
    for (let i = 0; i < sondage.options.length; i++) {
      const reaction = msg.reactions.cache.get(NUMBER_EMOJIS[i]);
      const count = reaction ? reaction.count - 1 : 0; // subtract bot's own reaction
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
          const prefix = i === 0 ? '🏆 ' : `${i + 1}. `;
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

module.exports.closeSondage = closeSondage;
