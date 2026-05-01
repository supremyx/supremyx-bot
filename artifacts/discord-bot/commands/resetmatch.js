const Team = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content === '!resetmatch') {

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      await Team.updateMany({}, { points: 0, kills: 0, wins: 0, losses: 0 });

      message.reply('🔄 Tous les scores ont été remis à zéro.');
    }
  });
};
