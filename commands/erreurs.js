const { EmbedBuilder } = require('discord.js');
const ErrorLog = require('../database/models/ErrorLog');

const PAGE_SIZE = 8;

const SOURCE_LABELS = {
  uncaughtException:  '💥 Exception',
  unhandledRejection: '⚠️ Rejet promesse',
  discordError:       '🤖 Erreur Discord',
  command:            '🔧 Commande'
};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!erreurs')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const args = content.split(' ').slice(1);
    const sub  = args[0]?.toLowerCase();

    try {

      // --- !erreurs stats ---
      if (sub === 'stats') {
        const total      = await ErrorLog.countDocuments();
        const unresolved = await ErrorLog.countDocuments({ resolved: false });
        const today      = new Date(); today.setHours(0, 0, 0, 0);
        const todayCount = await ErrorLog.countDocuments({ createdAt: { $gte: today } });

        const bySrc = await ErrorLog.aggregate([
          { $group: { _id: '$source', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        const byCmd = await ErrorLog.aggregate([
          { $match: { command: { $ne: null } } },
          { $group: { _id: '$command', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 8 }
        ]);

        const srcRows = bySrc.map(s => `${SOURCE_LABELS[s._id] || s._id} — **${s.count}**`).join('\n') || '—';
        const cmdRows = byCmd.map(c => `\`${c._id}\` — ${c.count} erreur(s)`).join('\n') || '—';

        const embed = new EmbedBuilder()
          .setTitle('📊 Statistiques des erreurs bot')
          .setColor(0xED4245)
          .addFields(
            {
              name: '📈 Global',
              value: [
                `> Total enregistré : **${total}**`,
                `> Non résolues : **${unresolved}**`,
                `> Aujourd'hui : **${todayCount}**`
              ].join('\n')
            },
            { name: '🗂️ Par type',         value: srcRows, inline: true },
            { name: '🔧 Commandes fautives', value: cmdRows, inline: true }
          )
          .setFooter({ text: 'SUPREMYX • Logs d\'erreurs' })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // --- !erreurs resoudre <id> ---
      if (sub === 'resoudre') {
        const id = args[1];
        if (!id) return message.reply('Usage : `!erreurs resoudre <id>`');

        const entry = id.length === 24
          ? await ErrorLog.findByIdAndUpdate(id, { resolved: true }, { new: true }).catch(() => null)
          : await (async () => {
              const all = await ErrorLog.find({ resolved: false }).sort({ createdAt: -1 }).limit(200);
              const match = all.find(e => e._id.toString().slice(-5) === id);
              if (!match) return null;
              return ErrorLog.findByIdAndUpdate(match._id, { resolved: true }, { new: true });
            })();

        if (!entry) return message.reply('❌ Erreur introuvable.');
        return message.reply(`✅ Erreur **#${entry._id.toString().slice(-5)}** marquée comme résolue.`);
      }

      // --- !erreurs vider ---
      if (sub === 'vider') {
        const filter = m => m.author.id === message.author.id && m.content === 'CONFIRMER';
        await message.reply('⚠️ Réponds `CONFIRMER` dans les 20 secondes pour effacer **tout** l\'historique des erreurs.');
        try {
          await message.channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
          const result = await ErrorLog.deleteMany({});
          return message.channel.send(`🗑️ **${result.deletedCount}** entrée(s) supprimée(s).`);
        } catch {
          return message.channel.send('❌ Annulé (délai dépassé).');
        }
      }

      // --- !erreurs <source> [page] OR !erreurs [page] ---
      const SOURCES = ['uncaughtexception', 'unhandledrejection', 'discorderror', 'command'];
      const sourceMap = {
        uncaughtexception:  'uncaughtException',
        unhandledrejection: 'unhandledRejection',
        discorderror:       'discordError',
        command:            'command'
      };

      let filter   = {};
      let page     = 1;
      let srcLabel = null;

      if (sub && SOURCES.includes(sub)) {
        filter   = { source: sourceMap[sub] };
        srcLabel = SOURCE_LABELS[sourceMap[sub]];
        page     = parseInt(args[1]) || 1;
      } else if (sub === 'nonresolues') {
        filter   = { resolved: false };
        srcLabel = '🔴 Non résolues';
        page     = parseInt(args[1]) || 1;
      } else if (sub && !isNaN(parseInt(sub))) {
        page = parseInt(sub);
      } else if (sub) {
        return message.reply(
          '**Commandes `!erreurs` :**\n' +
          '`!erreurs` — Dernières erreurs (paginé)\n' +
          '`!erreurs nonresolues` — Erreurs non résolues\n' +
          '`!erreurs command` — Erreurs de commandes\n' +
          '`!erreurs stats` — Statistiques globales\n' +
          '`!erreurs resoudre <id>` — Marquer comme résolue\n' +
          '`!erreurs vider` — Effacer tout l\'historique'
        );
      }

      const total      = await ErrorLog.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      page             = Math.min(Math.max(1, page), totalPages);

      const entries = await ErrorLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE);

      if (!entries.length) return message.reply('✅ Aucune erreur enregistrée.');

      const fmt = d => new Date(d).toLocaleDateString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      const embed = new EmbedBuilder()
        .setTitle(`🚨 ${srcLabel || 'Erreurs bot'} — Page ${page}/${totalPages}`)
        .setColor(0xED4245)
        .setFooter({ text: `${total} erreur(s) au total • !erreurs stats pour un résumé` })
        .setTimestamp();

      for (const e of entries) {
        const id    = e._id.toString().slice(-5);
        const src   = SOURCE_LABELS[e.source] || e.source;
        const cmd   = e.command ? ` • \`${e.command}\`` : '';
        const guild = e.guildName ? ` • ${e.guildName}` : '';
        const user  = e.userTag  ? ` • ${e.userTag}` : '';
        const resolvedTag = e.resolved ? ' ✅' : '';

        embed.addFields({
          name:  `\`#${id}\` ${src}${cmd}${resolvedTag} — ${fmt(e.createdAt)}`,
          value: `\`\`\`${e.errorMessage.slice(0, 200)}\`\`\`${guild}${user}`
        });
      }

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error('[erreurs]', err);
      message.reply('❌ Erreur lors de la récupération des logs.').catch(() => {});
    }
  });
};
