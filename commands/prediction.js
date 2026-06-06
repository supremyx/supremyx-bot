const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const Prediction = require('../database/models/Prediction');
const { logStaffAction } = require('../utils/staffLog');

function buildPredictionEmbed(pred) {
  const votesA = pred.votes.filter(v => v.choice === pred.teamA).length;
  const votesB = pred.votes.filter(v => v.choice === pred.teamB).length;
  const total = votesA + votesB;
  const pctA = total ? Math.round((votesA / total) * 100) : 50;
  const pctB = total ? Math.round((votesB / total) * 100) : 50;

  const barLength = 20;
  const filledA = Math.round((pctA / 100) * barLength);
  const barA = '█'.repeat(filledA) + '░'.repeat(barLength - filledA);
  const barB = '█'.repeat(Math.round((pctB / 100) * barLength)) + '░'.repeat(barLength - Math.round((pctB / 100) * barLength));

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Prédiction — ${pred.teamA} vs ${pred.teamB}`)
    .setColor(pred.closed ? 0x808080 : 0xFEE75C)
    .addFields(
      { name: `🔵 ${pred.teamA}`, value: `${barA}\n**${votesA} vote(s)** — ${pctA}%`, inline: true },
      { name: `🔴 ${pred.teamB}`, value: `${barB}\n**${votesB} vote(s)** — ${pctB}%`, inline: true },
      { name: '📊 Total', value: `**${total}** participant(s)`, inline: true }
    )
    .setTimestamp();

  if (pred.description) embed.setDescription(pred.description);
  if (pred.closed) {
    embed.addFields({ name: '🏆 Résultat', value: pred.result ? `**${pred.result}** a gagné !` : 'Match terminé' });
    embed.setFooter({ text: 'Prédiction fermée' });
  } else {
    embed.setFooter({ text: 'Vote via les boutons ci-dessous · Changeable jusqu\'à fermeture' });
  }
  return embed;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    const content = message.content.trim();
    const lower = content.toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // --- !prediction create <teamA> vs <teamB> [| description] ---
    if (lower.startsWith('!prediction create') || lower.startsWith('!prediction new')) {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');

      const raw = content.slice(content.indexOf(' ', 12)).trim();
      const pipeIdx = raw.indexOf('|');
      const mainPart = pipeIdx >= 0 ? raw.slice(0, pipeIdx).trim() : raw;
      const description = pipeIdx >= 0 ? raw.slice(pipeIdx + 1).trim() : '';

      const vsIdx = mainPart.toLowerCase().indexOf(' vs ');
      if (vsIdx === -1) return message.reply('Usage : `!prediction create <équipeA> vs <équipeB> [| description]`');

      const teamA = mainPart.slice(0, vsIdx).trim();
      const teamB = mainPart.slice(vsIdx + 4).trim();
      if (!teamA || !teamB) return message.reply('Précise les deux équipes.');

      const pred = await Prediction.create({
        guildId: message.guild.id,
        teamA, teamB, description,
        createdBy: message.author.tag,
        votes: []
      });

      const btnA = new ButtonBuilder().setCustomId(`pred_vote_${pred._id}_A`).setLabel(`🔵 ${teamA}`).setStyle(ButtonStyle.Primary);
      const btnB = new ButtonBuilder().setCustomId(`pred_vote_${pred._id}_B`).setLabel(`🔴 ${teamB}`).setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(btnA, btnB);

      const sent = await message.channel.send({ embeds: [buildPredictionEmbed(pred)], components: [row] });
      await Prediction.findByIdAndUpdate(pred._id, { messageId: sent.id, channelId: message.channel.id });

      logStaffAction(client, `🎯 **Prédiction** créée : **${teamA}** vs **${teamB}** | Par : ${message.author.tag}`);
      return;
    }

    // --- !prediction close <teamA> vs <teamB> [résultat] ---
    if (lower.startsWith('!prediction close') || lower.startsWith('!prediction end')) {
      if (!isStaff) return message.reply('⛔ Staff uniquement.');

      const openPreds = await Prediction.find({ guildId: message.guild.id, closed: false });
      if (!openPreds.length) return message.reply('❌ Aucune prédiction ouverte.');

      const raw = content.slice(content.indexOf(' ', 12)).trim();
      const vsIdx = raw.toLowerCase().indexOf(' vs ');

      let pred;
      if (vsIdx !== -1) {
        const tA = raw.slice(0, vsIdx).trim();
        const rest = raw.slice(vsIdx + 4).trim();
        const winnerStart = rest.toLowerCase().indexOf(' gagnant ');
        const tB = winnerStart !== -1 ? rest.slice(0, winnerStart).trim() : rest;
        const result = winnerStart !== -1 ? rest.slice(winnerStart + 9).trim() : null;

        pred = openPreds.find(p => p.teamA.toLowerCase() === tA.toLowerCase() && p.teamB.toLowerCase() === tB.toLowerCase());
        if (!pred) return message.reply(`❌ Prédiction **${tA} vs ${tB}** introuvable.`);

        pred.closed = true;
        pred.result = result || null;
        pred.closedAt = new Date();
        await pred.save();
      } else {
        pred = openPreds[0];
        pred.closed = true;
        pred.closedAt = new Date();
        await pred.save();
      }

      if (pred.channelId && pred.messageId) {
        try {
          const ch = client.channels.cache.get(pred.channelId);
          const msg = ch ? await ch.messages.fetch(pred.messageId) : null;
          if (msg) await msg.edit({ embeds: [buildPredictionEmbed(pred)], components: [] });
        } catch {}
      }

      logStaffAction(client, `🎯 **Prédiction fermée** : **${pred.teamA}** vs **${pred.teamB}**${pred.result ? ` — Gagnant : **${pred.result}**` : ''} | Par : ${message.author.tag}`);
      return message.reply(`✅ Prédiction fermée.${pred.result ? ` Gagnant : **${pred.result}**` : ''}`);
    }

    // --- !prediction leaderboard ---
    if (lower === '!prediction leaderboard' || lower === '!prediction top') {
      const preds = await Prediction.find({ guildId: message.guild.id, closed: true, result: { $ne: null } });
      if (!preds.length) return message.reply('Aucune prédiction terminée avec résultat.');

      const scores = new Map();
      for (const p of preds) {
        for (const v of p.votes) {
          if (v.choice === p.result) {
            const s = scores.get(v.userId) || { tag: v.userTag, correct: 0, total: 0 };
            s.correct++;
            s.total++;
            scores.set(v.userId, s);
          } else {
            const s = scores.get(v.userId) || { tag: v.userTag, correct: 0, total: 0 };
            s.total++;
            scores.set(v.userId, s);
          }
        }
      }

      const sorted = [...scores.entries()].sort((a, b) => b[1].correct - a[1].correct || b[1].total - a[1].total).slice(0, 10);
      if (!sorted.length) return message.reply('Aucun vote enregistré.');

      const medals = ['🥇', '🥈', '🥉'];
      const lines = sorted.map(([, s], i) =>
        `${medals[i] || `**${i + 1}.**`} **${s.tag}** — ${s.correct}/${s.total} correct(s) (${Math.round((s.correct / s.total) * 100)}%)`
      );

      const embed = new EmbedBuilder()
        .setTitle('🏆 Classement des pronostiqueurs')
        .setColor(0xFEE75C)
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !prediction list ---
    if (lower === '!prediction list' || lower === '!prediction') {
      const preds = await Prediction.find({ guildId: message.guild.id, closed: false });
      if (!preds.length) return message.reply('Aucune prédiction ouverte en ce moment.');

      const embed = new EmbedBuilder()
        .setTitle('🎯 Prédictions ouvertes')
        .setColor(0xFEE75C)
        .setDescription(preds.map(p => `• **${p.teamA}** vs **${p.teamB}** — ${p.votes.length} vote(s)`).join('\n'))
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });

  // Button interactions
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('pred_vote_')) return;

    const parts = interaction.customId.split('_');
    const predId = parts[2];
    const choice = parts[3]; // 'A' or 'B'

    const pred = await Prediction.findById(predId);
    if (!pred || pred.closed) return interaction.reply({ content: '❌ Cette prédiction est fermée.', ephemeral: true });

    const selectedTeam = choice === 'A' ? pred.teamA : pred.teamB;
    const existingIdx = pred.votes.findIndex(v => v.userId === interaction.user.id);

    if (existingIdx !== -1) {
      if (pred.votes[existingIdx].choice === selectedTeam) {
        return interaction.reply({ content: `Tu votes déjà pour **${selectedTeam}** !`, ephemeral: true });
      }
      pred.votes[existingIdx].choice = selectedTeam;
      pred.votes[existingIdx].votedAt = new Date();
    } else {
      pred.votes.push({ userId: interaction.user.id, userTag: interaction.user.tag, choice: selectedTeam });
    }

    await pred.save();

    const btnA = new ButtonBuilder().setCustomId(`pred_vote_${pred._id}_A`).setLabel(`🔵 ${pred.teamA}`).setStyle(ButtonStyle.Primary);
    const btnB = new ButtonBuilder().setCustomId(`pred_vote_${pred._id}_B`).setLabel(`🔴 ${pred.teamB}`).setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(btnA, btnB);

    await interaction.update({ embeds: [buildPredictionEmbed(pred)], components: [row] });
  });
};
