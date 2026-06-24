const StaffLogEntry = require('../database/models/StaffLogEntry');
const { EmbedBuilder } = require('discord.js');

const PAGE_SIZE = 10;

const CATEGORY_COLORS = {
  match: 0x57F287,
  modération: 0xED4245,
  tournoi: 0xFEE75C,
  données: 0xEB459E,
  config: 0x5865F2,
  ticket: 0x99AAB5,
  rang: 0xFEE75C,
  trophée: 0xFEE75C,
  événement: 0xEB459E,
  équipe: 0x57F287,
  général: 0x5865F2
};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!journaux') && !content.startsWith('!logs')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const args = content.split(' ').slice(1);
    const sub = args[0]?.toLowerCase();

    // --- !logs vider ---
    if (sub === 'vider') {
      const filter = m => m.author.id === message.author.id && m.content === 'CONFIRMER';
      await message.reply('⚠️ Cette action effacera **tout l\'historique** des logs. Réponds `CONFIRMER` dans les 20 secondes.');
      try {
        await message.channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
        const result = await StaffLogEntry.deleteMany({});
        return message.channel.send(`🗑️ **${result.deletedCount}** entrée(s) de log supprimée(s).`);
      } catch {
        return message.channel.send('❌ Annulé.');
      }
    }

    // --- !logs stats ---
    if (sub === 'stats') {
      const total = await StaffLogEntry.countDocuments();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayCount = await StaffLogEntry.countDocuments({ createdAt: { $gte: today } });

      const byCategory = await StaffLogEntry.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      const catRows = byCategory.map(c => `\`${c._id}\` — ${c.count}`).join('\n');

      const embed = new EmbedBuilder()
        .setTitle('📊 Statistiques des logs staff')
        .setColor(0x5865F2)
        .addFields(
          { name: '📋 Total',         value: `${total}`,      inline: true },
          { name: "📅 Aujourd'hui",   value: `${todayCount}`, inline: true },
          { name: '🗂️ Par catégorie', value: catRows || 'Aucune donnée' }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !logs aujourdhui ---
    if (sub === 'aujourdhui') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const entries = await StaffLogEntry.find({ createdAt: { $gte: today } }).sort({ createdAt: -1 }).limit(20);

      if (!entries.length) return message.reply("📭 Aucun log aujourd'hui.");

      const embed = new EmbedBuilder()
        .setTitle("📋 Logs d'aujourd'hui")
        .setColor(0x5865F2)
        .setDescription(
          entries.map(e => {
            const time = new Date(e.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return `\`${time}\` ${e.message}`;
          }).join('\n')
        )
        .setFooter({ text: `${entries.length} action(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !logs <catégorie> [page] OR !logs [page] ---
    const CATEGORIES = ['match', 'modération', 'tournoi', 'données', 'config', 'ticket', 'rang', 'trophée', 'événement', 'équipe', 'général'];
    let category = null;
    let page = 1;

    if (sub && CATEGORIES.includes(sub)) {
      category = sub;
      page = parseInt(args[1]) || 1;
    } else if (sub && !isNaN(parseInt(sub))) {
      page = parseInt(sub);
    } else if (sub) {
      // Recherche par mot-clé
      const keyword = args.join(' ');
      const entries = await StaffLogEntry.find({
        message: { $regex: new RegExp(keyword, 'i') }
      }).sort({ createdAt: -1 }).limit(15);

      if (!entries.length) return message.reply(`📭 Aucun log contenant **${keyword}**.`);

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Logs — recherche : "${keyword}"`)
        .setColor(0x5865F2)
        .setDescription(
          entries.map(e => {
            const date = new Date(e.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            return `\`${date}\` ${e.message}`;
          }).join('\n')
        )
        .setFooter({ text: `${entries.length} résultat(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Par défaut : liste paginée
    const filterQuery = category ? { category } : {};
    const total = await StaffLogEntry.countDocuments(filterQuery);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, page), totalPages);

    const entries = await StaffLogEntry.find(filterQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE);

    if (!entries.length) return message.reply('📭 Aucun log trouvé.');

    const color = category ? (CATEGORY_COLORS[category] || 0x5865F2) : 0x5865F2;
    const title = category ? `📋 Logs — ${category}` : '📋 Historique des actions staff';

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(
        entries.map(e => {
          const date = new Date(e.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
          return `\`${date}\` ${e.message}`;
        }).join('\n')
      )
      .setFooter({ text: `Page ${page}/${totalPages} • ${total} entrée(s) au total` })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  });
};
