const { EmbedBuilder } = require('discord.js');
const CommandStat = require('../database/models/CommandStat');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.content.trim() !== '!statsbot') return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    try {
      const guildId = message.guild.id;
      const total = await CommandStat.countDocuments({ guildId });
      const since = await CommandStat.countDocuments({
        guildId,
        usedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      // Top 10 commands
      const topCmds = await CommandStat.aggregate([
        { $match: { guildId } },
        { $group: { _id: '$command', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      // Top 8 users
      const topUsers = await CommandStat.aggregate([
        { $match: { guildId } },
        { $group: { _id: { userId: '$userId', username: '$username' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]);

      // Top 5 channels
      const topChannels = await CommandStat.aggregate([
        { $match: { guildId } },
        { $group: { _id: { channelId: '$channelId', channelName: '$channelName' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      // First and last usage
      const first = await CommandStat.findOne({ guildId }).sort({ usedAt: 1 }).lean();
      const last  = await CommandStat.findOne({ guildId }).sort({ usedAt: -1 }).lean();

      const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const medal = ['🥇', '🥈', '🥉'];

      const cmdLines = topCmds.map((c, i) =>
        `${medal[i] || `\`${String(i + 1).padStart(2)}\``} \`${c._id}\` — **${c.count}** fois`
      ).join('\n') || '—';

      const userLines = topUsers.map((u, i) =>
        `${medal[i] || `\`${String(i + 1).padStart(2)}\``} **${u._id.username}** — ${u.count} cmds`
      ).join('\n') || '—';

      const channelLines = topChannels.map((ch, i) =>
        `${medal[i] || `\`${String(i + 1).padStart(2)}\``} <#${ch._id.channelId}> — ${ch.count} cmds`
      ).join('\n') || '—';

      const embed = new EmbedBuilder()
        .setTitle('📊 Statistiques du Bot — SUPREMYX')
        .setColor(0x5865F2)
        .addFields(
          {
            name: '📈 Utilisation globale',
            value: [
              `> Total commandes : **${total.toLocaleString('fr-FR')}**`,
              `> Ces 7 derniers jours : **${since.toLocaleString('fr-FR')}**`,
              `> Première utilisation : ${fmt(first?.usedAt)}`,
              `> Dernière utilisation : ${fmt(last?.usedAt)}`
            ].join('\n'),
            inline: false
          },
          {
            name: '🏆 Top 10 commandes',
            value: cmdLines,
            inline: false
          },
          {
            name: '👤 Top 8 membres actifs',
            value: userLines,
            inline: true
          },
          {
            name: '💬 Top 5 canaux',
            value: channelLines,
            inline: true
          }
        )
        .setFooter({ text: 'SUPREMYX • Statistiques en temps réel' })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[botstats]', err);
      message.reply('❌ Erreur lors de la récupération des statistiques.');
    }
  });
};
