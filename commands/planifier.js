const { EmbedBuilder } = require('discord.js');
const AutoMessage = require('../database/models/AutoMessage');
const { startAutoMessageManager, computeNextRun, describeSchedule } = require('../utils/autoMessageManager');
const { staffLog } = require('../utils/staffLog');

// ─── Constantes ────────────────────────────────────────────────────────────

const JOURS_FR = {
  dimanche: 0, dim: 0,
  lundi: 1,    lun: 1,
  mardi: 2,    mar: 2,
  mercredi: 3, mer: 3,
  jeudi: 4,    jeu: 4,
  vendredi: 5, ven: 5,
  samedi: 6,   sam: 6,
};

const JOURS_LABEL = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

const MOIS_FR = {
  janvier:1,   jan:1,
  fevrier:2,   fev:2, février:2,
  mars:3,
  avril:4,     avr:4,
  mai:5,
  juin:6,
  juillet:7,   jul:7,
  aout:8,      août:8,
  septembre:9, sep:9,
  octobre:10,  oct:10,
  novembre:11, nov:11,
  decembre:12, dec:12, décembre:12,
};

function pad2(n) { return String(n).padStart(2, '0'); }

function formatNextRun(date) {
  if (!date) return '—';
  const d = new Date(date);
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth()+1)}/${d.getUTCFullYear()} à ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} (heure Abidjan)`;
}

// ─── Parsers ───────────────────────────────────────────────────────────────

function parseHHMM(raw) {
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { hour: h, minute: min };
}

function parseDDMMYYYY(raw) {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month, year };
}

function parseDDMM(raw) {
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const day = parseInt(m[1]), month = parseInt(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month };
}

// ─── AIDE ──────────────────────────────────────────────────────────────────

const AIDE = [
  '**📅 Commandes `!planifier` — Messages automatiques (heure Abidjan / UTC)**',
  '',
  '**Créer un message automatique :**',
  '`!planifier créer #salon | [Titre >> ]Contenu | quotidien | HH:MM [| couleur]`',
  '`!planifier créer #salon | [Titre >> ]Contenu | hebdo | lundi | HH:MM [| couleur]`',
  '`!planifier créer #salon | [Titre >> ]Contenu | mensuel | 15 | HH:MM [| couleur]`',
  '`!planifier créer #salon | [Titre >> ]Contenu | annuel | 01/06 | HH:MM [| couleur]`',
  '`!planifier créer #salon | [Titre >> ]Contenu | unique | 20/06/2026 | HH:MM [| couleur]`',
  '',
  '**Gérer les messages :**',
  '`!planifier liste` — Voir tous les messages programmés',
  '`!planifier voir <ID>` — Détails d\'un message',
  '`!planifier modifier <ID> | #salon | Contenu | type | horaire` — Modifier sans supprimer',
  '`!planifier dupliquer <ID> [| #autre-salon]` — Cloner un message (copie en pause pour ajustement)',
  '`!planifier pause <ID>` — Mettre en pause / reprendre',
  '`!planifier supprimer <ID>` — Supprimer définitivement',
  '`!planifier tester <ID>` — Envoyer maintenant (test)',
  '',
  '**Couleurs :** `rouge` `vert` `bleu` `jaune` `orange` `violet` `rose` `or` `cyan` `gris` ou `#HEX`',
  '**Titre optionnel :** ajoute `Titre >> ` avant le contenu.',
  '',
  '**Exemples :**',
  '`!planifier créer #général | 🌅 Bonne journée à tous ! | quotidien | 07:00`',
  '`!planifier créer #général | Recap >> Voici le résumé de la semaine. | hebdo | lundi | 18:00 | violet`',
  '`!planifier créer #annonces | 📋 Inscription >> Inscris-toi sur [notre site](https://supremyx.pro) ! | mensuel | 1 | 20:00 | or`',
].join('\n');

// ─── Module ────────────────────────────────────────────────────────────────

