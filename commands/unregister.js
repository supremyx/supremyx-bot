const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const { staffLog } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (message.content.startsWith('!desenregistrer')) {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('Staff uniquement');

      const name = message.content.split(' ').slice(1).join(' ').trim();
      if (!name) return message.reply('Usage : `!desenregistrer <nom équipe>`');

      const team = await Team.findOneAndDelete({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
      if (!team) return message.reply('Équipe inconnue');

      const matchCount = await Match.countDocuments({ team: team.name });
      await Match.deleteMany({ team: team.name });

      message.reply(`🗑️ **${team.name}** a été supprimée (équipe + historique).`);

      await staffLog(client, {
        action: 'unregister',
        details: `**Équipe supprimée :** ${team.name}\n**Matchs supprimés :** ${matchCount}`,
        author: message.author.tag
      });
    }
    } catch (err) {
      console.error('[unregister] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
