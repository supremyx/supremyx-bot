const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Roster = require('../database/models/Roster');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const ROLE_ICONS = {
  IGL: '🎯', Fragger: '💥', Support: '🛡️', Sniper: '🔭',
  Entry: '🚪', Flex: '🔄', Coach: '📋', 'Remplaçant': '🔁'
};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (message.author.bot) return;

    const content = message.content.trim();
    if (!content.startsWith('!infoequipe')) return;

    const cd = checkCooldown(message.author.id, 'teaminfo', 8, message.guild?.id);
    if (cd) return replyCooldown(message, cd, 'teaminfo');

    const name = content.slice('!infoequipe'.length).trim();
    if (!name)
      return message.reply('Usage : `!teaminfo <nom équipe>`');

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapedName}$`, 'i') } });
    if (!team)
      return message.reply(`❌ Équipe **${name}** introuvable. Utilisez \`!search ${name}\` pour chercher.`);

    // Recent matches
    const matches = await Match.find({ team: team.name }).sort({ createdAt: -1 }).limit(20);
    const matchCount = matches.length;
    const avgKills   = matchCount > 0 ? (team.kills / matchCount).toFixed(1) : '0';
    const avgPts     = matchCount > 0 ? (team.points / matchCount).toFixed(1) : '0';
    const best       = matchCount > 0 ? Math.min(...matches.map(m => m.placement)) : '—';
    const winRate    = (team.wins + team.losses) > 0
      ? `${Math.round((team.wins / (team.wins + team.losses)) * 100)}%`
      : '—';

    // Streak (last 5)
    const recent5 = matches.slice(0, 5)
      .map(m => m.placement <= 3 ? '🏆' : m.placement <= 5 ? '✅' : '⬜')
      .join(' ');

    // Tournament participation
    const tournamentNames = [...new Set(matches.filter(m => m.tournamentName).map(m => m.tournamentName))];
    const tournoiLine = tournamentNames.length > 0
      ? tournamentNames.slice(0, 3).join(', ') + (tournamentNames.length > 3 ? ` +${tournamentNames.length - 3}` : '')
      : '*Aucun*';

    // Roster
    const roster = await Roster.findOne({ guildId: message.guild.id, teamName: team.name });
    let rosterLine = '*Aucun roster enregistré*';
    if (roster && roster.members.length > 0) {
      rosterLine = roster.members.map(m => {
        const icon = ROLE_ICONS[m.role] ?? '🎮';
        return `${icon} **${m.displayName}** *(${m.role})*`;
      }).join('\n');
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏟️ ${team.name}`)
      .setColor(0xD4963A)
      .addFields(
        { name: '🏆 Points',        value: `**${team.points.toLocaleString('fr-FR')}**`,  inline: true },
        { name: '💀 Kills totaux',  value: `**${team.kills.toLocaleString('fr-FR')}**`,   inline: true },
        { name: '🎮 Matchs joués', value: `**${matchCount}**`,                             inline: true },
        { name: '✅ Victoires',     value: `**${team.wins}**`,                             inline: true },
        { name: '❌ Défaites',      value: `**${team.losses}**`,                           inline: true },
        { name: '📈 Winrate',       value: `**${winRate}**`,                               inline: true },
        { name: '⚔️ Moy. kills',   value: `**${avgKills}** /match`,                       inline: true },
        { name: '💎 Moy. points',   value: `**${avgPts}** /match`,                        inline: true },
        { name: '🥇 Meilleur place',value: `**#${best}**`,                                inline: true },
        { name: '📅 5 derniers matchs', value: recent5 || '*—*', inline: false },
        { name: '🏁 Tournois',      value: tournoiLine,                                    inline: false },
        { name: `👥 Roster (${roster?.members.length ?? 0} membre${(roster?.members.length ?? 0) !== 1 ? 's' : ''})`,
          value: rosterLine, inline: false }
      )
      .setFooter({ text: 'SUPREMYX CI · !statistiques pour stats détaillées · !liste pour le roster complet' })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[teaminfo] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
