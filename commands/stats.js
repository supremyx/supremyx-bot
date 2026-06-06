const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (message.content.startsWith('!stats')) {
      const cd = checkCooldown(message.author.id, 'stats', 5);
      if (cd) return replyCooldown(message, cd, 'stats');

      const name = message.content.split(' ').slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!stats <nom>`');

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${name}** introuvable.`);

      const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 });
      const matchCount = matches.length;
      const bestPlacement = matchCount > 0 ? Math.min(...matches.map(m => m.placement)) : '-';
      const avgKills = matchCount > 0 ? (team.kills / matchCount).toFixed(1) : '0';

      const history = matches.slice(0, 5).map(m =>
        `\`#${m.placement}\` — ${m.kills} kills — +${m.points} pts`
      ).join('\n') || 'Aucun match joué';

      const embed = new EmbedBuilder()
        .setTitle(`📊 Stats — ${team.name}`)
        .setColor(0x5865F2)
        .addFields(
          { name: '🏆 Points totaux', value: `${team.points}`, inline: true },
          { name: '💀 Kills totaux', value: `${team.kills}`, inline: true },
          { name: '🎮 Matchs joués', value: `${matchCount}`, inline: true },
          { name: '🎯 Meilleur placement', value: `#${bestPlacement}`, inline: true },
          { name: '⚔️ Kills/match (moy.)', value: `${avgKills}`, inline: true },
          { name: '📋 5 derniers matchs', value: history }
        )
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    }
    } catch (err) {
      console.error('[stats] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
