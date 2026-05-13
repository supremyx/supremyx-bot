const Reglement = require('../database/models/Reglement');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const CMDS = ['!règlement', '!reglement', '!regl'];

async function getOrCreate(guildId) {
  let doc = await Reglement.findOne({ guildId });
  if (!doc) {
    doc = await Reglement.create({
      guildId,
      sections: [
        {
          emoji: '🎮',
          title: 'Règles de compétition',
          rules: ['Tout match doit être rapporté au staff.', 'Les résultats doivent être prouvés par screenshot.', 'Tout abandon intentionnel est sanctionné.']
        },
        {
          emoji: '⚠️',
          title: 'Sanctions',
          rules: ['1er manquement : avertissement.', '2e manquement : mute temporaire.', '3e manquement : exclusion.']
        }
      ]
    });
  }
  return doc;
}

function buildEmbeds(doc) {
  const lastEdit = doc.updatedBy
    ? `Dernière modification par **${doc.updatedBy}** — <t:${Math.floor(new Date(doc.updatedAt).getTime() / 1000)}:R>`
    : '';

  const header = new EmbedBuilder()
    .setTitle(doc.title)
    .setColor(0x5865F2)
    .setTimestamp();

  if (doc.intro) header.setDescription(doc.intro);
  if (lastEdit) header.setFooter({ text: lastEdit.replace(/<t:[^>]+>/g, new Date(doc.updatedAt).toLocaleDateString('fr-FR')) });

  const embeds = [header];

  for (const section of doc.sections) {
    if (!section.rules.length) continue;
    const rulesText = section.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`${section.emoji} ${section.title}`)
      .setDescription(rulesText);
    embeds.push(embed);
  }

  if (embeds.length === 1) {
    header.setDescription((doc.intro ? doc.intro + '\n\n' : '') + '*Aucune section définie. Utilise `!règlement section add <emoji> <titre>`.*');
  }

  return embeds;
}

