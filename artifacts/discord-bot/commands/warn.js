const Warning = require('../database/models/Warning');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!warn') && !message.content.startsWith('!warns') && !message.content.startsWith('!delwarn')) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = message.content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !warn <@user ou nom> <raison> ---
    if (cmd === '!warn') {
      if (!isStaff) return message.reply('Staff uniquement');

      const mention = message.mentions.users.first();
      const rawTarget = args[1];
      const reason = args.slice(mention ? 2 : 2).join(' ').trim();

      if (!rawTarget || !reason) {
        return message.reply(
          '**Usage :**\n' +
          '`!warn @utilisateur <raison>` — Avertir un joueur\n' +
          '`!warn <nom_équipe> <raison>` — Avertir une équipe'
        );
      }

      const target = mention ? mention.tag : rawTarget;
      const targetId = mention ? mention.id : '';

      await Warning.create({
        target,
        targetId,
        reason,
        warnedBy: message.author.tag,
        warnedById: message.author.id
      });

      const totalWarns = await Warning.countDocuments({ target });

      const embed = new EmbedBuilder()
        .setTitle('⚠️ Avertissement émis')
        .setColor(0xFEE75C)
        .addFields(
          { name: '🎯 Cible', value: target, inline: true },
          { name: '⚠️ Total warns', value: `${totalWarns}`, inline: true },
          { name: '📝 Raison', value: reason }
        )
        .setFooter({ text: `Warn par ${message.author.tag}` })
        .setTimestamp();

      if (totalWarns >= 3) {
        embed.addFields({ name: '🔴 Attention', value: `Cette cible a atteint **${totalWarns} avertissements**.` });
        embed.setColor(0xED4245);
      }

      message.channel.send({ embeds: [embed] });

      // Notify the user in DM if it's a mention
      if (mention) {
        const dmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Tu as reçu un avertissement')
          .setColor(0xFEE75C)
          .addFields(
            { name: '📝 Raison', value: reason },
            { name: '⚠️ Total warns', value: `${totalWarns}` }
          )
          .setFooter({ text: `Par ${message.author.tag}` })
          .setTimestamp();

        mention.createDM()
          .then(dm => dm.send({ embeds: [dmEmbed] }))
          .catch(() => {});
      }

      logStaffAction(client, `⚠️ **Warn** — \`${target}\` | Raison : ${reason} | Par : ${message.author.tag}`);
      return;
    }

    // --- !warns <@user ou nom> ---
    if (cmd === '!warns') {
      const mention = message.mentions.users.first();
      const rawTarget = args[1];

      if (!rawTarget) {
        return message.reply('Usage : `!warns @utilisateur` ou `!warns <nom_équipe>`');
      }

      const target = mention ? mention.tag : rawTarget;
      const query = mention
        ? { targetId: mention.id }
        : { target: { $regex: new RegExp(`^${rawTarget}$`, 'i') } };

      const warns = await Warning.find(query).sort({ createdAt: -1 });

      if (!warns.length) {
        return message.reply(`✅ Aucun avertissement pour **${target}**.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Avertissements — ${target}`)
        .setColor(warns.length >= 3 ? 0xED4245 : 0xFEE75C)
        .setDescription(`**${warns.length}** avertissement(s) au total`)
        .setTimestamp();

      for (const w of warns.slice(0, 10)) {
        const date = new Date(w.createdAt).toLocaleDateString('fr-FR');
        embed.addFields({
          name: `#${w._id.toString().slice(-5)} — ${date}`,
          value: `📝 ${w.reason}\n👮 Par : ${w.warnedBy}`
        });
      }

      if (warns.length > 10) {
        embed.setFooter({ text: `Affichage des 10 derniers sur ${warns.length}` });
      }

      return message.channel.send({ embeds: [embed] });
    }

    // --- !delwarn <id> ---
    if (cmd === '!delwarn') {
      if (!isStaff) return message.reply('Staff uniquement');

      const id = args[1];
      if (!id) return message.reply('Usage : `!delwarn <id>`\nL\'ID est visible dans `!warns`.');

      // Support short ID (last 5 chars) or full ID
      let deleted = null;
      if (id.length === 24) {
        deleted = await Warning.findByIdAndDelete(id).catch(() => null);
      } else {
        const all = await Warning.find({});
        const match = all.find(w => w._id.toString().slice(-5) === id);
        if (match) deleted = await Warning.findByIdAndDelete(match._id).catch(() => null);
      }

      if (!deleted) return message.reply('❌ Aucun avertissement trouvé avec cet ID.');

      logStaffAction(client, `🗑️ **Warn supprimé** — \`${deleted.target}\` | Raison : ${deleted.reason} | Par : ${message.author.tag}`);
      return message.reply(`✅ Avertissement de **${deleted.target}** supprimé.`);
    }
  });
};
