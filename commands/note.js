const Note = require('../database/models/Note');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!note') && !content.startsWith('!notes') && !content.startsWith('!supprimenote')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !note <cible> <texte> ---
    if (cmd === '!note') {
      const target = args[1];
      const text = args.slice(2).join(' ').trim();

      if (!target || !text) {
        return message.reply(
          '**Usage :** `!note <équipe ou joueur> <texte>`\n' +
          'Exemple : `!note TeamA Tendance à stall en fin de partie`'
        );
      }

      await Note.create({ target, content: text, author: message.author.tag });

      const embed = new EmbedBuilder()
        .setTitle('📝 Note ajoutée')
        .setColor(0x5865F2)
        .addFields(
          { name: '🎯 Cible', value: target, inline: true },
          { name: '👮 Auteur', value: message.author.tag, inline: true },
          { name: '📄 Contenu', value: text }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !notes <cible> ---
    if (cmd === '!notes') {
      const target = args[1];
      if (!target) return message.reply('Usage : `!notes <équipe ou joueur>`');

      const notes = await Note.find({
        target: { $regex: new RegExp(`^${target}$`, 'i') }
      }).sort({ createdAt: -1 });

      if (!notes.length) return message.reply(`📭 Aucune note pour **${target}**.`);

      const embed = new EmbedBuilder()
        .setTitle(`📋 Notes — ${target}`)
        .setColor(0x5865F2)
        .setDescription(`**${notes.length}** note(s) enregistrée(s)`)
        .setTimestamp();

      for (const n of notes.slice(0, 10)) {
        const date = new Date(n.createdAt).toLocaleDateString('fr-FR');
        embed.addFields({
          name: `#${n._id.toString().slice(-5)} — ${date} par ${n.author}`,
          value: n.content
        });
      }

      if (notes.length > 10) embed.setFooter({ text: `Affichage des 10 dernières sur ${notes.length}` });

      return message.channel.send({ embeds: [embed] });
    }

    // --- !supprimenote <id> ---
    if (cmd === '!supprimenote') {
      const id = args[1];
      if (!id) return message.reply('Usage : `!supprimenote <id>`\nL\'ID est visible dans `!notes`.');

      let deleted = null;
      if (id.length === 24) {
        deleted = await Note.findByIdAndDelete(id).catch(() => null);
      } else {
        const all = await Note.find({});
        const match = all.find(n => n._id.toString().slice(-5) === id);
        if (match) deleted = await Note.findByIdAndDelete(match._id).catch(() => null);
      }

      if (!deleted) return message.reply('❌ Aucune note trouvée avec cet ID.');
      return message.reply(`✅ Note sur **${deleted.target}** supprimée.`);
    }
  });
};