async function updatePinnedMessage(client, doc) {
  if (!doc.pinnedChannelId || !doc.pinnedMessageId) return false;
  try {
    const channel = client.channels.cache.get(doc.pinnedChannelId);
    if (!channel) return false;
    const msg = await channel.messages.fetch(doc.pinnedMessageId).catch(() => null);
    if (!msg) return false;
    const embeds = buildEmbeds(doc);
    await msg.edit({ embeds });
    return true;
  } catch {
    return false;
  }
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const isCmd = CMDS.some(c => content === c || content.startsWith(c + ' '));
    if (!isCmd) return;

    const isStaff = message.member?.permissions.has('Administrator');
    const prefix = CMDS.find(c => content === c || content.startsWith(c + ' '));
    const rest = content.slice(prefix.length).trim();
    const args = rest.split(' ');
    const sub = args[0]?.toLowerCase();
    const doc = await getOrCreate(message.guild.id);

    // ============================================================
    // !règlement — afficher
    // ============================================================
    if (!sub) {
      const embeds = buildEmbeds(doc);
      return message.channel.send({ embeds });
    }

    // ============================================================
    // !règlement titre <nouveau titre>
    // ============================================================
    if (sub === 'titre' || sub === 'title') {
      if (!isStaff) return message.reply('Staff uniquement');
      const newTitle = args.slice(1).join(' ').trim();
      if (!newTitle) return message.reply('Usage : `!règlement titre <nouveau titre>`');
      doc.title = newTitle;
      doc.updatedBy = message.author.tag;
      await doc.save();
      await updatePinnedMessage(client, doc);
      logStaffAction(client, `📖 **Règlement** — titre → "${newTitle}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Titre du règlement : **${newTitle}**`);
    }

    // ============================================================
    // !règlement intro <texte>
    // ============================================================
    if (sub === 'intro') {
      if (!isStaff) return message.reply('Staff uniquement');
      const text = args.slice(1).join(' ').trim();
      doc.intro = text;
      doc.updatedBy = message.author.tag;
      await doc.save();
      await updatePinnedMessage(client, doc);
      logStaffAction(client, `📖 **Règlement** — intro modifiée | Par : ${message.author.tag}`);
      return message.reply(text ? `✅ Introduction mise à jour.` : '✅ Introduction supprimée.');
    }

    // ============================================================
    // !règlement section add <emoji> <titre>
    // !règlement section del <num>
    // !règlement section rename <num> <nouveau titre>
    // !règlement section emoji <num> <emoji>
    // !règlement section list
    // ============================================================
    if (sub === 'section') {
      if (!isStaff) return message.reply('Staff uniquement');
      const sectionSub = args[1]?.toLowerCase();

      if (!sectionSub || sectionSub === 'list') {
        if (!doc.sections.length) return message.reply('Aucune section définie.');
        const lines = doc.sections.map((s, i) =>
          `**${i + 1}.** ${s.emoji} **${s.title}** — ${s.rules.length} règle(s)`
        ).join('\n');
        return message.reply(`**Sections du règlement :**\n${lines}`);
      }

      if (sectionSub === 'add') {
        const emoji = args[2] || '📌';
        const title = args.slice(3).join(' ').trim();
        if (!title) return message.reply('Usage : `!règlement section add <emoji> <titre>`\nEx : `!règlement section add 🎯 Règles avancées`');
        doc.sections.push({ emoji, title, rules: [] });
        doc.updatedBy = message.author.tag;
        await doc.save();
        await updatePinnedMessage(client, doc);
        logStaffAction(client, `📖 **Section ajoutée** — ${emoji} ${title} | Par : ${message.author.tag}`);
        return message.reply(`✅ Section **${emoji} ${title}** ajoutée (section **${doc.sections.length}**).`);
      }

      if (sectionSub === 'del' || sectionSub === 'delete') {
        const num = parseInt(args[2]);
        if (isNaN(num) || num < 1 || num > doc.sections.length)
          return message.reply(`❌ Numéro invalide (1–${doc.sections.length}).`);
        const removed = doc.sections.splice(num - 1, 1)[0];
        doc.updatedBy = message.author.tag;
        await doc.save();
        await updatePinnedMessage(client, doc);
        logStaffAction(client, `🗑️ **Section supprimée** — ${removed.emoji} ${removed.title} | Par : ${message.author.tag}`);
        return message.reply(`✅ Section **${removed.emoji} ${removed.title}** supprimée.`);
      }

      if (sectionSub === 'rename') {
        const num = parseInt(args[2]);
        const newName = args.slice(3).join(' ').trim();
        if (isNaN(num) || num < 1 || num > doc.sections.length || !newName)
          return message.reply('Usage : `!règlement section rename <num> <nouveau titre>`');
        const old = doc.sections[num - 1].title;
        doc.sections[num - 1].title = newName;
        doc.updatedBy = message.author.tag;
        await doc.save();
        await updatePinnedMessage(client, doc);
        logStaffAction(client, `✏️ **Section renommée** — "${old}" → "${newName}" | Par : ${message.author.tag}`);
        return message.reply(`✅ Section **${num}** renommée : **${newName}**`);
      }

      if (sectionSub === 'emoji') {
        const num = parseInt(args[2]);
        const emoji = args[3];
        if (isNaN(num) || num < 1 || num > doc.sections.length || !emoji)
          return message.reply('Usage : `!règlement section emoji <num> <emoji>`');
        doc.sections[num - 1].emoji = emoji;
        doc.updatedBy = message.author.tag;
        await doc.save();
        await updatePinnedMessage(client, doc);
        return message.reply(`✅ Emoji de la section **${num}** mis à jour : ${emoji}`);
      }

      return message.reply(
        '**Commandes sections :**\n' +
        '`!règlement section list` — Liste les sections\n' +
        '`!règlement section add <emoji> <titre>` — Ajouter une section\n' +
        '`!règlement section del <num>` — Supprimer une section\n' +
        '`!règlement section rename <num> <titre>` — Renommer\n' +
        '`!règlement section emoji <num> <emoji>` — Changer l\'emoji'
      );
    }

    // ============================================================
    // !règlement add <section_num> <règle>
    // ============================================================
    if (sub === 'add') {
      if (!isStaff) return message.reply('Staff uniquement');
      const num = parseInt(args[1]);
      const rule = args.slice(2).join(' ').trim();
      if (isNaN(num) || num < 1 || num > doc.sections.length || !rule)
        return message.reply(`Usage : \`!règlement add <section_num> <règle>\`\nSections disponibles : 1–${doc.sections.length}`);
      const section = doc.sections[num - 1];
      section.rules.push(rule);
      doc.updatedBy = message.author.tag;
      await doc.save();
      await updatePinnedMessage(client, doc);
      logStaffAction(client, `➕ **Règle ajoutée** — [${section.emoji} ${section.title}] "${rule}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${section.rules.length}** ajoutée dans **${section.emoji} ${section.title}**.`);
    }

    // ============================================================
    // !règlement edit <section_num> <rule_num> <nouveau texte>
    // ============================================================
    if (sub === 'edit') {
      if (!isStaff) return message.reply('Staff uniquement');
      const sNum = parseInt(args[1]);
      const rNum = parseInt(args[2]);
      const newText = args.slice(3).join(' ').trim();
      if (isNaN(sNum) || sNum < 1 || sNum > doc.sections.length)
        return message.reply(`Usage : \`!règlement edit <section> <règle> <nouveau texte>\`\nSections : 1–${doc.sections.length}`);
      const section = doc.sections[sNum - 1];
      if (isNaN(rNum) || rNum < 1 || rNum > section.rules.length)
        return message.reply(`❌ Règle invalide pour cette section (1–${section.rules.length}).`);
      if (!newText) return message.reply('❌ Indique le nouveau texte de la règle.');
      const old = section.rules[rNum - 1];
      section.rules[rNum - 1] = newText;
      doc.updatedBy = message.author.tag;
      await doc.save();
      await updatePinnedMessage(client, doc);
      logStaffAction(client, `✏️ **Règle modifiée** — [${section.title}] règle ${rNum} | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${rNum}** de **${section.emoji} ${section.title}** modifiée.\n~~${old}~~\n→ ${newText}`);
    }

    // ============================================================
    // !règlement del <section_num> <rule_num>
    // ============================================================
    if (sub === 'del' || sub === 'delete') {
      if (!isStaff) return message.reply('Staff uniquement');
      const sNum = parseInt(args[1]);
      const rNum = parseInt(args[2]);
      if (isNaN(sNum) || sNum < 1 || sNum > doc.sections.length)
        return message.reply(`Usage : \`!règlement del <section> <règle>\`\nSections : 1–${doc.sections.length}`);
      const section = doc.sections[sNum - 1];
      if (isNaN(rNum) || rNum < 1 || rNum > section.rules.length)
        return message.reply(`❌ Règle invalide (1–${section.rules.length}).`);
      const removed = section.rules.splice(rNum - 1, 1)[0];
      doc.updatedBy = message.author.tag;
      await doc.save();
      await updatePinnedMessage(client, doc);
      logStaffAction(client, `🗑️ **Règle supprimée** — [${section.title}] "${removed}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Règle **${rNum}** supprimée de **${section.emoji} ${section.title}** : ~~${removed}~~`);
    }

    // ============================================================
    // !règlement list <section_num> — détail d'une section
    // ============================================================
    if (sub === 'list') {
      const num = parseInt(args[1]);
      if (isNaN(num) || num < 1 || num > doc.sections.length) {
        // Show all sections overview
        const lines = doc.sections.map((s, i) =>
          `**${i + 1}.** ${s.emoji} **${s.title}** — ${s.rules.length} règle(s)`
        ).join('\n');
        return message.reply(`**Sections :**\n${lines || '*Aucune section*'}\n\nUtilise \`!règlement list <num>\` pour voir le détail.`);
      }
      const section = doc.sections[num - 1];
      const rulesText = section.rules.length
        ? section.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n')
        : '*Aucune règle dans cette section.*';
      const embed = new EmbedBuilder()
        .setTitle(`${section.emoji} ${section.title}`)
        .setColor(0x5865F2)
        .setDescription(rulesText)
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    // ============================================================
    // !règlement post [#channel] — poster et épingler dans un salon
    // ============================================================
    if (sub === 'post') {
      if (!isStaff) return message.reply('Staff uniquement');
      const targetChannel = message.mentions.channels.first() || message.channel;

      const embeds = buildEmbeds(doc);
      const sent = await targetChannel.send({ embeds });

      // Try to pin
      await sent.pin().catch(() => {});

      doc.pinnedChannelId = targetChannel.id;
      doc.pinnedMessageId = sent.id;
      doc.updatedBy = message.author.tag;
      await doc.save();

      logStaffAction(client, `📌 **Règlement posté** dans <#${targetChannel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Règlement posté${targetChannel.id !== message.channel.id ? ` dans <#${targetChannel.id}>` : ''} et épinglé.`);
    }

    // ============================================================
    // !règlement update — forcer la mise à jour du message épinglé
    // ============================================================
    if (sub === 'update') {
      if (!isStaff) return message.reply('Staff uniquement');
      if (!doc.pinnedChannelId || !doc.pinnedMessageId)
        return message.reply('❌ Aucun message épinglé. Utilise d\'abord `!règlement post [#salon]`.');
      const updated = await updatePinnedMessage(client, doc);
      if (updated) {
        logStaffAction(client, `🔄 **Règlement mis à jour** | Par : ${message.author.tag}`);
        return message.reply(`✅ Message épinglé mis à jour dans <#${doc.pinnedChannelId}>.`);
      }
      return message.reply('❌ Impossible de mettre à jour le message (introuvable ou permissions manquantes). Utilise `!règlement post` pour le reposter.');
    }

    // ============================================================
    // !règlement reset — réinitialiser avec les sections par défaut
    // ============================================================
    if (sub === 'reset') {
      if (!isStaff) return message.reply('Staff uniquement');
      await Reglement.findOneAndDelete({ guildId: message.guild.id });
      await getOrCreate(message.guild.id);
      logStaffAction(client, `🔄 **Règlement réinitialisé** | Par : ${message.author.tag}`);
      return message.reply('✅ Règlement réinitialisé avec les 3 sections par défaut (générales, compétition, sanctions).');
    }

    // ============================================================
    // Help
    // ============================================================
    const embed = new EmbedBuilder()
      .setTitle('📖 Commandes — Règlement')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '👁️ Consultation',
          value: [
            '`!règlement` — Afficher le règlement complet',
            '`!règlement list` — Lister toutes les sections',
            '`!règlement list <num>` — Détail d\'une section',
          ].join('\n')
        },
        {
          name: '📝 Gestion du contenu *(staff)*',
          value: [
            '`!règlement titre <titre>` — Modifier le titre principal',
            '`!règlement intro <texte>` — Modifier l\'introduction',
            '`!règlement add <section> <règle>` — Ajouter une règle',
            '`!règlement edit <section> <num> <texte>` — Modifier une règle',
            '`!règlement del <section> <num>` — Supprimer une règle',
          ].join('\n')
        },
        {
          name: '🗂️ Gestion des sections *(staff)*',
          value: [
            '`!règlement section add <emoji> <titre>` — Ajouter une section',
            '`!règlement section del <num>` — Supprimer une section',
            '`!règlement section rename <num> <titre>` — Renommer',
            '`!règlement section emoji <num> <emoji>` — Changer l\'emoji',
          ].join('\n')
        },
        {
          name: '📌 Publication *(staff)*',
          value: [
            '`!règlement post [#salon]` — Poster et épingler le règlement',
            '`!règlement update` — Mettre à jour le message épinglé',
            '`!règlement reset` — Réinitialiser aux sections par défaut',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Aliases : !reglement, !regl' })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  });
};
