const Sondage = require('../database/models/Sondage');

const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];

async function closeSondage(client, sondage) {
  if (sondage.closed) return;
  try {
    const channel = client.channels.cache.get(sondage.channelId);
    if (!channel) return;
    const msg = await channel.messages.fetch(sondage.messageId).catch(() => null);
    if (!msg) return;

    const { EmbedBuilder } = require('discord.js');

    const results = [];
    for (let i = 0; i < sondage.options.length; i++) {
      const reaction = msg.reactions.cache.get(NUMBER_EMOJIS[i]);
      const count = reaction ? Math.max(0, reaction.count - 1) : 0;
      results.push({ option: sondage.options[i], count });
    }
    results.sort((a, b) => b.count - a.count);
    const total = results.reduce((s, r) => s + r.count, 0);
    const winner = results[0];

    const embed = new EmbedBuilder()
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

    await msg.edit({ embeds: [embed] });
    sondage.closed = true;
    await sondage.save();
  } catch {}
}

async function startSondageManager(client) {
  // On startup, reschedule any open sondages
  const open = await Sondage.find({ closed: false });
  const now = Date.now();
  for (const s of open) {
    const delay = new Date(s.endTime).getTime() - now;
    if (delay <= 0) {
      await closeSondage(client, s);
    } else {
      setTimeout(() => closeSondage(client, s), delay);
    }
  }
}

module.exports = { startSondageManager, closeSondage };
