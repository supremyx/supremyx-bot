const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Tournament = require('../database/models/Tournament');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content !== '!sauvegarde') return;
    if (!message.guild) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const [teams, matches, tournaments] = await Promise.all([
      Team.find().lean(),
      Match.find().lean(),
      Tournament.find().lean()
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      exportedBy: message.author.tag,
      stats: {
        teams: teams.length,
        matches: matches.length,
        tournaments: tournaments.length
      },
      data: { teams, matches, tournaments }
    };

    const json = JSON.stringify(backup, null, 2);
    const buffer = Buffer.from(json, 'utf-8');
    const now = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    const file = new AttachmentBuilder(buffer, { name: `backup_moseto_${now}.json` });

    const embed = new EmbedBuilder()
      .setTitle('💾 Sauvegarde — Base de données')
      .setColor(0xEB459E)
      .addFields(
        { name: '👥 Équipes', value: `${teams.length}`, inline: true },
        { name: '🎮 Matchs', value: `${matches.length}`, inline: true },
        { name: '🏁 Tournois', value: `${tournaments.length}`, inline: true }
      )
      .setDescription('Le fichier JSON complet a été envoyé en message privé.')
      .setFooter({ text: `Demandé par ${message.author.tag}` })
      .setTimestamp();

    try {
      const dm = await message.author.createDM();
      await dm.send({
        content: '**💾 Backup SUPREMYX** — Conserve ce fichier en lieu sûr.',
        files: [file]
      });
      message.channel.send({ embeds: [embed] });
    } catch {
      message.reply('❌ Impossible d\'envoyer le backup en DM. Vérifie que tes messages privés sont ouverts.');
    }
  });
};
