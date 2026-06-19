const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const Config = require('../database/models/Config');
const Blacklist = require('../database/models/Blacklist');
const { staffLog } = require('../utils/staffLog');
const { syncRanks } = require('../utils/syncRanks');
const eventBus = require('../utils/eventBus');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!ajoutermatch')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    try {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      const args = message.content.split(' ');
      const name = args[1];
      const placement = parseInt(args[2]);
      const kills = parseInt(args[3]);

      if (!name || isNaN(placement) || isNaN(kills))
        return message.reply('Usage : `!ajoutermatch <nom> <placement> <kills>`');

      if (placement < 1 || placement > 100)
        return message.reply('❌ Le placement doit être entre **1** et **100**.');

      if (kills < 0)
        return message.reply('❌ Le nombre de kills ne peut pas être négatif.');

      const blacklisted = await Blacklist.findOne({ target: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });
      if (blacklisted) {
        return message.reply(`🚫 **${name}** est dans la blacklist.\nRaison : *${blacklisted.reason}*`);
      }

      const foundTeam = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } });
      if (!foundTeam) return message.reply('Équipe inconnue');

      const config = await Config.findOne();
      const ptMap = config?.pointSystem instanceof Map
        ? config.pointSystem
        : new Map([['1',10],['2',6],['3',5],['4',4],['5',3],['6',2],['7',1],['8',1]]);
      const killBonus = config?.killBonus ?? 1;

      const placementPts = ptMap.get(String(placement)) ?? 0;
      const pts = placementPts + (kills * killBonus);

      const team = await Team.findOneAndUpdate(
        { name: foundTeam.name },
        {
          $inc: {
            points: pts,
            kills,
            wins:   placement === 1 ? 1 : 0,
            losses: placement !== 1 ? 1 : 0,
          }
        },
        { new: true }
      );

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

      syncRanks(message.guild).catch(() => {});

      await staffLog(client, {
        action: 'addmatch',
        details: `**Équipe :** ${team.name}\n**Placement :** #${placement}\n**Kills :** ${kills}\n**Points gagnés :** +${pts}${activeTournoi ? `\n**Tournoi :** ${activeTournoi.name}` : ''}`,
        author: message.author.tag
      });
    } catch (err) {
      console.error('[addmatch] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
