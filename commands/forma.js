const { EmbedBuilder } = require('discord.js');
const Match = require('../database/models/Match');
const Team = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    const content = message.content.trim();
    if (!content.toLowerCase().startsWith('!forma')) return;

    const teamName = content.slice('!forma'.length).trim();
    if (!teamName) return message.reply('Usage : `!forma <équipe>`');

    const team = await Team.findOne({ name: { $regex: new RegExp(`^${teamName}$`, 'i') } });
    if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

    const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(10);
    if (!matches.length) return message.reply(`❌ Aucun match enregistré pour **${team.name}**.`);

    const last5 = matches.slice(0, 5);
    const forma = last5.map(m => {
      if (m.placement === 1) return '🥇';
      if (m.wins > 0 || m.placement <= 3) return '🟢';
      if (m.placement <= 5) return '🟡';
      return '🔴';
    }).join(' ');

    const winCount = last5.filter(m => m.placement === 1).length;
    const top3Count = last5.filter(m => m.placement <= 3).length;
    const avgKills = (last5.reduce((s, m) => s + m.kills, 0) / last5.length).toFixed(1);
    const avgPts = (last5.reduce((s, m) => s + m.points, 0) / last5.length).toFixed(1);

    let formRating = 'Moyenne';
    const score = winCount * 3 + (top3Count - winCount) * 1;
    if (score >= 12) formRating = '🔥 Excellente';
    else if (score >= 7) formRating = '✅ Bonne';
    else if (score >= 4) formRating = '⚠️ Moyenne';
    else formRating = '❌ Mauvaise';

    const embed = new EmbedBuilder()
      .setTitle(`📈 Forme récente — ${team.name}`)
      .setColor(score >= 7 ? 0x57F287 : score >= 4 ? 0xFEE75C : 0xED4245)
      .addFields(
        { name: '5 derniers matchs', value: forma || '—', inline: false },
        { name: '🏆 Victoires', value: `${winCount}/5`, inline: true },
        { name: '🥉 Top 3', value: `${top3Count}/5`, inline: true },
        { name: '📊 Forme', value: formRating, inline: true },
        { name: '💀 Kills/match', value: avgKills, inline: true },
        { name: '⭐ Pts/match', value: avgPts, inline: true },
      )
      .setFooter({ text: `Légende : 🥇 Victoire  🟢 Top 3  🟡 Top 5  🔴 Hors top 5` })
      .setTimestamp();

    const detailLines = last5.map((m, i) => {
      const d = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const icon = m.placement === 1 ? '🥇' : m.placement <= 3 ? '🟢' : m.placement <= 5 ? '🟡' : '🔴';
      return `${icon} **Match ${i + 1}** — Pl. ${m.placement} · ${m.kills} kills · ${m.points} pts *(${d})*`;
    });
    embed.addFields({ name: '📋 Détail', value: detailLines.join('\n') });

    return message.channel.send({ embeds: [embed] });
  });
};
