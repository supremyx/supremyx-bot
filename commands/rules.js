const Rules = require('../database/models/Rules');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (
      !content.startsWith('!regles') &&
      !content.startsWith('!definirregles') &&
      !content.startsWith('!ajouterregle') &&
      !content.startsWith('!supprimerregle') &&
      !content.startsWith('!modifierregle') &&
      !content.startsWith('!deplacerregle') &&
      !content.startsWith('!effacerregles')
    ) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // ─── !rules — afficher ────────────────────────────────────────
    if (cmd === '!regles') {
      const cd = checkCooldown(message.author.id, 'regles', 10, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'regles');

      const doc = await Rules.findOne();
      if (!doc || !doc.rules.length)
        return message.reply('Aucune règle de tournoi définie. Un staff peut en ajouter avec `!definirregles`.');

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

    // ─── !definirregles <titre> | règle1 | règle2 | ... ────────────
    if (cmd === '!definirregles') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const raw = content.slice('!definirregles'.length).trim();
      if (!raw)
        return message.reply(
          '**Usage :** `!definirregles <titre> | <règle1> | <règle2> | ...`\n' +
          '**Exemple :** `!definirregles Règles S2 | Pas de cheating | Respect obligatoire`'
        );

      const parts = raw.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length < 2)
        return message.reply('❌ Il faut au moins un titre et une règle. Sépare-les avec `|`.');

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
        .setDescription(`**${rules.length}** règle(s) enregistrée(s) sous **${title}**.\nUtilise \`!regles\` pour les afficher.`)
        .setFooter({ text: `Défini par ${message.author.tag}` })
        .setTimestamp();

      logStaffAction(client, `📋 **Règles tournoi** — ${rules.length} règle(s) | Titre : "${title}" | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // ─── !addrule <règle> ─────────────────────────────────────────
    if (cmd === '!ajouterregle') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const rule = content.slice('!ajouterregle'.length).trim();
      if (!rule) return message.reply('Usage : `!ajouterregle <texte de la règle>`');

      let doc = await Rules.findOne();
      if (!doc) return message.reply('❌ Aucune règle définie. Utilise d\'abord `!definirregles` pour créer la liste.');

      doc.rules.push(rule);
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `➕ **Règle ajoutée** — "${rule}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${doc.rules.length}** ajoutée : *${rule}*`);
    }

    // ─── !editrule <numéro> <nouveau texte> ───────────────────────
    if (cmd === '!modifierregle') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const num = parseInt(args[1]);
      const newText = args.slice(2).join(' ').trim();

      const doc = await Rules.findOne();
      if (!doc || !doc.rules.length) return message.reply('❌ Aucune règle définie.');
      if (isNaN(num) || num < 1 || num > doc.rules.length)
        return message.reply(`❌ Numéro invalide. Les règles vont de **1** à **${doc.rules.length}**.`);
      if (!newText) return message.reply('Usage : `!modifierregle <numéro> <nouveau texte>`');

      const old = doc.rules[num - 1];
      doc.rules[num - 1] = newText;
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `✏️ **Règle modifiée** — #${num} | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${num}** modifiée :\n~~${old}~~\n→ ${newText}`);
    }

    // ─── !moverule <numéro> <nouvelle position> ───────────────────
    if (cmd === '!deplacerregle') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const from = parseInt(args[1]);
      const to   = parseInt(args[2]);

      const doc = await Rules.findOne();
      if (!doc || !doc.rules.length) return message.reply('❌ Aucune règle définie.');
      if (isNaN(from) || from < 1 || from > doc.rules.length ||
          isNaN(to)   || to   < 1 || to   > doc.rules.length)
        return message.reply(`❌ Numéros invalides. Les règles vont de **1** à **${doc.rules.length}**.\nUsage : \`!deplacerregle <de> <vers>\``);
      if (from === to) return message.reply('⚠️ La règle est déjà à cette position.');

      const [moved] = doc.rules.splice(from - 1, 1);
      doc.rules.splice(to - 1, 0, moved);
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `🔀 **Règle déplacée** — #${from} → #${to} | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle déplacée de la position **${from}** vers **${to}** : *${moved}*`);
    }

    // ─── !delrule <numéro> ────────────────────────────────────────
    if (cmd === '!supprimerregle') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const num = parseInt(args[1]);
      const doc = await Rules.findOne();

      if (!doc || !doc.rules.length) return message.reply('❌ Aucune règle définie.');
      if (isNaN(num) || num < 1 || num > doc.rules.length)
        return message.reply(`❌ Numéro invalide. Les règles vont de **1** à **${doc.rules.length}**.`);

      const removed = doc.rules.splice(num - 1, 1)[0];
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `🗑️ **Règle supprimée** — "${removed}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${num}** supprimée : ~~${removed}~~`);
    }

    // ─── !clearrules — tout effacer ───────────────────────────────
    if (cmd === '!effacerregles') {
      if (!isStaff) return message.reply('❌ Staff uniquement.');

      const doc = await Rules.findOne();
      if (!doc || !doc.rules.length) return message.reply('❌ Aucune règle à effacer.');

      const count = doc.rules.length;
      doc.rules = [];
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `🗑️ **Toutes les règles effacées** — ${count} règle(s) | Par : ${message.author.tag}`);
      return message.reply(`✅ **${count}** règle(s) supprimée(s). Utilise \`!definirregles\` pour en redéfinir.`);
    }
    } catch (err) {
      console.error('[rules] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
