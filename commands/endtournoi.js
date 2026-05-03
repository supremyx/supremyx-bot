const Tournament = require('../database/models/Tournament');
const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { EmbedBuilder } = require('discord.js');
const { staffLog } = require('../utils/staffLog');

const medals = ['🥇', '🥈', '🥉'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!endtournoi') return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const tournament = await Tournament.findOne({ active: true });
    if (!tournament)
      return message.reply('❌ Aucun tournoi en cours. Lance-en un avec `!newtournoi <nom>`.');

    const teams = await Team.find().sort({ points: -1 });
    const matchCount = await Match.countDocuments({ tournamentId: tournament._id });
    const totalKills = teams.reduce((sum, t) => sum + t.kills, 0);

    const winner = teams[0] || null;
    const duration = Math.floor((Date.now() - tournament.startedAt) / (1000 * 60 * 60));

    tournament.active = false;
    tournament.endedBy = message.author.tag;
    tournament.winner = winner ? winner.name : null;
    tournament.totalMatches = matchCount;
    tournament.totalKills = totalKills;
    tournament.endedAt = new Date();
    await tournament.save();

    const podium = teams.slice(0, 3).map((t, i) =>
      `${medals[i] || `#${i + 1}`} **${t.name}** — ${t.points} pts | ${t.kills} kills`
    ).join('\n') || 'Aucune équipe';

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Fin du tournoi — ${tournament.name}`)
      .setColor(0xF1C40F)
      .addFields(
        { name: '🥇 Vainqueur', value: winner ? `**${winner.name}** avec ${winner.points} pts` : 'Aucun', inline: false },
        { name: '🎖️ Podium final', value: podium, inline: false },
        { name: '🎮 Matchs joués', value: `${matchCount}`, inline: true },
        { name: '💀 Kills totaux', value: `${totalKills}`, inline: true },
        { name: '⏱️ Durée', value: `${duration}h`, inline: true }
      )
      .setFooter({ text: `Terminé par ${message.author.tag}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });

    await staffLog(client, {
      action: 'resetmatch',
      details: `**Tournoi terminé :** ${tournament.name}\n**Vainqueur :** ${winner ? winner.name : 'Aucun'}\n**Matchs :** ${matchCount}`,
      author: message.author.tag
    });
  });
};
