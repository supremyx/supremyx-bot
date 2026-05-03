const Birthday = require('../database/models/Birthday');
const BirthdayConfig = require('../database/models/BirthdayConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const isStaff = message.member.permissions.has('Administrator');

    // --- !setbirthday #channel ---
    if (content.startsWith('!setbirthday')) {
      if (!isStaff) return message.reply('Staff uniquement');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!setbirthday #salon`');
      await BirthdayConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { guildId: message.guild.id, channelId: channel.id },
        { upsert: true, new: true }
      );
      logStaffAction(client, `🎂 **Salon anniversaires** → <#${channel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les anniversaires seront annoncés dans <#${channel.id}>.`);
    }

    if (!content.startsWith('!birthday')) return;

    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !birthday set DD/MM[/YYYY] ---
    if (sub === 'set') {
      const dateStr = args[2];
      if (!dateStr) return message.reply('Usage : `!birthday set DD/MM` ou `!birthday set DD/MM/YYYY`');
      const parts = dateStr.split('/');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parts[2] ? parseInt(parts[2]) : null;
      if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12)
        return message.reply('❌ Format invalide. Utilise `DD/MM` ou `DD/MM/YYYY`.');

      await Birthday.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        { guildId: message.guild.id, userId: message.author.id, day, month, year },
        { upsert: true, new: true }
      );
      return message.reply(`🎂 Ton anniversaire a été enregistré : **${day}/${month}${year ? `/${year}` : ''}**`);
    }

    // --- !birthday del ---
    if (sub === 'del' || sub === 'delete') {
      const deleted = await Birthday.findOneAndDelete({ guildId: message.guild.id, userId: message.author.id });
      if (!deleted) return message.reply('❌ Tu n\'as pas enregistré d\'anniversaire.');
      return message.reply('✅ Ton anniversaire a été supprimé.');
    }

    // --- !birthday list ---
    if (!sub || sub === 'list') {
      const birthdays = await Birthday.find({ guildId: message.guild.id }).sort({ month: 1, day: 1 });
      if (!birthdays.length) return message.reply('Aucun anniversaire enregistré. Utilise `!birthday set DD/MM`.');

      const today = new Date();
      const formatted = birthdays.map(b => {
        const isToday = b.day === today.getDate() && b.month === today.getMonth() + 1;
        return `${isToday ? '🎂 ' : ''}**${String(b.day).padStart(2,'0')}/${String(b.month).padStart(2,'0')}** — <@${b.userId}>`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🎂 Anniversaires — ${birthdays.length} membre(s)`)
        .setColor(0xFEE75C)
        .setDescription(formatted.join('\n'))
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    // --- !birthday check [@user] ---
    if (sub === 'check') {
      const target = message.mentions.users.first() || message.author;
      const b = await Birthday.findOne({ guildId: message.guild.id, userId: target.id });
      if (!b) return message.reply(`❌ ${target.username} n'a pas enregistré son anniversaire.`);
      return message.reply(`🎂 L'anniversaire de **${target.username}** : **${String(b.day).padStart(2,'0')}/${String(b.month).padStart(2,'0')}${b.year ? `/${b.year}` : ''}**`);
    }

    message.reply(
      '**Commandes `!birthday` :**\n' +
      '`!birthday set DD/MM` — Enregistrer ton anniversaire\n' +
      '`!birthday set DD/MM/YYYY` — Avec l\'année\n' +
      '`!birthday list` — Voir tous les anniversaires\n' +
      '`!birthday check [@user]` — Vérifier un anniversaire\n' +
      '`!birthday del` — Supprimer ton anniversaire\n' +
      '`!setbirthday #salon` — Configurer le salon d\'annonce *(staff)*'
    );
  });
};
