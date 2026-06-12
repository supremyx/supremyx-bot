const { PermissionsBitField } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const isLock = content === '!verrouiller' || content.startsWith('!verrouiller ');
    const isUnlock = content === '!deverrouiller' || content.startsWith('!deverrouiller ');
    if (!isLock && !isUnlock) return;
    if (!message.guild) return;
    if (!message.member?.permissions.has('Administrator')) return message.reply('Staff uniquement');

    const target = message.mentions.channels.first() || message.channel;

    if (isLock) {
      // Check it's not already locked
      const existing = target.permissionOverwrites.cache.get(message.guild.id);
      if (existing?.deny.has(PermissionsBitField.Flags.SendMessages)) {
        return message.reply(`❌ <#${target.id}> est déjà verrouillé.`);
      }
      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: false
      });
      logStaffAction(client, `🔒 **Lock** <#${target.id}> | Par : ${message.author.tag}`);
      return target.send(`🔒 Ce salon est verrouillé. Seul le staff peut écrire. *(par ${message.author.tag})*`);
    }

    if (isUnlock) {
      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        SendMessages: null
      });
      logStaffAction(client, `🔓 **Unlock** <#${target.id}> | Par : ${message.author.tag}`);
      return target.send(`🔓 Ce salon est de nouveau ouvert. *(par ${message.author.tag})*`);
    }
  });
};
