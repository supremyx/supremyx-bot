const Team = require('../database/models/Team');
const { staffLog } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (message.content === '!reinitialiser') {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      await Team.updateMany({}, { points: 0, kills: 0, wins: 0, losses: 0 });

      message.reply('🔄 Tous les scores ont été remis à zéro.');

      await staffLog(client, {
        action: 'reinitialiser',
        details: 'Tous les points, kills, wins et losses ont été remis à zéro.',
        author: message.author.tag
      });
    }
    } catch (err) {
      console.error('[resetmatch] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
