const XpEntry = require('../database/models/XpEntry');
const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      const content = message.content.trim();
      if (!content.startsWith('!topactivite')) return;
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const cd = checkCooldown(message.author.id, 'topactivite', 15, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'topactivite');

      const args = content.split(' ');
      const N = Math.min(Math.max(parseInt(args[1]) || 10, 1), 25);

      const entries = await XpEntry.find({ guildId: message.guild.id })
        .sort({ xp: -1 })
        .limit(N);

      if (!entries.length) return message.reply('❌ Aucun membre actif enregistré pour ce serveur.');

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const medals = ['🥇', '🥈', '🥉'];

      const rows = entries.map((e, i) => {
        const medal = medals[i] ?? `**#${i + 1}**`;
        const lastSeen = e.lastXpAt
          ? `<t:${Math.floor(new Date(e.lastXpAt).getTime() / 1000)}:R>`
          : '*jamais*';
        const active = e.lastXpAt && new Date(e.lastXpAt) > sevenDaysAgo ? '🟢' : '⚪';
        return `${medal} <@${e.userId}> — **${e.xp.toLocaleString()} XP** · Niv. **${e.level}** · ${active} ${lastSeen}`;
      });

      const activeCount = entries.filter(e => e.lastXpAt && new Date(e.lastXpAt) > sevenDaysAgo).length;

      const embed = new EmbedBuilder()
        .setTitle(`🏃 Top ${N} membres les plus actifs`)
        .setColor(0xEB459E)
        .setDescription(rows.join('\n'))
        .addFields({ name: '🟢 Actifs cette semaine', value: `${activeCount}/${entries.length}`, inline: true })
        .setFooter({ text: '🟢 Actif < 7 jours • ⚪ Inactif depuis + de 7 jours' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[topactivite]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
