const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Config = require('../database/models/Config');
const { staffLog } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.startsWith('!addmatch')) {

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      const args = message.content.split(' ');
      const name = args[1];
      const placement = parseInt(args[2]);
      const kills = parseInt(args[3]);

      if (!name || isNaN(placement) || isNaN(kills))
        return message.reply('Usage : `!addmatch <nom> <placement> <kills>`');

      let team = await Team.findOne({ name });
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
      team.kills += kills;
      await team.save();

      const activeTournoi = await Tournament.findOne({ active: true });

      await Match.create({
        team: name,
        placement,
        kills,
        points: pts,
        tournamentId: activeTournoi ? activeTournoi._id.toString() : null,
        tournamentName: activeTournoi ? activeTournoi.name : null,
        addedBy: message.author.tag
      });

      const tournamentInfo = activeTournoi ? ` *(${activeTournoi.name})*` : '';
      message.reply(`🎯 **${name}** +${pts} pts (place #${placement}, ${kills} kills)${tournamentInfo}`);

      await staffLog(client, {
        action: 'addmatch',
        details: `**Équipe :** ${name}\n**Placement :** #${placement}\n**Kills :** ${kills}\n**Points gagnés :** +${pts}${activeTournoi ? `\n**Tournoi :** ${activeTournoi.name}` : ''}`,
        author: message.author.tag
      });
    }
  });
};
