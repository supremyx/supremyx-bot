const Team = require('../database/models/Team');
const Blacklist = require('../database/models/Blacklist');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!register')) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const name = message.content.split(' ').slice(1).join(' ').trim();
    if (!name) return message.reply('Usage : `!register <nom équipe>`');

    const blacklisted = await Blacklist.findOne({ target: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (blacklisted) {
      return message.reply(`🚫 **${name}** est dans la blacklist et ne peut pas être inscrit.\nRaison : *${blacklisted.reason}*`);
    }

    const exists = await Team.findOne({ name: { $regex: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    if (exists) return message.reply(`⚠️ L'équipe **${exists.name}** est déjà inscrite.`);

    await Team.create({ name });
    message.reply(`✅ Équipe **${name}** enregistrée avec succès.`);
  });
};
