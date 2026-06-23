const Tournament = require('../database/models/Tournament');
const { EmbedBuilder } = require('discord.js');
const { staffLog } = require('../utils/staffLog');
const eventBus = require('../utils/eventBus');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    if (!message.content.startsWith('!nouveautournoi')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const name = message.content.split(' ').slice(1).join(' ');
    if (!name) return message.reply('Usage : `!newtournoi <nom du tournoi>`');

    const existing = await Tournament.findOne({ active: true });
    if (existing)
      return message.reply(`❌ Le tournoi **${existing.name}** est déjà en cours. Termine-le avec \`!endtournoi\` d'abord.`);

    const tournament = await Tournament.create({ name, startedBy: message.author.tag });

    const embed = new EmbedBuilder()
      .setTitle('🏁 Nouveau tournoi lancé !')
      .setDescription(`**${name}** vient de commencer. Bonne chance à toutes les équipes !`)
      .setColor(0x57F287)
      .addFields(
        { name: '📅 Démarré le', value: new Date().toLocaleDateString('fr-FR'), inline: true },
        { name: '👤 Par', value: message.author.tag, inline: true }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });

    eventBus.emit('newTournament', { name, startedBy: message.author.tag });

    await staffLog(client, {
      action: 'addmatch',
      details: `**Nouveau tournoi :** ${name}\n**ID :** ${tournament._id}`,
      author: message.author.tag
    });
    } catch (err) {
      console.error('[newtournoi] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
