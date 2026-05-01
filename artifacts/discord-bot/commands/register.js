const Team = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.startsWith('!register')) {
      const name = message.content.split(' ')[1];

      if (!name) return message.reply('Nom requis');

      let exists = await Team.findOne({ name });
      if (exists) return message.reply('Déjà inscrit');

      await Team.create({ name });

      message.reply(`✅ ${name} enregistré`);
    }
  });
};
