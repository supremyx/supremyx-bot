const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!message.guild) return;
    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !clear <n> ---
    if (cmd === '!clear') {
      if (!isStaff) return message.reply('Staff uniquement');
      const n = parseInt(args[1]);
      if (isNaN(n) || n < 1 || n > 100)
        return message.reply('Usage : `!clear <1-100>`');
      await message.delete().catch(() => {});
      const deleted = await message.channel.bulkDelete(n, true).catch(() => null);
      if (!deleted) return message.channel.send('❌ Impossible de supprimer (messages trop anciens ou permission manquante).');
      const confirm = await message.channel.send(`🗑️ **${deleted.size}** message(s) supprimé(s).`);
      setTimeout(() => confirm.delete().catch(() => {}), 4000);
      logStaffAction(client, `🗑️ **Clear** — ${deleted.size} messages supprimés dans <#${message.channel.id}> | Par : ${message.author.tag}`);
      return;
    }

    // --- !slowmode <secondes> ---
    if (cmd === '!slowmode') {
      if (!isStaff) return message.reply('Staff uniquement');
      const seconds = parseInt(args[1]);
      if (isNaN(seconds) || seconds < 0 || seconds > 21600)
        return message.reply('Usage : `!slowmode <0-21600>` (0 pour désactiver)');
      await message.channel.setRateLimitPerUser(seconds).catch(() => null);
      if (seconds === 0) {
        message.reply('✅ Mode lent désactivé.');
      } else {
        message.reply(`✅ Mode lent activé : **${seconds} seconde(s)** entre chaque message.`);
      }
      logStaffAction(client, `🐢 **Slowmode** — ${seconds}s dans <#${message.channel.id}> | Par : ${message.author.tag}`);
      return;
    }

    // --- !dm <@user> <message> ---
    if (cmd === '!dm') {
      if (!isStaff) return message.reply('Staff uniquement');
      const target = message.mentions.users.first();
      const text = args.slice(2).join(' ').trim();
      if (!target || !text)
        return message.reply('Usage : `!dm @utilisateur <message>`');
      const sent = await target.createDM().then(dm => dm.send(`📩 **Message du staff :**\n${text}`)).catch(() => null);
      if (!sent) return message.reply('❌ Impossible d\'envoyer le DM (messages privés fermés).');
      message.reply(`✅ Message envoyé à **${target.tag}**.`);
      logStaffAction(client, `📩 **DM** envoyé à \`${target.tag}\` | Par : ${message.author.tag}`);
      return;
    }

    // --- !mute <@user> <durée en minutes> [raison] ---
    if (cmd === '!mute') {
      if (!isStaff) return message.reply('Staff uniquement');
      const target = message.mentions.members.first();
      const minutes = parseInt(args[2]);
      const reason = args.slice(3).join(' ') || 'Aucune raison précisée';
      if (!target || isNaN(minutes) || minutes < 1)
        return message.reply('Usage : `!mute @utilisateur <minutes> [raison]`');
      if (minutes > 10080) return message.reply('❌ Durée maximum : 7 jours (10080 minutes).');
      await target.timeout(minutes * 60 * 1000, reason).catch(() => null);
      const embed = new EmbedBuilder()
        .setTitle('🔇 Membre mis en sourdine')
        .setColor(0xED4245)
        .addFields(
          { name: '👤 Membre', value: target.user.tag, inline: true },
          { name: '⏱️ Durée', value: `${minutes} min`, inline: true },
          { name: '📝 Raison', value: reason }
        )
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
      target.user.createDM().then(dm => dm.send(`🔇 Tu as été mis en sourdine pendant **${minutes} minute(s)**.\nRaison : ${reason}`)).catch(() => {});
      logStaffAction(client, `🔇 **Mute** — \`${target.user.tag}\` (${minutes}min) | Raison : ${reason} | Par : ${message.author.tag}`);
      return;
    }

    // --- !unmute <@user> ---
    if (cmd === '!unmute') {
      if (!isStaff) return message.reply('Staff uniquement');
      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!unmute @utilisateur`');
      await target.timeout(null).catch(() => null);
      message.reply(`✅ **${target.user.tag}** n'est plus en sourdine.`);
      logStaffAction(client, `🔊 **Unmute** — \`${target.user.tag}\` | Par : ${message.author.tag}`);
      return;
    }
  });
};
