const Ticket = require('../database/models/Ticket');
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const cmd = content.split(' ')[0].toLowerCase();

    // --- !ticket ---
    if (cmd === '!ticket') {
      const existing = await Ticket.findOne({ userId: message.author.id, closed: false });
      if (existing) {
        return message.reply(`Tu as déjà un ticket ouvert : <#${existing.channelId}>`);
      }

      const guild = message.guild;
      const channelName = `ticket-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: message.author.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.Administrator))?.id || guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      }).catch(() => null);

      if (!channel) return message.reply('❌ Impossible de créer le salon ticket (permissions manquantes).');

      await Ticket.create({ channelId: channel.id, userId: message.author.id, userTag: message.author.tag });

      const embed = new EmbedBuilder()
        .setTitle('🎫 Ticket ouvert')
        .setColor(0x5865F2)
        .setDescription(`Bonjour ${message.author} !\nExplique ton problème ici, le staff te répondra dès que possible.\n\nTape \`!close\` pour fermer ce ticket.`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      message.reply(`✅ Ton ticket a été créé : ${channel}`);
      logStaffAction(client, `🎫 **Ticket ouvert** par \`${message.author.tag}\` → <#${channel.id}>`);
      return;
    }

    // --- !close (inside a ticket channel) ---
    if (cmd === '!close') {
      const ticket = await Ticket.findOne({ channelId: message.channel.id, closed: false });
      if (!ticket) return;

      const isStaff = message.member.permissions.has('Administrator');
      const isOwner = ticket.userId === message.author.id;
      if (!isStaff && !isOwner) return message.reply('Seul le staff ou l\'auteur du ticket peut le fermer.');

      ticket.closed = true;
      await ticket.save();

      await message.channel.send('🔒 Ticket fermé. Ce salon sera supprimé dans 5 secondes.');
      logStaffAction(client, `🔒 **Ticket fermé** — \`${ticket.userTag}\` | Par : ${message.author.tag}`);

      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
    }
  });
};
