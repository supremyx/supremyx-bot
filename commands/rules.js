const Rules = require('../database/models/Rules');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!rules') && !content.startsWith('!setrules') && !content.startsWith('!addrule') && !content.startsWith('!delrule')) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !rules — afficher les règles ---
    if (cmd === '!rules') {
      const doc = await Rules.findOne();

      if (!doc || !doc.rules.length) {
        return message.reply('Aucune règle définie pour le moment. Un staff peut en ajouter avec `!setrules`.');
      }

      const rulesText = doc.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n');
      const lastUpdate = new Date(doc.updatedAt).toLocaleDateString('fr-FR');

      const embed = new EmbedBuilder()
        .setTitle(`📋 ${doc.title}`)
        .setColor(0x5865F2)
        .setDescription(rulesText)
        .setFooter({ text: `Mis à jour le ${lastUpdate} par ${doc.updatedBy}` })
        .setTimestamp(doc.updatedAt);

      return message.channel.send({ embeds: [embed] });
    }

    // --- !setrules <titre> | règle1 | règle2 | ... ---
    if (cmd === '!setrules') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!setrules'.length).trim();
      if (!raw) {
        return message.reply(
          '**Usage :**\n' +
          '`!setrules <titre> | <règle1> | <règle2> | ...`\n\n' +
          '**Exemple :**\n' +
          '`!setrules Règles Saison 2 | Pas de cheating | Respect obligatoire | 3 matches minimum`'
        );
      }

      const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) {
        return message.reply('❌ Il faut au moins un titre et une règle. Sépare-les avec `|`.');
      }

      const title = parts[0];
      const rules = parts.slice(1);

      await Rules.findOneAndUpdate(
        {},
        { title, rules, updatedBy: message.author.tag },
        { upsert: true, new: true }
      );

      const embed = new EmbedBuilder()
        .setTitle('✅ Règles mises à jour')
        .setColor(0x57F287)
        .setDescription(`**${rules.length}** règle(s) enregistrée(s) sous le titre **${title}**.\nUtilise \`!rules\` pour les afficher.`)
        .setFooter({ text: `Défini par ${message.author.tag}` })
        .setTimestamp();

      logStaffAction(client, `📋 **Règles mises à jour** — ${rules.length} règle(s) | Titre : "${title}" | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !addrule <règle> — ajouter une règle à la liste existante ---
    if (cmd === '!addrule') {
      if (!isStaff) return message.reply('Staff uniquement');

      const rule = content.slice('!addrule'.length).trim();
      if (!rule) return message.reply('Usage : `!addrule <texte de la règle>`');

      const doc = await Rules.findOne();
      if (!doc) return message.reply('❌ Aucune règle définie. Utilise d\'abord `!setrules` pour créer la liste.');

      doc.rules.push(rule);
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `➕ **Règle ajoutée** — "${rule}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${doc.rules.length}** ajoutée : *${rule}*`);
    }

    // --- !delrule <numéro> — supprimer une règle par son numéro ---
    if (cmd === '!delrule') {
      if (!isStaff) return message.reply('Staff uniquement');

      const num = parseInt(args[1]);
      const doc = await Rules.findOne();

      if (!doc || !doc.rules.length) return message.reply('❌ Aucune règle définie.');
      if (isNaN(num) || num < 1 || num > doc.rules.length) {
        return message.reply(`❌ Numéro invalide. Les règles vont de 1 à ${doc.rules.length}.`);
      }

      const removed = doc.rules.splice(num - 1, 1)[0];
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `🗑️ **Règle supprimée** — "${removed}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${num}** supprimée : *${removed}*`);
    }
  });
};
