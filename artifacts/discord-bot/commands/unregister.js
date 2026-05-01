const Team = require('../database/models/Team');
const Match = require('../database/models/Match');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.startsWith('!unregister')) {

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      const name = message.content.split(' ')[1];
      if (!name) return message.reply('Usage : `!unregister <nom>`');

      const team = await Team.findOneAndDelete({ name });
      if (!team) return message.reply('Équipe inconnue');

      await Match.deleteMany({ team: name });

      message.reply(`🗑️ **${name}** a été supprimée (équipe + historique).`);
    }
  });
};