module.exports = (client) => {
  startAutoMessageManager(client);

  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!planifier')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!planifier'.length).trim();
    const sub  = rest.split(/\s+/)[0]?.toLowerCase();

    // ── Aide ──────────────────────────────────────────────────────
    if (!rest || sub === 'aide') {
      return message.reply(AIDE);
    }

    // ── Liste ──────────────────────────────────────────────────────
    if (sub === 'liste') {
      const docs = await AutoMessage.find({ guildId: message.guild.id }).sort({ createdAt: -1 }).limit(20);
      if (!docs.length) return message.reply('📭 Aucun message automatique configuré. Utilise `!planifier créer` pour en ajouter un.');

      const embed = new EmbedBuilder()
        .setTitle('📅 Messages automatiques')
        .setColor(0x5865F2)
        .setFooter({ text: `${docs.length} message(s) · !planifier voir <ID> pour les détails` })
        .setTimestamp();

      for (const doc of docs) {
        const statut = doc.active ? '🟢 Actif' : '🔴 Pausé';
        const titre  = doc.title  ? `**${doc.title}**` : '*(sans titre)*';
        const apercu = doc.content.slice(0, 60) + (doc.content.length > 60 ? '…' : '');
        embed.addFields({
          name:  `${statut} · \`${doc._id}\``,
          value: `${titre} — ${describeSchedule(doc)}\n↳ <#${doc.channelId}> · ${apercu}`,
        });
      }

      return message.reply({ embeds: [embed] });
    }

    // ── Voir ───────────────────────────────────────────────────────
    if (sub === 'voir') {
      const id = rest.split(/\s+/)[1];
      if (!id) return message.reply('Usage : `!planifier voir <ID>`');

      const doc = await AutoMessage.findOne({ _id: id, guildId: message.guild.id }).catch(() => null);
      if (!doc) return message.reply('❌ Message introuvable avec cet ID.');

      const embed = new EmbedBuilder()
        .setTitle('📋 Détails du message automatique')
        .setColor(doc.active ? 0x57F287 : 0x808080)
        .addFields(
          { name: 'ID',          value: `\`${doc._id}\``,               inline: false },
          { name: 'Statut',      value: doc.active ? '🟢 Actif' : '🔴 Pausé', inline: true },
          { name: 'Salon',       value: `<#${doc.channelId}>`,            inline: true },
          { name: 'Fréquence',   value: describeSchedule(doc),            inline: false },
          { name: 'Prochaine',   value: formatNextRun(doc.nextRun),        inline: false },
          { name: 'Dernière',    value: doc.lastRun ? formatNextRun(doc.lastRun) : 'Jamais', inline: false },
          { name: 'Contenu',     value: (doc.title ? `**${doc.title}**\n` : '') + doc.content.slice(0, 500), inline: false },
          { name: 'Créé par',    value: doc.createdBy || '—',             inline: true },
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // ── Pause / Reprendre ──────────────────────────────────────────
    if (sub === 'pause') {
      const id = rest.split(/\s+/)[1];
      if (!id) return message.reply('Usage : `!planifier pause <ID>`');

      const doc = await AutoMessage.findOne({ _id: id, guildId: message.guild.id }).catch(() => null);
      if (!doc) return message.reply('❌ Message introuvable.');

      doc.active = !doc.active;
      if (doc.active && doc.type !== 'unique') {
        doc.nextRun = computeNextRun(doc);
      }
      await doc.save();

      const etat = doc.active ? '🟢 repris' : '🔴 mis en pause';
      message.reply(`✅ Message \`${doc._id}\` ${etat}.`);

      await staffLog(client, {
        action: 'planifier-pause',
        details: `**ID :** \`${doc._id}\` — ${doc.active ? 'Repris' : 'Pausé'}`,
        author: message.author.tag
      });
      return;
    }

    // ── Supprimer ──────────────────────────────────────────────────
    if (sub === 'supprimer') {
      const id = rest.split(/\s+/)[1];
      if (!id) return message.reply('Usage : `!planifier supprimer <ID>`');

      const doc = await AutoMessage.findOneAndDelete({ _id: id, guildId: message.guild.id }).catch(() => null);
      if (!doc) return message.reply('❌ Message introuvable.');

      message.reply(`🗑️ Message automatique \`${doc._id}\` supprimé.`);

      await staffLog(client, {
        action: 'planifier-supprimer',
        details: `**ID :** \`${doc._id}\` — ${describeSchedule(doc)}`,
        author: message.author.tag
      });
      return;
    }

    // ── Modifier ───────────────────────────────────────────────────
    if (sub === 'modifier') {
      const bodyRaw = rest.slice(sub.length).trim();
      const parts   = bodyRaw.split('|').map(p => p.trim());

      // parts[0] = ID, parts[1] = #salon, parts[2] = contenu, parts[3] = type, parts[4..] = horaire + couleur
      const id = parts[0];
      if (!id || parts.length < 4) {
        return message.reply([
          '**Usage `!planifier modifier` :**',
          '`!planifier modifier <ID> | #salon | [Titre >> ]Contenu | type | horaire [| couleur]`',
          '',
          '**Exemples :**',
          '`!planifier modifier 6648... | #général | 🌅 Bon matin ! | quotidien | 08:00`',
          '`!planifier modifier 6648... | ici | Recap >> Résumé hebdo. | hebdo | lundi | 18:00 | violet`',
          '',
          'Reprend exactement la même syntaxe que `!planifier créer`, mais commence par l\'ID.',
        ].join('\n'));
      }

      const doc = await AutoMessage.findOne({ _id: id, guildId: message.guild.id }).catch(() => null);
      if (!doc) return message.reply('❌ Message introuvable avec cet ID. Utilise `!planifier liste` pour voir les IDs.');

      const channelArg = parts[1];
      const rawContent = parts[2];
      const typeRaw    = parts[3]?.toLowerCase();

      const target = channelArg.toLowerCase() === 'ici'
        ? message.channel
        : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg.replace(/\D/g,'')) || null);
      if (!target) return message.reply('❌ Salon introuvable.');

      let title = '', msgContent = rawContent;
      if (rawContent.includes(' >> ')) {
        const sep = rawContent.indexOf(' >> ');
        title      = rawContent.slice(0, sep).trim();
        msgContent = rawContent.slice(sep + 4).trim();
      }
      if (!msgContent) return message.reply('❌ Le contenu est requis.');

      const TYPES = ['unique', 'quotidien', 'hebdo', 'mensuel', 'annuel'];
      if (!TYPES.includes(typeRaw)) return message.reply(`❌ Type invalide. Utilise : ${TYPES.join(', ')}`);

      // Couleur = dernier argument si mot-clé ou #HEX
      const COLOR_KEYS = ['rouge','vert','bleu','jaune','orange','violet','blanc','noir','or','cyan','rose','gris'];
      let extraParts = parts.slice(4);
      const lastPart = extraParts[extraParts.length - 1]?.toLowerCase();
      let couleur = doc.color || 'bleu';
      if (lastPart && (COLOR_KEYS.includes(lastPart) || lastPart.startsWith('#'))) {
        couleur = extraParts.pop();
      }

      // Réinitialise les champs de schedule
      doc.set({
        channelId: target.id, title, content: msgContent,
        type: typeRaw, color: couleur,
        dayOfWeek: null, dayOfMonth: null, month: null, day: null, runAt: null,
        hour: 0, minute: 0,
      });

      if (typeRaw === 'quotidien') {
        if (!extraParts[0]) return message.reply('❌ Précise l\'heure : `| HH:MM`');
        const hm = parseHHMM(extraParts[0]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        doc.hour = hm.hour; doc.minute = hm.minute;
      } else if (typeRaw === 'hebdo') {
        if (extraParts.length < 2) return message.reply('❌ Précise le jour et l\'heure : `| lundi | HH:MM`');
        const dow = JOURS_FR[extraParts[0].toLowerCase()];
        if (dow === undefined) return message.reply(`❌ Jour invalide. Utilise : ${JOURS_LABEL.join(', ')}`);
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        doc.dayOfWeek = dow; doc.hour = hm.hour; doc.minute = hm.minute;
      } else if (typeRaw === 'mensuel') {
        if (extraParts.length < 2) return message.reply('❌ Précise le jour du mois et l\'heure : `| 15 | HH:MM`');
        const dom = parseInt(extraParts[0]);
        if (isNaN(dom) || dom < 1 || dom > 31) return message.reply('❌ Jour du mois invalide (1-31).');
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        doc.dayOfMonth = dom; doc.hour = hm.hour; doc.minute = hm.minute;
      } else if (typeRaw === 'annuel') {
        if (extraParts.length < 2) return message.reply('❌ Précise la date et l\'heure : `| 01/06 | HH:MM`');
        const dm = parseDDMM(extraParts[0]);
        if (!dm) return message.reply('❌ Date invalide. Format : `DD/MM`');
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        doc.day = dm.day; doc.month = dm.month; doc.hour = hm.hour; doc.minute = hm.minute;
      } else if (typeRaw === 'unique') {
        if (extraParts.length < 2) return message.reply('❌ Précise la date et l\'heure : `| 20/06/2026 | HH:MM`');
        const dmy = parseDDMMYYYY(extraParts[0]);
        if (!dmy) return message.reply('❌ Date invalide. Format : `DD/MM/YYYY`');
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        const runAt = new Date(Date.UTC(dmy.year, dmy.month - 1, dmy.day, hm.hour, hm.minute));
        if (runAt <= new Date()) return message.reply('❌ Cette date est déjà passée.');
        doc.runAt = runAt; doc.hour = hm.hour; doc.minute = hm.minute;
      }

      doc.nextRun = computeNextRun(doc);
      doc.active  = true;
      await doc.save();

      const { resolveColor } = require('../utils/autoMessageManager');
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Message automatique modifié')
        .setColor(resolveColor(couleur))
        .addFields(
          { name: 'ID',        value: `\`${doc._id}\``,         inline: false },
          { name: 'Salon',     value: `<#${target.id}>`,          inline: true  },
          { name: 'Fréquence', value: describeSchedule(doc),      inline: false },
          { name: 'Prochaine', value: formatNextRun(doc.nextRun), inline: false },
          { name: 'Contenu',   value: (title ? `**${title}**\n` : '') + msgContent.slice(0, 300), inline: false },
        )
        .setFooter({ text: `Modifié par ${message.author.tag}` })
        .setTimestamp();

      message.reply({ embeds: [confirmEmbed] });

      await staffLog(client, {
        action: 'planifier-modifier',
        details: `**ID :** \`${doc._id}\`\n**Salon :** <#${target.id}>\n**Fréquence :** ${describeSchedule(doc)}\n**Prochaine :** ${formatNextRun(doc.nextRun)}`,
        author: message.author.tag
      });
      return;
    }

    // ── Dupliquer ──────────────────────────────────────────────────
    if (sub === 'dupliquer') {
      const parts = rest.slice(sub.length).trim().split('|').map(p => p.trim());
      const id    = parts[0];
      if (!id) return message.reply('Usage : `!planifier dupliquer <ID> [| #autre-salon]`');

      const original = await AutoMessage.findOne({ _id: id, guildId: message.guild.id }).catch(() => null);
      if (!original) return message.reply('❌ Message introuvable avec cet ID.');

      // Salon optionnel : si précisé, on change le salon de la copie
      const channelArg = parts[1];
      let targetChannelId = original.channelId;
      if (channelArg) {
        const ch = message.mentions.channels.first()
          || message.guild.channels.cache.get(channelArg.replace(/\D/g, '')) || null;
        if (!ch) return message.reply('❌ Salon introuvable.');
        targetChannelId = ch.id;
      }

      const copy = new AutoMessage({
        guildId:    original.guildId,
        channelId:  targetChannelId,
        title:      original.title,
        content:    original.content,
        color:      original.color,
        type:       original.type,
        hour:       original.hour,
        minute:     original.minute,
        dayOfWeek:  original.dayOfWeek,
        dayOfMonth: original.dayOfMonth,
        month:      original.month,
        day:        original.day,
        runAt:      original.runAt,
        active:     false,          // pausé par défaut pour ajustement avant activation
        createdBy:  message.author.tag,
      });
      copy.nextRun = computeNextRun(copy);
      await copy.save();

      const { resolveColor } = require('../utils/autoMessageManager');
      const confirmEmbed = new EmbedBuilder()
        .setTitle('📋 Message dupliqué')
        .setColor(resolveColor(copy.color))
        .setDescription('Le message est **en pause** — utilise `!planifier pause` pour l\'activer, ou `!planifier modifier` pour l\'ajuster avant.')
        .addFields(
          { name: 'Nouvel ID',   value: `\`${copy._id}\``,                       inline: false },
          { name: 'Salon',       value: `<#${targetChannelId}>`,                   inline: true  },
          { name: 'Fréquence',   value: describeSchedule(copy),                    inline: false },
          { name: 'Prochaine',   value: formatNextRun(copy.nextRun),               inline: false },
          { name: 'Contenu',     value: (copy.title ? `**${copy.title}**\n` : '') + copy.content.slice(0, 300), inline: false },
        )
        .setFooter({ text: `Dupliqué depuis ${original._id} · par ${message.author.tag}` })
        .setTimestamp();

      message.reply({ embeds: [confirmEmbed] });

      await staffLog(client, {
        action: 'planifier-dupliquer',
        details: `**Copie de :** \`${original._id}\`\n**Nouvel ID :** \`${copy._id}\`\n**Salon :** <#${targetChannelId}>`,
        author: message.author.tag
      });
      return;
    }

    // ── Test ───────────────────────────────────────────────────────
    if (sub === 'tester') {
      const id = rest.split(/\s+/)[1];
      if (!id) return message.reply('Usage : `!planifier tester <ID>`');

      const doc = await AutoMessage.findOne({ _id: id, guildId: message.guild.id }).catch(() => null);
      if (!doc) return message.reply('❌ Message introuvable.');

      const channel = client.channels.cache.get(doc.channelId);
      if (!channel) return message.reply('❌ Salon introuvable (supprimé ?).');

      const { resolveColor } = require('../utils/autoMessageManager');
      const embed = new EmbedBuilder()
        .setColor(resolveColor(doc.color))
        .setDescription(doc.content)
        .setFooter({ text: '🧪 Envoi de test — non comptabilisé' })
        .setTimestamp();
      if (doc.title) embed.setTitle(doc.title);

      await channel.send({ embeds: [embed] });
      message.reply(`✅ Message test envoyé dans <#${channel.id}>.`);
      return;
    }

    // ── Créer ──────────────────────────────────────────────────────
    if (sub === 'créer' || sub === 'creer') {
      const body  = rest.slice(sub.length).trim();
      const parts = body.split('|').map(p => p.trim());

      // parts[0] = #salon
      // parts[1] = [Titre >> ]Contenu
      // parts[2] = type
      // parts[3..] = selon le type + couleur optionnelle en dernier

      if (parts.length < 3) return message.reply(`❌ Arguments insuffisants.\n${AIDE}`);

      const channelArg = parts[0];
      const rawContent = parts[1];
      const typeRaw    = parts[2]?.toLowerCase();

      const target = channelArg.toLowerCase() === 'ici'
        ? message.channel
        : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg.replace(/\D/g,'')) || null);

      if (!target) return message.reply('❌ Salon introuvable. Mentionne un salon avec `#` ou écris `ici`.');

      // Titre optionnel : "Titre >> Contenu"
      let title = '', msgContent = rawContent;
      if (rawContent.includes(' >> ')) {
        const sep = rawContent.indexOf(' >> ');
        title      = rawContent.slice(0, sep).trim();
        msgContent = rawContent.slice(sep + 4).trim();
      }
      if (!msgContent) return message.reply('❌ Le contenu du message est requis.');

      const TYPES = ['unique', 'quotidien', 'hebdo', 'mensuel', 'annuel'];
      if (!TYPES.includes(typeRaw)) return message.reply(`❌ Type invalide. Utilise : ${TYPES.join(', ')}`);

      let docData = {
        guildId:   message.guild.id,
        channelId: target.id,
        title,
        content:   msgContent,
        type:      typeRaw,
        createdBy: message.author.tag,
      };

      // Couleur = dernier argument si c'est un mot couleur ou #HEX
      const COLOR_KEYS = ['rouge','vert','bleu','jaune','orange','violet','blanc','noir','or','cyan','rose','gris'];
      let extraParts = parts.slice(3);
      const lastPart = extraParts[extraParts.length - 1]?.toLowerCase();
      let couleur = 'bleu';
      if (lastPart && (COLOR_KEYS.includes(lastPart) || lastPart.startsWith('#'))) {
        couleur = extraParts.pop();
      }
      docData.color = couleur;

      // ── quotidien : | HH:MM ──────────────────────────────────────
      if (typeRaw === 'quotidien') {
        if (!extraParts[0]) return message.reply('❌ Précise l\'heure : `| HH:MM`');
        const hm = parseHHMM(extraParts[0]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM` (ex : `07:00`)');
        Object.assign(docData, hm);
      }

      // ── hebdo : | jour | HH:MM ───────────────────────────────────
      else if (typeRaw === 'hebdo') {
        if (extraParts.length < 2) return message.reply('❌ Précise le jour et l\'heure : `| lundi | HH:MM`');
        const dow = JOURS_FR[extraParts[0].toLowerCase()];
        if (dow === undefined) return message.reply(`❌ Jour invalide. Utilise : ${JOURS_LABEL.join(', ')}`);
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        Object.assign(docData, { dayOfWeek: dow, ...hm });
      }

      // ── mensuel : | N | HH:MM ─────────────────────────────────────
      else if (typeRaw === 'mensuel') {
        if (extraParts.length < 2) return message.reply('❌ Précise le jour du mois et l\'heure : `| 15 | HH:MM`');
        const dom = parseInt(extraParts[0]);
        if (isNaN(dom) || dom < 1 || dom > 31) return message.reply('❌ Jour du mois invalide (1-31).');
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        Object.assign(docData, { dayOfMonth: dom, ...hm });
      }

      // ── annuel : | DD/MM | HH:MM ──────────────────────────────────
      else if (typeRaw === 'annuel') {
        if (extraParts.length < 2) return message.reply('❌ Précise la date annuelle et l\'heure : `| 01/06 | HH:MM`');
        const dm = parseDDMM(extraParts[0]);
        if (!dm) return message.reply('❌ Date invalide. Format : `DD/MM` (ex : `01/06`)');
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        Object.assign(docData, { day: dm.day, month: dm.month, ...hm });
      }

      // ── unique : | DD/MM/YYYY | HH:MM ─────────────────────────────
      else if (typeRaw === 'unique') {
        if (extraParts.length < 2) return message.reply('❌ Précise la date et l\'heure : `| 20/06/2026 | HH:MM`');
        const dmy = parseDDMMYYYY(extraParts[0]);
        if (!dmy) return message.reply('❌ Date invalide. Format : `DD/MM/YYYY` (ex : `20/06/2026`)');
        const hm = parseHHMM(extraParts[1]);
        if (!hm) return message.reply('❌ Heure invalide. Format : `HH:MM`');
        const runAt = new Date(Date.UTC(dmy.year, dmy.month - 1, dmy.day, hm.hour, hm.minute));
        if (runAt <= new Date()) return message.reply('❌ Cette date est déjà passée.');
        Object.assign(docData, { runAt, hour: hm.hour, minute: hm.minute });
      }

      // Calcule nextRun
      const doc = new AutoMessage(docData);
      doc.nextRun = computeNextRun(doc);
      await doc.save();

      const { resolveColor } = require('../utils/autoMessageManager');
      const confirmEmbed = new EmbedBuilder()
        .setTitle('✅ Message automatique créé')
        .setColor(resolveColor(couleur))
        .addFields(
          { name: 'ID',        value: `\`${doc._id}\``,         inline: false },
          { name: 'Salon',     value: `<#${target.id}>`,          inline: true  },
          { name: 'Type',      value: describeSchedule(doc),      inline: false },
          { name: 'Prochaine', value: formatNextRun(doc.nextRun), inline: false },
          { name: 'Contenu',   value: (title ? `**${title}**\n` : '') + msgContent.slice(0,300), inline: false },
        )
        .setFooter({ text: `Créé par ${message.author.tag} · !planifier tester ${doc._id} pour tester` })
        .setTimestamp();

      message.reply({ embeds: [confirmEmbed] });

      await staffLog(client, {
        action: 'planifier-créer',
        details: `**Salon :** <#${target.id}>\n**Fréquence :** ${describeSchedule(doc)}\n**Prochaine :** ${formatNextRun(doc.nextRun)}`,
        author: message.author.tag
      });
      return;
    }

    // ── Sous-commande inconnue ─────────────────────────────────────
    return message.reply(`❌ Sous-commande inconnue.\n${AIDE}`);
  });
};
