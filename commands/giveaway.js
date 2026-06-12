const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const activeGiveaways = new Map();

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|j)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, j: 86400000 };
  return val * multipliers[unit];
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !giveaway <durée> <prix> ---
    if (cmd === '!concours') {
      if (!isStaff) return message.reply('Staff uniquement');

      const durationStr = args[1];
      const prize = args.slice(2).join(' ').trim();

      if (!durationStr || !prize)
        return message.reply('Usage : `!concours <durée> <prix>`\nExemple : `!concours 10m Skin exclusif`\nUnités : s, m, h, j');

      const duration = parseDuration(durationStr);
      if (!duration) return message.reply('❌ Durée invalide. Utilise : `10s`, `5m`, `2h`, `1j`');
      if (duration > 7 * 86400000) return message.reply('❌ Durée maximum : 7 jours.');

      const endsAt = new Date(Date.now() + duration);
      const endsStr = endsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) +
        ' le ' + endsAt.toLocaleDateString('fr-FR');

      const embed = new EmbedBuilder()
        .setTitle('🎉 CONCOURS !')
        .setColor(0xEB459E)
        .setDescription(`**${prize}**\n\nRéagis avec 🎉 pour participer !`)
        .addFields({ name: '⏱️ Fin', value: endsStr, inline: true })
        .setFooter({ text: `Lancé par ${message.author.tag}` })
        .setTimestamp();

      const msg = await message.channel.send({ embeds: [embed] });
      await msg.react('🎉');

      activeGiveaways.set(msg.id, { prize, channelId: message.channel.id, host: message.author.tag });

      logStaffAction(client, `🎉 **Giveaway** — "${prize}" (${durationStr}) | Par : ${message.author.tag}`);

      setTimeout(async () => {
        const freshMsg = await message.channel.messages.fetch(msg.id).catch(() => null);
        if (!freshMsg) return;

        const reaction = freshMsg.reactions.cache.get('🎉');
        if (!reaction) return;

        const users = await reaction.users.fetch();
        const participants = users.filter(u => !u.bot);

        if (!participants.size) {
          const noWinEmbed = new EmbedBuilder()
            .setTitle('🎉 Concours terminé')
            .setColor(0x99AAB5)
            .setDescription(`**${prize}**\n\nAucun participant. Pas de gagnant.`)
            .setTimestamp();
          return freshMsg.edit({ embeds: [noWinEmbed] });
        }

        const winner = participants.random();
        const winEmbed = new EmbedBuilder()
          .setTitle('🎉 Concours terminé !')
          .setColor(0x57F287)
          .setDescription(`**${prize}**\n\n🏆 Gagnant : **${winner.tag}** ${winner}`)
          .addFields({ name: '👥 Participants', value: `${participants.size}`, inline: true })
          .setTimestamp();

        await freshMsg.edit({ embeds: [winEmbed] });
        message.channel.send(`🎊 Félicitations ${winner} ! Tu as gagné **${prize}** !`);
        activeGiveaways.delete(msg.id);
      }, duration);

      return;
    }

    // --- !reroll <messageId> ---
    if (cmd === '!retirer') {
      if (!isStaff) return message.reply('Staff uniquement');
      const msgId = args[1];
      if (!msgId) return message.reply('Usage : `!retirer <messageId>`');

      const target = await message.channel.messages.fetch(msgId).catch(() => null);
      if (!target) return message.reply('❌ Message introuvable dans ce salon.');

      const reaction = target.reactions.cache.get('🎉');
      if (!reaction) return message.reply('❌ Aucune réaction 🎉 trouvée sur ce message.');

      const users = await reaction.users.fetch();
      const participants = users.filter(u => !u.bot);
      if (!participants.size) return message.reply('Aucun participant.');

      const winner = participants.random();
      message.channel.send(`🔁 **Nouveau tirage !** Nouveau gagnant : **${winner.tag}** ${winner} 🎉`);
    }
  });
};
