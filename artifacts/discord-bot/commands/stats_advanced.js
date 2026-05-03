const Match = require('../database/models/Match');
const Config = require('../database/models/Config');
const { EmbedBuilder } = require('discord.js');

function stdDev(values) {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance).toFixed(2);
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !streak <équipe> ---
    if (cmd === '!streak') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!streak <nom équipe>`');

      const matches = await Match.find({ team: { $regex: new RegExp(`^${name}$`, 'i') } }).sort({ createdAt: -1 });
      if (!matches.length) return message.reply(`Aucun match trouvé pour **${name}**.`);

      const config = await Config.findOne() || { pointSystem: new Map([['1',12],['2',9],['3',7],['4',5],['5',4],['6',3],['7',2],['8',1]]) };

      let streak = 0;
      let streakType = null;
      for (const m of matches) {
        const placementPts = config.pointSystem instanceof Map
          ? (config.pointSystem.get(String(m.placement)) || 0)
          : (config.pointSystem[String(m.placement)] || 0);
        const isWin = placementPts > 0 && m.placement <= 3;
        if (streakType === null) streakType = isWin ? 'win' : 'loss';
        if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
          streak++;
        } else break;
      }

      const icon = streakType === 'win' ? '🔥' : '❄️';
      const label = streakType === 'win' ? 'victoire(s) consécutive(s) (top 3)' : 'match(s) hors top 3 consécutifs';

      const embed = new EmbedBuilder()
        .setTitle(`${icon} Streak — ${name}`)
        .setColor(streakType === 'win' ? 0x57F287 : 0xED4245)
        .setDescription(`**${streak}** ${label}`)
        .setFooter({ text: `Basé sur ${matches.length} match(s) joué(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !calc <placement> <kills> ---
    if (cmd === '!calc') {
      const placement = parseInt(args[1]);
      const kills = parseInt(args[2]);
      if (isNaN(placement) || isNaN(kills))
        return message.reply('Usage : `!calc <placement> <kills>`\nExemple : `!calc 2 5`');

      const config = await Config.findOne();
      const ptMap = config?.pointSystem || new Map([['1',12],['2',9],['3',7],['4',5],['5',4],['6',3],['7',2],['8',1]]);
      const killBonus = config?.killBonus ?? 1;
      const placementPts = ptMap instanceof Map ? (ptMap.get(String(placement)) || 0) : (ptMap[String(placement)] || 0);
      const total = placementPts + (kills * killBonus);

      const embed = new EmbedBuilder()
        .setTitle('🧮 Calcul de points')
        .setColor(0x5865F2)
        .addFields(
          { name: '📍 Placement', value: `#${placement} → **${placementPts} pts**`, inline: true },
          { name: '💀 Kills', value: `${kills} × ${killBonus} → **${kills * killBonus} pts**`, inline: true },
          { name: '🏆 Total', value: `**${total} points**`, inline: false }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !consistency <équipe> ---
    if (cmd === '!consistency') {
      const name = args.slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!consistency <nom équipe>`');

      const matches = await Match.find({ team: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (matches.length < 2) return message.reply(`Il faut au moins 2 matchs pour calculer la régularité de **${name}**.`);

      const pts = matches.map(m => m.points);
      const avg = (pts.reduce((a, b) => a + b, 0) / pts.length).toFixed(2);
      const sd = stdDev(pts);
      const min = Math.min(...pts);
      const max = Math.max(...pts);

      let rating, color;
      if (sd <= 2) { rating = '⭐⭐⭐⭐⭐ Très régulier'; color = 0x57F287; }
      else if (sd <= 4) { rating = '⭐⭐⭐⭐ Régulier'; color = 0xFEE75C; }
      else if (sd <= 6) { rating = '⭐⭐⭐ Moyen'; color = 0xEB459E; }
      else { rating = '⭐⭐ Irrégulier'; color = 0xED4245; }

      const embed = new EmbedBuilder()
        .setTitle(`📈 Régularité — ${name}`)
        .setColor(color)
        .addFields(
          { name: '📊 Moyenne', value: `${avg} pts/match`, inline: true },
          { name: '📉 Écart-type', value: `±${sd}`, inline: true },
          { name: '↕️ Min / Max', value: `${min} / ${max} pts`, inline: true },
          { name: '🎯 Matchs analysés', value: `${matches.length}`, inline: true },
          { name: '⭐ Note', value: rating, inline: false }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !h2h <equipe1> vs <equipe2> ---
    if (cmd === '!h2h') {
      const vsIndex = args.findIndex(a => a.toLowerCase() === 'vs');
      if (vsIndex < 2) return message.reply('Usage : `!h2h <equipe1> vs <equipe2>`');

      const team1 = args.slice(1, vsIndex).join(' ').trim();
      const team2 = args.slice(vsIndex + 1).join(' ').trim();

      const [m1, m2] = await Promise.all([
        Match.find({ team: { $regex: new RegExp(`^${team1}$`, 'i') } }).sort({ createdAt: -1 }),
        Match.find({ team: { $regex: new RegExp(`^${team2}$`, 'i') } }).sort({ createdAt: -1 })
      ]);

      if (!m1.length || !m2.length)
        return message.reply(`❌ Données insuffisantes pour une ou les deux équipes.`);

      const stats = (matches) => ({
        total: matches.length,
        avgPts: (matches.reduce((a, m) => a + m.points, 0) / matches.length).toFixed(1),
        avgKills: (matches.reduce((a, m) => a + m.kills, 0) / matches.length).toFixed(1),
        top3: matches.filter(m => m.placement <= 3).length,
        totalPts: matches.reduce((a, m) => a + m.points, 0)
      });

      const s1 = stats(m1);
      const s2 = stats(m2);

      const embed = new EmbedBuilder()
        .setTitle(`⚔️ Face à Face — ${team1} vs ${team2}`)
        .setColor(0x5865F2)
        .addFields(
          { name: '📊 Stat', value: 'Total matchs\nPts totaux\nMoy. pts/match\nMoy. kills/match\nTop 3', inline: true },
          { name: `🔵 ${team1}`, value: `${s1.total}\n${s1.totalPts}\n${s1.avgPts}\n${s1.avgKills}\n${s1.top3}`, inline: true },
          { name: `🔴 ${team2}`, value: `${s2.total}\n${s2.totalPts}\n${s2.avgPts}\n${s2.avgKills}\n${s2.top3}`, inline: true }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
