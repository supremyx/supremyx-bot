const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!search')) return;
    const cd = checkCooldown(message.author.id, 'search', 5);
    if (cd) return replyCooldown(message, cd, 'search');

    const query = message.content.split(' ').slice(1).join(' ').trim();
    if (!query) return message.reply('Usage : `!search <nom>`');

    const teams = await Team.find({
      name: { $regex: query, $options: 'i' }
    }).sort({ points: -1 });

    if (!teams.length)
      return message.reply(`❌ Aucune équipe trouvée pour **"${query}"**.`);

    if (teams.length === 1) {
      const t = teams[0];
      const matchCount = await Match.countDocuments({ team: t.name });
      const avgKills = matchCount > 0 ? (t.kills / matchCount).toFixed(1) : '0';
      const lastMatch = await Match.findOne({ team: t.name }).sort({ createdAt: -1 });
      const lastDate = lastMatch ? new Date(lastMatch.createdAt).toLocaleDateString('fr-FR') : 'Aucun';

      const embed = new EmbedBuilder()
        .setTitle(`🔍 ${t.name}`)
        .setColor(0x5865F2)
        .addFields(
          { name: '🏆 Points', value: `${t.points}`, inline: true },
          { name: '💀 Kills', value: `${t.kills}`, inline: true },
          { name: '🎮 Matchs', value: `${matchCount}`, inline: true },
          { name: '⚔️ Kills/match', value: `${avgKills}`, inline: true },
          { name: '📅 Dernier match', value: lastDate, inline: true }
        )
        .setFooter({ text: 'Utilisez !stats <nom> pour plus de détails' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Plusieurs résultats
    const list = teams.map((t, i) =>
      `**${i + 1}.** ${t.name} — ${t.points} pts | ${t.kills} kills`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Résultats pour "${query}"`)
      .setDescription(list)
      .setColor(0x5865F2)
      .setFooter({ text: `${teams.length} équipe(s) trouvée(s) — !stats <nom> pour les détails` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
