const { EmbedBuilder } = require('discord.js');
const AdminLog = require('../database/models/AdminLog');
const { checkPerm, permDenied, LEVELS } = require('../utils/permissions');

const PAGE_SIZE = 10;
const SEV_COLORS = { info: 0x5865F2, warn: 0xFEE75C, critical: 0xED4245 };
const CAT_EMOJI  = { données: '💾', config: '⚙️', modération: '🔨', match: '🎮', tournoi: '🏆', général: '📋' };

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!journauxadmin') && !content.startsWith('!jadmin')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!await checkPerm(message, LEVELS.ADMIN)) return permDenied(message, LEVELS.ADMIN);

    const args = content.split(/\s+/).slice(1);
    const sub  = args[0]?.toLowerCase();

    if (sub === 'statistiques') {
      const [total, todayCount, bySev, byCat] = await Promise.all([
        AdminLog.countDocuments({ guildId: message.guild.id }),
        AdminLog.countDocuments({ guildId: message.guild.id, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
        AdminLog.aggregate([{ $match: { guildId: message.guild.id } }, { $group: { _id: '$severity', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
        AdminLog.aggregate([{ $match: { guildId: message.guild.id } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      ]);

      const SEV_LABELS_FR = { critical: 'critique', warn: 'avertissement', info: 'info' };
      const sevLines = bySev.map(s => `${s._id === 'critical' ? '🔴' : s._id === 'warn' ? '⚠️' : 'ℹ️'} \`${SEV_LABELS_FR[s._id] ?? s._id}\` — ${s.count}`).join('\n') || '—';
      const catLines = byCat.map(c => `${CAT_EMOJI[c._id] ?? '📋'} \`${c._id}\` — ${c.count}`).join('\n') || '—';

      const embed = new EmbedBuilder()
        .setTitle('📊 Statistiques — Logs d\'administration')
        .setColor(0x5865F2)
        .addFields(
          { name: '📋 Total',          value: `${total}`,      inline: true },
          { name: "📅 Aujourd'hui",    value: `${todayCount}`, inline: true },
          { name: '🔴 Par sévérité',   value: sevLines },
          { name: '🗂️ Par catégorie',  value: catLines },
        )
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    if (sub === 'critique') {
      const entries = await AdminLog.find({ guildId: message.guild.id, severity: 'critical' })
        .sort({ createdAt: -1 }).limit(15).lean();
      if (!entries.length) return message.reply('✅ Aucun log critique.');
      const lines = entries.map(e => {
        const d = new Date(e.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `\`${d}\` 🔴 **${e.action}**${e.detail ? ` — ${e.detail}` : ''}${e.userTag ? ` *(${e.userTag})*` : ''}`;
      }).join('\n');
      return message.channel.send({ embeds: [new EmbedBuilder().setTitle('🔴 Logs critiques').setColor(0xED4245).setDescription(lines).setTimestamp()] });
    }

    if (sub === 'vider') {
      const filter = m => m.author.id === message.author.id && m.content === 'CONFIRMER';
      await message.reply('⚠️ Cette action effacera **tous les logs admin** de ce serveur. Réponds `CONFIRMER` dans les 20s.');
      try {
        await message.channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
        const r = await AdminLog.deleteMany({ guildId: message.guild.id });
        return message.channel.send(`🗑️ **${r.deletedCount}** log(s) admin supprimé(s).`);
      } catch { return message.channel.send('❌ Annulé.'); }
    }

    if (sub === 'utilisateur') {
      const userId = args[1];
      if (!userId) return message.reply('Usage : `!journauxadmin utilisateur <userId>`');
      const entries = await AdminLog.find({ guildId: message.guild.id, userId }).sort({ createdAt: -1 }).limit(15).lean();
      if (!entries.length) return message.reply('📭 Aucun log pour cet utilisateur.');
      const lines = entries.map(e => {
        const d = new Date(e.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const sev = e.severity === 'critical' ? '🔴' : e.severity === 'warn' ? '⚠️' : 'ℹ️';
        return `\`${d}\` ${sev} ${e.action}${e.detail ? ` — ${e.detail}` : ''}`;
      }).join('\n');
      return message.channel.send({ embeds: [new EmbedBuilder().setTitle(`📋 Logs — <@${userId}>`).setColor(0x5865F2).setDescription(lines).setTimestamp()] });
    }

    // !journauxadmin [categorie] [page]
    const CATEGORIES = ['données', 'config', 'modération', 'match', 'tournoi', 'général'];
    let category = null;
    let page = 1;

    if (sub && CATEGORIES.includes(sub)) { category = sub; page = parseInt(args[1]) || 1; }
    else if (sub && !isNaN(parseInt(sub))) { page = parseInt(sub); }

    const filter = { guildId: message.guild.id, ...(category ? { category } : {}) };
    const total  = await AdminLog.countDocuments(filter);
    const pages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pages);

    const entries = await AdminLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean();
    if (!entries.length) return message.reply('📭 Aucun log trouvé.');

    const lines = entries.map(e => {
      const d   = new Date(e.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const sev = e.severity === 'critical' ? '🔴' : e.severity === 'warn' ? '⚠️' : 'ℹ️';
      const who = e.userTag ? ` *(${e.userTag})*` : '';
      return `\`${d}\` ${sev} **${e.action}**${e.detail ? ` — ${e.detail}` : ''}${who}`;
    }).join('\n');

    const color = SEV_COLORS[entries[0]?.severity] ?? 0x5865F2;
    const embed = new EmbedBuilder()
      .setTitle(category ? `📋 Logs admin — ${category}` : '📋 Logs d\'administration')
      .setColor(color)
      .setDescription(lines)
      .setFooter({ text: `Page ${page}/${pages} • ${total} entrée(s) — !jadmin statistiques | critique | utilisateur <id> | vider` })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  });
};
