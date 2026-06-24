const Birthday = require('../database/models/Birthday');
const BirthdayConfig = require('../database/models/BirthdayConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!message.guild) return;
    if (message.author.bot) return;
    const isStaff = message.member?.permissions.has('Administrator') ?? false;

    // --- !setbirthday #channel ---
    if (content.startsWith('!salonanniversaires')) {
      if (!isStaff) return message.reply('Staff uniquement');
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!salonanniversaires #salon`');
      await BirthdayConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { guildId: message.guild.id, channelId: channel.id },
        { upsert: true, new: true }
      );
      logStaffAction(client, `🎂 **Salon anniversaires** → <#${channel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les anniversaires seront annoncés dans <#${channel.id}>.`);
    }

    if (!content.startsWith('!anniversaire')) return;

    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !anniversaire définir DD/MM[/YYYY] ---
    if (sub === 'définir' || sub === 'definir') {
      const dateStr = args[2];
      if (!dateStr) return message.reply('Usage : `!anniversaire définir DD/MM` ou `!anniversaire définir DD/MM/YYYY`');
      const parts = dateStr.split('/');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      const year = parts[2] ? parseInt(parts[2]) : null;
      const testYear = year || 2000;
      const testDate = new Date(testYear, month - 1, day);
      const isValidDate = !isNaN(day) && !isNaN(month) &&
        testDate.getFullYear() === testYear &&
        testDate.getMonth() === month - 1 &&
        testDate.getDate() === day;
      if (!isValidDate || month < 1 || month > 12)
        return message.reply('❌ Date invalide (ex : `29/02` n\'existe pas). Utilise `DD/MM` ou `DD/MM/YYYY`.');

      await Birthday.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        { guildId: message.guild.id, userId: message.author.id, day, month, year },
        { upsert: true, new: true }
      );
      return message.reply(`🎂 Ton anniversaire a été enregistré : **${day}/${month}${year ? `/${year}` : ''}**`);
    }

    // --- !anniversaire supprimer ---
    if (sub === 'supprimer') {
      const deleted = await Birthday.findOneAndDelete({ guildId: message.guild.id, userId: message.author.id });
      if (!deleted) return message.reply('❌ Tu n\'as pas enregistré d\'anniversaire.');
      return message.reply('✅ Ton anniversaire a été supprimé.');
    }

    // --- !anniversaire liste ---
    if (!sub || sub === 'liste') {
      const birthdays = await Birthday.find({ guildId: message.guild.id }).sort({ month: 1, day: 1 });
      if (!birthdays.length) return message.reply('Aucun anniversaire enregistré. Utilise `!anniversaire définir DD/MM`.');

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

    // --- !anniversaire prochains [N] ---
    if (sub === 'prochains') {
      const days = Math.min(parseInt(args[2]) || 30, 90);
      const all  = await Birthday.find({ guildId: message.guild.id });
      if (!all.length) return message.reply('Aucun anniversaire enregistré.');

      const today = new Date();
      const year  = today.getFullYear();

      const upcoming = all
        .map(b => {
          let next = new Date(year, b.month - 1, b.day);
          if (next < today) next = new Date(year + 1, b.month - 1, b.day);
          const diffDays = Math.floor((next - today) / 86400000);
          return { b, next, diffDays };
        })
        .filter(x => x.diffDays <= days)
        .sort((a, z) => a.diffDays - z.diffDays);

      if (!upcoming.length)
        return message.reply(`Aucun anniversaire dans les **${days}** prochains jours.`);

      const embed = new EmbedBuilder()
        .setTitle(`🎂 Prochains anniversaires — ${days} jours`)
        .setColor(0xFEE75C)
        .setDescription(
          upcoming.map(({ b, next, diffDays }) => {
            const label = diffDays === 0 ? "**Aujourd'hui !** 🎉" : `dans **${diffDays}j**`;
            return `• <@${b.userId}> — **${String(b.day).padStart(2,'0')}/${String(b.month).padStart(2,'0')}** (${label})`;
          }).join('\n')
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !anniversaire vérifier [@user] ---
    if (sub === 'vérifier' || sub === 'verifier') {
      const target = message.mentions.users.first() || message.author;
      const b = await Birthday.findOne({ guildId: message.guild.id, userId: target.id });
      if (!b) return message.reply(`❌ ${target.username} n'a pas enregistré son anniversaire.`);
      return message.reply(`🎂 L'anniversaire de **${target.username}** : **${String(b.day).padStart(2,'0')}/${String(b.month).padStart(2,'0')}${b.year ? `/${b.year}` : ''}**`);
    }

    message.reply(
      '**Commandes `!anniversaire` :**\n' +
      '`!anniversaire définir DD/MM` — Enregistrer ton anniversaire\n' +
      '`!anniversaire définir DD/MM/YYYY` — Avec l\'année\n' +
      '`!anniversaire liste` — Voir tous les anniversaires\n' +
      '`!anniversaire prochains [N]` — Prochains anniversaires sur N jours (défaut 30)\n' +
      '`!anniversaire vérifier [@user]` — Vérifier un anniversaire\n' +
      '`!anniversaire supprimer` — Supprimer ton anniversaire\n' +
      '`!salonanniversaires #salon` — Configurer le salon d\'annonce *(staff)*'
    );
    } catch (err) {
      console.error('[birthday] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
