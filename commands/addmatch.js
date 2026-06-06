const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Config = require('../database/models/Config');
const Blacklist = require('../database/models/Blacklist');
const { staffLog } = require('../utils/staffLog');
const { syncRanks } = require('../utils/syncRanks');
const eventBus = require('../utils/eventBus');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.startsWith('!addmatch')) {
      if (!message.guild) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      const args = message.content.split(' ');
      const name = args[1];
      const placement = parseInt(args[2]);
      const kills = parseInt(args[3]);

      if (!name || isNaN(placement) || isNaN(kills))
        return message.reply('Usage : `!addmatch <nom> <placement> <kills>`');

      const blacklisted = await Blacklist.findOne({ target: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (blacklisted) {
        return message.reply(`🚫 **${name}** est dans la blacklist.\nRaison : *${blacklisted.reason}*`);
      }

      let team = await Team.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!team) return message.reply('Équipe inconnue');

      // Use config point system or fallback defaults
      const config = await Config.findOne();
      const ptMap = config?.pointSystem instanceof Map
        ? config.pointSystem
        : new Map([['1',10],['2',6],['3',5],['4',4],['5',3],['6',2],['7',1],['8',1]]);
      const killBonus = config?.killBonus ?? 1;

      const placementPts = ptMap.get(String(placement)) ?? 0;
      const pts = placementPts + (kills * killBonus);

      team.points += pts;
      team.kills  += kills;
      if (placement === 1) team.wins   += 1;
      else                 team.losses += 1;
      await team.save();

      const activeTournoi = await Tournament.findOne({ active: true });

      await Match.create({
        team: team.name,
        placement,
        kills,
        points: pts,
        tournamentId: activeTournoi ? activeTournoi._id.toString() : null,
        tournamentName: activeTournoi ? activeTournoi.name : null,
        addedBy: message.author.tag
      });

      const tournamentInfo = activeTournoi ? ` *(${activeTournoi.name})*` : '';
      message.reply(`🎯 **${team.name}** +${pts} pts (place #${placement}, ${kills} kills)${tournamentInfo}`);

      eventBus.emit('newMatch', {
        team: team.name,
        placement,
        kills,
        points: pts,
        tournamentName: activeTournoi ? activeTournoi.name : null,
      });

      // Auto-sync rank roles if configured
      syncRanks(message.guild).catch(() => {});

      // Check and announce auto-achievements
      const { checkAutoAchievements, announceAchievements } = require('../utils/autoAchievement');
      checkAutoAchievements(client, team.name)
        .then(unlocked => announceAchievements(client, team.name, unlocked))
        .catch(() => {});

      await staffLog(client, {
        action: 'addmatch',
        details: `**Équipe :** ${team.name}\n**Placement :** #${placement}\n**Kills :** ${kills}\n**Points gagnés :** +${pts}${activeTournoi ? `\n**Tournoi :** ${activeTournoi.name}` : ''}`,
        author: message.author.tag
      });
    }
  });
};
