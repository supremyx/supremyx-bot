const Tournament = require('../database/models/Tournament');
const Match = require('../database/models/Match');
const { staffLog } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (!message.content.startsWith('!supprimertournoi')) return;
    if (!message.guild) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const name = message.content.split(' ').slice(1).join(' ').trim();
    if (!name) return message.reply('Usage : `!deletetournoi <nom du tournoi>`');

    const tournament = await Tournament.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (!tournament)
      return message.reply(`❌ Tournoi **${name}** introuvable. Vérifie avec \`!tournois\`.`);

    const matchCount = await Match.countDocuments({ tournamentId: tournament._id.toString() });
    await Match.deleteMany({ tournamentId: tournament._id.toString() });
    await Tournament.deleteOne({ _id: tournament._id });

    message.reply(`🗑️ Tournoi **${tournament.name}** supprimé (${matchCount} match(s) associé(s) supprimé(s)).`);

    await staffLog(client, {
      action: 'unregister',
      details: `**Tournoi supprimé :** ${tournament.name}\n**Matchs supprimés :** ${matchCount}`,
      author: message.author.tag
    });
    } catch (err) {
      console.error('[deletetournoi] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
