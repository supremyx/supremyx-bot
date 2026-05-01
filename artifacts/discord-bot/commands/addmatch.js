const Team = require('../database/models/Team');

const points = {1:10,2:6,3:5,4:4,5:3,6:2,7:1,8:1};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.startsWith('!addmatch')) {

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      const args = message.content.split(' ');
      const name = args[1];
      const placement = parseInt(args[2]);
      const kills = parseInt(args[3]);

      let team = await Team.findOne({ name });
      if (!team) return message.reply('Inconnue');

      let pts = (points[placement] || 0) + kills;

      team.points += pts;
      team.kills += kills;
      await team.save();

      message.reply(`🎯 ${name} +${pts} pts`);
    }
  });
};
