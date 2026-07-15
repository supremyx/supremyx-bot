const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const Giveaway = require('../database/models/Giveaway');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|j)$/i);
  if (!match) return null;
  const val = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, j: 86400000 };
  return val * multipliers[unit];
}

// Planifie la fin d'un giveaway (utilisé au lancement ET à la restauration)
function scheduleEnd(client, giveaway) {
  const remaining = giveaway.endsAt.getTime() - Date.now();
  if (remaining <= 0) {
    endGiveaway(client, giveaway).catch(console.error);
    return;
  }
  setTimeout(() => endGiveaway(client, giveaway).catch(console.error), remaining);
}

async function endGiveaway(client, giveaway) {
  try {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) return;
    const freshMsg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (!freshMsg) return;

    const reaction = freshMsg.reactions.cache.get('🎉');
    const users = reaction ? await reaction.users.fetch() : null;
    const participants = users ? users.filter(u => !u.bot) : null;

    let winnerId = null, winnerTag = null;

    if (!participants || !participants.size) {
      const noWinEmbed = new EmbedBuilder()
        .setTitle('🎉 Concours terminé')
        .setColor(0x99AAB5)
        .setDescription(`**${giveaway.prize}**\n\nAucun participant. Pas de gagnant.`)
        .setTimestamp();
      await freshMsg.edit({ embeds: [noWinEmbed] });
    } else {
      const winner = participants.random();
      winnerId  = winner.id;
      winnerTag = winner.tag;
      const winEmbed = new EmbedBuilder()
        .setTitle('🎉 Concours terminé !')
        .setColor(0x57F287)
        .setDescription(`**${giveaway.prize}**\n\n🏆 Gagnant : **${winner.tag}** ${winner}`)
        .addFields({ name: '👥 Participants', value: `${participants.size}`, inline: true })
        .setTimestamp();
      await freshMsg.edit({ embeds: [winEmbed] });
      await channel.send(`🎊 Félicitations ${winner} ! Tu as gagné **${giveaway.prize}** !`);
    }

    await Giveaway.findOneAndUpdate(
      { messageId: giveaway.messageId },
      { $set: { ended: true, winnerId, winnerTag, participants: participants?.size ?? 0 } }
    );
  } catch (err) {
    console.error('[Giveaway] Erreur fin de concours:', err);
  }
}

module.exports = (client) => {
  // Restaure les giveaways actifs après redémarrage
  client.once('ready', async () => {
    try {
      const actifs = await Giveaway.find({ ended: false }).lean();
      if (actifs.length) {
        console.log(`[Giveaway] Restauration de ${actifs.length} concours actif(s)…`);
        for (const g of actifs) scheduleEnd(client, g);
      }
    } catch (err) {
      console.error('[Giveaway] Erreur restauration:', err);
    }
  });

  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !concours <durée> <prix> ---
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

      // Persiste en DB
      const giveaway = await Giveaway.create({
        guildId:   message.guild.id,
        channelId: message.channel.id,
        messageId: msg.id,
        prize,
        host:   message.author.tag,
        endsAt,
      });

      scheduleEnd(client, giveaway);
      logStaffAction(client, `🎉 **Giveaway** — "${prize}" (${durationStr}) | Par : ${message.author.tag}`);
      return;
    }

    // --- !retirer <messageId> --- (nouveau tirage)
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

      // Met à jour le gagnant en DB
      await Giveaway.findOneAndUpdate(
        { messageId: msgId },
        { $set: { winnerId: winner.id, winnerTag: winner.tag } }
      ).catch(() => {});
    }
  });
};
