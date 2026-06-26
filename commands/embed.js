const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { staffLog } = require('../utils/staffLog');
const { logStaffAction } = require('../utils/staffLog');
const ScheduledEmbed = require('../database/models/ScheduledEmbed');

// ─── Couleurs ────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  rouge: 0xED4245, rougepur: 0xFF0000, vert: 0x57F287, bleu: 0x5865F2,
  bleuciel: 0x87CEEB, jaune: 0xFEE75C, orange: 0xE67E22, violet: 0x9B59B6,
  blanc: 0xFFFFFF, noir: 0x2C2F33, or: 0xF1C40F, cyan: 0x1ABC9C,
  rose: 0xEB459E, gris: 0x808080,
};

function parseColor(raw = '') {
  const key = raw.trim().toLowerCase();
  if (COLOR_MAP[key] !== undefined) return COLOR_MAP[key];
  if (key.startsWith('#')) {
    const parsed = parseInt(key.slice(1), 16);
    if (!isNaN(parsed)) return parsed;
  }
  return 0x5865F2;
}

function parseButtons(raw = '') {
  return raw.split('|').map(s => s.trim()).filter(Boolean).map(part => {
    const sep = part.indexOf('>>');
    if (sep === -1) return null;
    const label = part.slice(0, sep).trim();
    const url   = part.slice(sep + 2).trim();
    if (!label || !url.startsWith('http')) return null;
    return { label, url };
  }).filter(Boolean).slice(0, 5);
}

function resolveTarget(message, channelArg) {
  if (channelArg.toLowerCase() === 'ici') return message.channel;
  return message.mentions.channels.first() || message.guild.channels.cache.get(channelArg.replace(/\D/g, '')) || null;
}

// ─── Prévisualisation avec ✅/❌ ─────────────────────────────────────────────
async function awaitConfirmation(message, previewEmbed, components = null) {
  const payload = { embeds: [previewEmbed] };
  if (components) payload.components = components;
  const preview = await message.channel.send(payload);
  await preview.react('✅').catch(() => {});
  await preview.react('❌').catch(() => {});
  const notice = await message.channel.send('📋 **Prévisualisation** — Réagis ✅ pour publier ou ❌ pour annuler *(60s)*');
  let confirmed = false;
  try {
    const collected = await preview.awaitReactions({
      filter: (r, u) => ['✅', '❌'].includes(r.emoji.name) && u.id === message.author.id,
      max: 1, time: 60_000, errors: ['time'],
    });
    confirmed = collected.first()?.emoji?.name === '✅';
  } catch { confirmed = false; }
  await preview.delete().catch(() => {});
  await notice.delete().catch(() => {});
  return confirmed;
}

// ─── Texte d'aide ────────────────────────────────────────────────────────────
const HELP_TEXT = [
  '**Commandes `!embed` :**',
  '',
  '**📤 Publier un embed dans un salon :**',
  '`!embed envoyer #salon | Titre | Description | couleur`',
  '`!embed envoyer ici | Titre | Description | couleur`',
  '`!embed envoyer aperçu | #salon | Titre | Description | couleur` — prévisualiser avant publication',
  '',
  '**🔘 Embed avec boutons URL :**',
  '`!embed boutons #salon | Titre | Description | Texte >> https://... | couleur`',
  '`!embed boutons aperçu | #salon | Titre | Description | Texte >> https://... | couleur`',
  '',
  '**⚙️ Embed avancé (dans le salon courant) :**',
  '`!embed avancé Titre | Description | couleur | image_url | pied de page`',
  '',
  '**✨ Embed riche (avec thumbnail, auteur, liens) :**',
  '`!embed riche #salon | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon_url | pied de page`',
  '`!embed riche aperçu | #salon | ...` — prévisualiser avant publication',
  '`!embed riche modifier #salon | ID_message | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon | pied de page` — éditer un embed riche existant (`-` pour conserver un champ)',
  'Dans la description, utilise `[texte](https://lien)` pour créer des liens cliquables.',
  '',
  '**📋 Gérer les embeds existants :**',
  '`!embed liste [#salon]` — lister les embeds du bot dans un salon',
  '`!embed modifier #salon | ID | Nouveau titre | Nouvelle description | couleur`',
  '`!embed supprimer #salon | ID_message`',
  '`!embed cloner #salon | ID_message | #salon_destination` — dupliquer un embed vers un autre salon',
  '',
  '**🕐 Planification :**',
  '`!embed programmer #salon | Titre | Description | couleur | YYYY-MM-DD HH:MM`',
  '`!embed riche programmer #salon | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon_url | pied de page | YYYY-MM-DD HH:MM`',
  '`!embed programmes` — voir les embeds en attente de publication',
  '`!embed déprogrammer <id>` — annuler un embed planifié',
  '',
  '**🎨 Couleurs :** `rouge` `vert` `bleu` `jaune` `orange` `violet` `rose` `or` `cyan` `gris` ou `#HEX`',
].join('\n');

module.exports = (client) => {

  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const content = message.content.trim();
      if (content !== '!embed' && !content.startsWith('!embed ')) return;

      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const rest = content.slice('!embed'.length).trim();
      const spaceIdx = rest.indexOf(' ');
      const sub = (spaceIdx === -1 ? rest : rest.slice(0, spaceIdx)).toLowerCase();
      const args = spaceIdx === -1 ? '' : rest.slice(spaceIdx + 1).trim();

      // ── Aide ───────────────────────────────────────────────────────────────
      if (!sub) return message.reply(HELP_TEXT);

      // ── !embed envoyer ─────────────────────────────────────────────────────
      if (sub === 'envoyer') {
        if (!args) return message.reply(
          '**Usage :** `!embed envoyer [aperçu] #salon | Titre | Description | couleur`\n' +
          '`!embed envoyer ici | Titre | Description | couleur`'
        );

        const parts = args.split('|').map(p => p.trim());
        const isPreview  = parts[0].toLowerCase() === 'aperçu';
        const channelArg = isPreview ? parts[1] : parts[0];
        const title      = isPreview ? (parts[2] || '') : (parts[1] || '');
        const desc       = isPreview ? (parts[3] || '') : (parts[2] || '');
        const colorRaw   = isPreview ? (parts[4] || 'bleu') : (parts[3] || 'bleu');

        if (!desc) return message.reply('❌ La description est requise.');
        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable. Mentionne un salon avec `#` ou écris `ici`.');

        const embed = new EmbedBuilder()
          .setColor(parseColor(colorRaw))
          .setDescription(desc)
          .setFooter({ text: `Posté par ${message.author.tag}` })
          .setTimestamp();
        if (title) embed.setTitle(title);

        if (isPreview) {
          const confirmed = await awaitConfirmation(message, embed);
          if (!confirmed) return message.reply('❌ Publication annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        await target.send({ embeds: [embed] });
        await message.delete().catch(() => {});
        if (target.id !== message.channel.id)
          message.channel.send(`✅ Embed publié dans <#${target.id}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        await staffLog(client, {
          action: 'embed envoyer',
          details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Contenu :** ${desc.slice(0, 200)}${isPreview ? '\n*(prévisualisé)*' : ''}`,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed boutons ─────────────────────────────────────────────────────
      if (sub === 'boutons') {
        if (!args) return message.reply(
          '**Usage :** `!embed boutons [aperçu] #salon | Titre | Description | Texte >> https://... | couleur`\n' +
          'Maximum **5 boutons**. URLs commençant par `https://`.'
        );

        const parts = args.split('|').map(p => p.trim());
        const isPreview  = parts[0].toLowerCase() === 'aperçu';
        const channelArg = isPreview ? parts[1] : parts[0];
        const title      = isPreview ? (parts[2] || '') : (parts[1] || '');
        const desc       = isPreview ? (parts[3] || '') : (parts[2] || '');
        const extras     = isPreview ? parts.slice(4) : parts.slice(3);

        const colorRaw = extras.find(p => {
          const k = p.trim().toLowerCase();
          return (COLOR_MAP[k] !== undefined || k.startsWith('#')) && !p.includes('>>');
        }) || 'bleu';
        const buttonsRaw = extras.filter(p => p.includes('>>')).join('|');
        const buttons    = parseButtons(buttonsRaw);

        if (!desc) return message.reply('❌ La description est requise.');
        if (!buttons.length) return message.reply('❌ Aucun bouton valide. Format : `Texte >> https://url.com`');

        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable. Mentionne un salon avec `#` ou écris `ici`.');

        const embed = new EmbedBuilder()
          .setColor(parseColor(colorRaw))
          .setDescription(desc)
          .setFooter({ text: `Posté par ${message.author.tag}` })
          .setTimestamp();
        if (title) embed.setTitle(title);

        const row = new ActionRowBuilder().addComponents(
          buttons.map(b => new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link))
        );

        if (isPreview) {
          const confirmed = await awaitConfirmation(message, embed, [row]);
          if (!confirmed) return message.reply('❌ Publication annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        await target.send({ embeds: [embed], components: [row] });
        await message.delete().catch(() => {});
        if (target.id !== message.channel.id)
          message.channel.send(`✅ Embed avec boutons publié dans <#${target.id}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        await staffLog(client, {
          action: 'embed boutons',
          details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Boutons :** ${buttons.map(b => `[${b.label}](${b.url})`).join(', ')}${isPreview ? '\n*(prévisualisé)*' : ''}`,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed avancé ──────────────────────────────────────────────────────
      if (sub === 'avancé' || sub === 'avance') {
        if (!args) return message.reply(
          '**Usage :** `!embed avancé Titre | Description | couleur | image_url | pied de page`\n\n' +
          '**Exemples :**\n' +
          '`!embed avancé Bienvenue | Rejoins notre serveur !`\n' +
          '`!embed avancé Règles | Sois respectueux. | rouge`\n' +
          '`!embed avancé Annonce | Texte | #5865F2 | https://... | Pied de page`\n\n' +
          '**Couleurs :** `rouge` `vert` `bleu` `jaune` `orange` `violet` `blanc` `noir` `or` `cyan` ou `#HEX`'
        );

        const parts = args.split('|').map(p => p.trim());
        const title    = parts[0] || '';
        const desc     = parts[1] || '';
        const colorRaw = parts[2] || 'or';
        const imageUrl = parts[3] || '';
        const footer   = parts[4] || '';

        let color = COLOR_MAP[colorRaw.toLowerCase()] ?? 0xF1C40F;
        if (colorRaw.startsWith('#')) {
          const parsed = parseInt(colorRaw.slice(1), 16);
          if (!isNaN(parsed)) color = parsed;
        }

        const embed = new EmbedBuilder().setColor(color).setTimestamp();
        if (title)    embed.setTitle(title);
        if (desc)     embed.setDescription(desc);
        if (imageUrl) embed.setImage(imageUrl);
        if (footer)   embed.setFooter({ text: footer });

        await message.channel.send({ embeds: [embed] });
        try { await message.delete(); } catch {}

        logStaffAction(client, `📝 **Embed avancé posté** — "${title || 'Sans titre'}" | Par : ${message.author.tag}`);
        return;
      }

      // ── !embed liste ───────────────────────────────────────────────────────
      if (sub === 'liste') {
        const channelArg = args;
        const target = !channelArg
          ? message.channel
          : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg.replace(/\D/g, '')) || null);

        if (!target) return message.reply('❌ Salon introuvable.');

        let fetched;
        try { fetched = await target.messages.fetch({ limit: 100 }); }
        catch { return message.reply('❌ Impossible de lire les messages de ce salon (permissions manquantes ?).'); }

        const botEmbeds = fetched
          .filter(m => m.author.id === client.user.id && m.embeds.length > 0)
          .first(10);

        if (!botEmbeds.length)
          return message.reply(`❌ Aucun embed du bot trouvé dans <#${target.id}> (sur les 100 derniers messages).`);

        const lines = botEmbeds.map(m => {
          const emb = m.embeds[0];
          const t   = emb.title ? `**${emb.title}**` : '*(sans titre)*';
          const d   = emb.description ? emb.description.slice(0, 80).replace(/\n/g, ' ') + (emb.description.length > 80 ? '…' : '') : '*(vide)*';
          const btn = m.components.length > 0 ? ' 🔘' : '';
          return `\`${m.id}\` — ${t}${btn}\n↳ ${d}\n↳ [Aller au message](${m.url})`;
        });

        const listEmbed = new EmbedBuilder()
          .setTitle(`📋 Embeds du bot dans #${target.name}`)
          .setDescription(lines.join('\n\n'))
          .setColor(0x5865F2)
          .setFooter({ text: `${botEmbeds.length} embed(s) · Utilise !embed modifier pour éditer` })
          .setTimestamp();

        return message.reply({ embeds: [listEmbed] });
      }

      // ── !embed modifier ────────────────────────────────────────────────────
      if (sub === 'modifier') {
        if (!args || !args.includes('|')) return message.reply([
          '**Usage :** `!embed modifier #salon | ID_message | Nouveau titre | Nouvelle description | couleur`',
          '`!embed modifier ici | ID_message | Titre | Description | couleur`',
          '',
          '**Exemple :**',
          '`!embed modifier #annonces | 1234567890123456789 | 🏆 Tournoi MAJ | Inscriptions closes. | rouge`',
          '',
          '⚠️ Je ne peux modifier que mes propres messages.',
        ].join('\n'));

        const parts      = args.split('|').map(p => p.trim());
        const channelArg = parts[0];
        const msgId      = parts[1]?.replace(/\D/g, '');
        const title      = parts[2] || '';
        const desc       = parts[3] || '';
        const colorRaw   = parts[4] || 'bleu';

        if (!msgId) return message.reply('❌ ID de message invalide.');
        if (!desc)  return message.reply('❌ La nouvelle description est requise.');

        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable.');

        let targetMsg;
        try { targetMsg = await target.messages.fetch(msgId); }
        catch { return message.reply('❌ Message introuvable. Vérifie l\'ID et le salon.'); }

        if (targetMsg.author.id !== client.user.id)
          return message.reply('❌ Je ne peux modifier que mes propres messages.');
        if (!targetMsg.embeds.length)
          return message.reply('❌ Ce message ne contient pas d\'embed.');

        const updated = new EmbedBuilder()
          .setColor(parseColor(colorRaw))
          .setDescription(desc)
          .setFooter({ text: `Modifié par ${message.author.tag}` })
          .setTimestamp();
        if (title) updated.setTitle(title);

        await targetMsg.edit({ embeds: [updated], components: targetMsg.components });
        await message.delete().catch(() => {});
        message.channel.send(`✅ Embed modifié dans <#${target.id}>.`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        await staffLog(client, {
          action: 'embed modifier',
          details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Nouveau contenu :** ${desc.slice(0, 200)}`,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed supprimer ───────────────────────────────────────────────────
      if (sub === 'supprimer') {
        if (!args || !args.includes('|')) return message.reply([
          '**Usage :** `!embed supprimer #salon | ID_message`',
          '`!embed supprimer ici | ID_message`',
          '',
          '**Exemple :** `!embed supprimer #annonces | 1234567890123456789`',
          '',
          '⚠️ Je ne peux supprimer que mes propres messages.',
        ].join('\n'));

        const parts = args.split('|').map(p => p.trim());
        const channelArg = parts[0];
        const messageId  = parts[1];

        if (!messageId || !/^\d{15,20}$/.test(messageId))
          return message.reply('❌ ID de message invalide (identifiant numérique requis).');

        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable.');

        let targetMessage;
        try { targetMessage = await target.messages.fetch(messageId); }
        catch { return message.reply(`❌ Message \`${messageId}\` introuvable dans <#${target.id}>.`); }

        if (targetMessage.author.id !== client.user.id)
          return message.reply('⛔ Je ne peux supprimer que **mes propres messages**.');
        if (!targetMessage.embeds.length)
          return message.reply('⚠️ Ce message ne contient pas d\'embed.');

        const prev   = targetMessage.embeds[0];
        const ptitle = prev.title || '*(sans titre)*';
        const pdesc  = prev.description
          ? prev.description.slice(0, 120).replace(/\n/g, ' ') + (prev.description.length > 120 ? '…' : '')
          : '*(vide)*';
        const hasBtns = targetMessage.components.length > 0 ? ' 🔘 *(contient des boutons)*' : '';

        const confirmEmbed = new EmbedBuilder()
          .setTitle('🗑️ Confirmer la suppression')
          .setColor(0xED4245)
          .addFields(
            { name: '📋 Titre',  value: ptitle, inline: true },
            { name: '📍 Salon',  value: `<#${target.id}>`, inline: true },
            { name: '🆔 ID',     value: `\`${messageId}\``, inline: true },
            { name: '📝 Aperçu', value: pdesc + hasBtns },
          )
          .setFooter({ text: 'Réagis ✅ pour supprimer, ❌ pour annuler (30s)' });

        const confirmed = await awaitConfirmation(message, confirmEmbed);
        if (!confirmed)
          return message.channel.send('❌ Suppression annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

        try { await targetMessage.delete(); }
        catch { return message.reply('❌ Impossible de supprimer ce message (permissions manquantes ?).'); }

        await message.reply(`✅ Message \`${messageId}\` supprimé dans <#${target.id}>.`);

        await staffLog(client, {
          action: 'embed supprimer',
          details: `**Salon :** <#${target.id}>\n**ID :** \`${messageId}\`\n**Titre :** ${ptitle}`,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed cloner ──────────────────────────────────────────────────────
      if (sub === 'cloner') {
        if (!args || !args.includes('|')) return message.reply([
          '**Usage :** `!embed cloner #salon | ID_message | #salon_destination`',
          '`!embed cloner ici | ID_message | #salon_destination`',
          '',
          '**Exemple :** `!embed cloner #annonces | 1234567890123456789 | #général`',
          '',
          '⚠️ Je ne peux cloner que mes propres embeds.',
        ].join('\n'));

        const parts   = args.split('|').map(p => p.trim());
        const srcArg  = parts[0];
        const msgId   = parts[1]?.replace(/\D/g, '');
        const dstArg  = parts[2];

        if (!msgId || !/^\d{15,20}$/.test(msgId))
          return message.reply('❌ ID de message invalide (identifiant numérique requis).');
        if (!dstArg)
          return message.reply('❌ Salon de destination manquant.');

        const src = resolveTarget(message, srcArg);
        if (!src) return message.reply('❌ Salon source introuvable.');

        // Résoudre destination : mention ou ID
        const dstId = dstArg.replace(/\D/g, '');
        const dst   = message.guild.channels.cache.get(dstId) || null;
        if (!dst) return message.reply('❌ Salon de destination introuvable. Mentionne-le avec `#`.');

        let original;
        try { original = await src.messages.fetch(msgId); }
        catch { return message.reply(`❌ Message \`${msgId}\` introuvable dans <#${src.id}>.`); }

        if (original.author.id !== client.user.id)
          return message.reply('⛔ Je ne peux cloner que **mes propres messages**.');
        if (!original.embeds.length)
          return message.reply('⚠️ Ce message ne contient pas d\'embed à cloner.');

        // Reconstituer l'embed (EmbedBuilder n'accepte pas directement un Embed brut)
        const src_emb = original.embeds[0];
        const cloned  = new EmbedBuilder()
          .setColor(src_emb.color ?? 0x5865F2)
          .setFooter({ text: `Cloné par ${message.author.tag} depuis #${src.name}` })
          .setTimestamp();

        if (src_emb.title)       cloned.setTitle(src_emb.title);
        if (src_emb.description) cloned.setDescription(src_emb.description);
        if (src_emb.image?.url)  cloned.setImage(src_emb.image.url);
        if (src_emb.thumbnail?.url) cloned.setThumbnail(src_emb.thumbnail.url);
        if (src_emb.url)         cloned.setURL(src_emb.url);
        if (src_emb.fields?.length) cloned.addFields(src_emb.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })));

        // Conserver les composants (boutons) si présents
        const components = original.components.length ? original.components : [];

        const sent = await dst.send({ embeds: [cloned], components });
        await message.delete().catch(() => {});

        message.channel.send(
          `✅ Embed cloné dans <#${dst.id}>. [Voir le message](${sent.url})`
        ).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));

        await staffLog(client, {
          action: 'embed cloner',
          details: `**Source :** <#${src.id}> \`${msgId}\`\n**Destination :** <#${dst.id}>\n**Titre :** ${src_emb.title || '—'}`,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed programmer ──────────────────────────────────────────────────
      if (sub === 'programmer') {
        if (!args || !args.includes('|')) return message.reply([
          '**Usage :** `!embed programmer #salon | Titre | Description | couleur | YYYY-MM-DD HH:MM`',
          '',
          '**Exemple :**',
          '`!embed programmer #annonces | 🏆 Tournoi | Inscriptions ouvertes ! | or | 2025-07-14 20:00`',
          '',
          'L\'heure est en **heure d\'Abidjan** (UTC+0). Titre et couleur sont optionnels.',
        ].join('\n'));

        const parts      = args.split('|').map(p => p.trim());
        const channelArg = parts[0];
        const title      = parts[1] || '';
        const desc       = parts[2] || '';
        const colorRaw   = parts[3] || 'bleu';
        const dateRaw    = parts[4] || '';

        if (!desc)    return message.reply('❌ La description est requise.');
        if (!dateRaw) return message.reply('❌ La date est requise. Format : `YYYY-MM-DD HH:MM`');

        const match = dateRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
        if (!match) return message.reply('❌ Format de date invalide. Utilise `YYYY-MM-DD HH:MM` (ex : `2025-07-14 20:00`)');

        const [, y, mo, d, h, mi] = match;
        const scheduledAt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
        if (isNaN(scheduledAt.getTime())) return message.reply('❌ Date invalide.');
        if (scheduledAt <= new Date()) return message.reply('❌ La date doit être dans le futur.');

        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable. Mentionne un salon avec `#` ou écris `ici`.');

        const doc = await ScheduledEmbed.create({
          guildId:     message.guild.id,
          channelId:   target.id,
          title,
          description: desc,
          color:       parseColor(colorRaw),
          scheduledAt,
          createdBy:   message.author.tag,
        });

        const shortId = doc._id.toString().slice(-6);
        const ts      = Math.floor(scheduledAt.getTime() / 1000);

        const confirm = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Embed programmé')
          .addFields(
            { name: '📍 Salon',      value: `<#${target.id}>`,      inline: true },
            { name: '🕐 Publication', value: `<t:${ts}:F> (<t:${ts}:R>)`, inline: true },
            { name: '🆔 ID court',   value: `\`${shortId}\``,       inline: true },
            { name: '📋 Titre',      value: title || '*(aucun)*',    inline: true },
            { name: '📝 Aperçu',     value: desc.slice(0, 200),      inline: false },
          )
          .setFooter({ text: `!embed déprogrammer ${shortId} pour annuler` })
          .setTimestamp();

        await message.reply({ embeds: [confirm] });

        await staffLog(client, {
          action: 'embed programmer',
          details: `**Salon :** <#${target.id}>\n**Date :** <t:${ts}:F>\n**Titre :** ${title || '—'}\n**ID :** \`${shortId}\``,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed programmes ──────────────────────────────────────────────────
      if (sub === 'programmes') {
        const pending = await ScheduledEmbed.find({
          guildId: message.guild.id,
          sent: false,
          scheduledAt: { $gte: new Date() },
        }).sort({ scheduledAt: 1 }).limit(10);

        if (!pending.length) {
          return message.reply('📭 Aucun embed programmé en attente sur ce serveur.');
        }

        const listEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🕐 Embeds programmés en attente')
          .setDescription(pending.map((doc, i) => {
            const ts      = Math.floor(doc.scheduledAt.getTime() / 1000);
            const shortId = doc._id.toString().slice(-6);
            const titre   = doc.title ? `**${doc.title}**` : '*(sans titre)*';
            const richTags = [
              doc.thumbnailUrl ? '🖼️' : '',
              doc.authorName   ? '👤' : '',
              doc.imageUrl     ? '📷' : '',
              doc.footer       ? '📄' : '',
            ].filter(Boolean).join('');
            const richLabel = richTags ? ` \`[riche: ${richTags}]\`` : '';
            return `**${i + 1}.** \`${shortId}\`${richLabel} — ${titre} → <#${doc.channelId}>\n↳ <t:${ts}:F> (<t:${ts}:R>) · par ${doc.createdBy}`;
          }).join('\n\n'))
          .setFooter({ text: `${pending.length} embed(s) · !embed déprogrammer <id> pour annuler` })
          .setTimestamp();

        return message.reply({ embeds: [listEmbed] });
      }

      // ── !embed déprogrammer ────────────────────────────────────────────────
      if (sub === 'déprogrammer' || sub === 'deprogrammer') {
        const shortId = args.trim();
        if (!shortId) return message.reply('**Usage :** `!embed déprogrammer <id>`\nL\'ID est visible dans `!embed programmes` ou dans le message de confirmation.');

        const docs = await ScheduledEmbed.find({
          guildId: message.guild.id,
          sent: false,
        });
        const doc = docs.find(d => d._id.toString().slice(-6) === shortId || d._id.toString() === shortId);

        if (!doc) return message.reply(`❌ Aucun embed programmé trouvé avec l'ID \`${shortId}\`.`);

        const ts    = Math.floor(doc.scheduledAt.getTime() / 1000);
        const titre = doc.title || '*(sans titre)*';

        await ScheduledEmbed.findByIdAndDelete(doc._id);

        await message.reply(
          `✅ Embed \`${shortId}\` annulé.\n> **${titre}** prévu <t:${ts}:R> dans <#${doc.channelId}>`
        );

        await staffLog(client, {
          action: 'embed déprogrammer',
          details: `**ID :** \`${shortId}\`\n**Titre :** ${titre}\n**Salon :** <#${doc.channelId}>\n**Date prévue :** <t:${ts}:F>`,
          author: message.author.tag,
        });
        return;
      }

      // ── !embed riche ───────────────────────────────────────────────────────
      if (sub === 'riche') {
        const isPreview    = args?.startsWith('aperçu');
        const isProgrammer = args?.startsWith('programmer');
        const isModifier   = args?.startsWith('modifier');
        const rest = isPreview
          ? args.replace(/^aperçu\s*\|?\s*/, '').trim()
          : isProgrammer
            ? args.replace(/^programmer\s*\|?\s*/, '').trim()
            : isModifier
              ? args.replace(/^modifier\s*\|?\s*/, '').trim()
              : (args || '');

        const RICHE_USAGE = [
          '**✨ Embed riche — Publication immédiate :**',
          '`!embed riche #salon | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon_url | pied de page`',
          '`!embed riche aperçu | #salon | ...` — prévisualiser avant publication',
          '',
          '**✏️ Embed riche — Modifier un embed existant :**',
          '`!embed riche modifier #salon | ID_message | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon_url | pied de page`',
          '> Utilise `-` pour un champ afin de **conserver** la valeur actuelle de l\'embed.',
          '',
          '**🕐 Embed riche — Planifié :**',
          '`!embed riche programmer #salon | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon_url | pied de page | YYYY-MM-DD HH:MM`',
          '',
          '> **Champs optionnels :** tous sauf #salon (et la date pour la planification).',
          '> Dans la description : `[texte](https://url)` crée un lien cliquable.',
          '',
          '**Exemple :**',
          '```',
          '!embed riche programmer #annonces | 🏆 Tournoi | Inscriptions ouvertes !',
          '  | or | https://img.jpg | https://logo.png | SUPREMYX CI | | Bonne chance à tous',
          '  | 2025-08-01 20:00',
          '```',
        ].join('\n');

        if (!rest) return message.reply(RICHE_USAGE);

        const parts        = rest.split('|').map(p => p.trim());
        const channelArg   = parts[0] || '';
        const title        = parts[1] || '';
        const desc         = parts[2] || '';
        const colorRaw     = parts[3] || 'or';
        const imageUrl     = parts[4] || '';
        const thumbnailUrl = parts[5] || '';
        const authorName   = parts[6] || '';
        const authorIcon   = parts[7] || '';
        const footer       = parts[8] || '';
        const dateRaw      = parts[9] || '';   // uniquement pour la planification

        // ── Mode modification d'un embed riche existant ────────────────────
        if (isModifier) {
          const mParts       = rest.split('|').map(p => p.trim());
          const mChannelArg  = mParts[0] || '';
          const mMsgId       = (mParts[1] || '').replace(/\D/g, '');
          const mTitle       = mParts[2] || '';
          const mDesc        = mParts[3] || '';
          const mColorRaw    = mParts[4] || '';
          const mImageUrl    = mParts[5] || '';
          const mThumbUrl    = mParts[6] || '';
          const mAuthorName  = mParts[7] || '';
          const mAuthorIcon  = mParts[8] || '';
          const mFooter      = mParts[9] || '';

          if (!mChannelArg || !mMsgId) return message.reply([
            '**Usage :** `!embed riche modifier #salon | ID_message | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon | pied de page`',
            '> Utilise `-` pour un champ afin de **conserver** la valeur actuelle de l\'embed.',
            '',
            '**Exemple :**',
            '`!embed riche modifier #annonces | 1234567890 | 🏆 Nouveau titre | - | or | - | https://logo.png | - | - | Bonne chance !`',
          ].join('\n'));

          const mTarget = resolveTarget(message, mChannelArg);
          if (!mTarget) return message.reply('❌ Salon introuvable. Mentionne-le avec `#` ou écris `ici`.');

          let mMsg;
          try { mMsg = await mTarget.messages.fetch(mMsgId); }
          catch { return message.reply('❌ Message introuvable. Vérifie l\'ID et le salon.'); }

          if (mMsg.author.id !== client.user.id)
            return message.reply('❌ Je ne peux modifier que mes propres messages.');
          if (!mMsg.embeds.length)
            return message.reply('❌ Ce message ne contient pas d\'embed.');

          // Lire les valeurs actuelles de l'embed
          const prev = mMsg.embeds[0];
          const keep = v => (!v || v === '-');   // '-' ou vide = conserver

          const newTitle      = keep(mTitle)      ? (prev.title       || '')       : mTitle;
          const newDesc       = keep(mDesc)       ? (prev.description || '')       : mDesc;
          const newColor      = keep(mColorRaw)   ? (prev.color       ?? 0xFFA500) : parseColor(mColorRaw);
          const newImage      = keep(mImageUrl)   ? (prev.image?.url  || null)     : mImageUrl || null;
          const newThumb      = keep(mThumbUrl)   ? (prev.thumbnail?.url || null)  : mThumbUrl || null;
          const newAuthorName = keep(mAuthorName) ? (prev.author?.name || '')      : mAuthorName;
          const newAuthorIcon = keep(mAuthorIcon) ? (prev.author?.iconURL || '')   : mAuthorIcon;
          const newFooter     = keep(mFooter)     ? (prev.footer?.text || '')      : mFooter;

          const updated = new EmbedBuilder()
            .setColor(newColor)
            .setTimestamp();
          if (newTitle)      updated.setTitle(newTitle);
          if (newDesc)       updated.setDescription(newDesc);
          if (newImage)      updated.setImage(newImage);
          if (newThumb)      updated.setThumbnail(newThumb);
          if (newFooter)     updated.setFooter({ text: newFooter });
          if (newAuthorName) updated.setAuthor({ name: newAuthorName, iconURL: newAuthorIcon || undefined });

          await mMsg.edit({ embeds: [updated], components: mMsg.components });
          await message.delete().catch(() => {});
          message.channel.send(`✅ Embed riche modifié dans <#${mTarget.id}>.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

          await staffLog(client, {
            action: 'embed riche modifier',
            details: [
              `**Salon :** <#${mTarget.id}>`,
              `**Message :** \`${mMsgId}\``,
              newTitle      ? `**Titre :** ${newTitle}`           : null,
              newThumb      ? `**Thumbnail :** ${newThumb}`       : null,
              newAuthorName ? `**Auteur :** ${newAuthorName}`     : null,
              newFooter     ? `**Footer :** ${newFooter}`         : null,
            ].filter(Boolean).join('\n'),
            author: message.author.tag,
          });
          return;
        }

        if (!channelArg) return message.reply('❌ Précise le salon cible. Ex : `!embed riche #annonces | ...`');

        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable. Mentionne-le avec `#` ou écris `ici`.');

        // ── Mode planification ──────────────────────────────────────────────
        if (isProgrammer) {
          if (!dateRaw) return message.reply(
            '❌ La date est requise pour planifier.\n' +
            '**Format :** `YYYY-MM-DD HH:MM` (ex : `2025-08-01 20:00`)\n' +
            '→ Ajoute-la comme **10ᵉ champ** séparé par `|`.'
          );

          const match = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
          if (!match) return message.reply('❌ Format de date invalide. Utilise `YYYY-MM-DD HH:MM` (ex : `2025-08-01 20:00`)');

          const [, y, mo, d, h, mi] = match;
          const scheduledAt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
          if (isNaN(scheduledAt.getTime())) return message.reply('❌ Date invalide.');
          if (scheduledAt <= new Date()) return message.reply('❌ La date doit être dans le futur.');

          // Prévisualisation de l'embed avant de sauvegarder
          const previewEmbed = new EmbedBuilder().setColor(parseColor(colorRaw)).setTimestamp();
          if (title)        previewEmbed.setTitle(title);
          if (desc)         previewEmbed.setDescription(desc);
          if (imageUrl)     previewEmbed.setImage(imageUrl);
          if (thumbnailUrl) previewEmbed.setThumbnail(thumbnailUrl);
          if (footer)       previewEmbed.setFooter({ text: footer });
          if (authorName)   previewEmbed.setAuthor({ name: authorName, iconURL: authorIcon || undefined });

          const confirmed = await awaitConfirmation(message, previewEmbed);
          if (!confirmed) return message.reply('❌ Planification annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));

          const doc = await ScheduledEmbed.create({
            guildId:      message.guild.id,
            channelId:    target.id,
            title,
            description:  desc,
            color:        parseColor(colorRaw),
            imageUrl,
            thumbnailUrl,
            authorName,
            authorIconUrl: authorIcon,
            footer,
            scheduledAt,
            createdBy:    message.author.tag,
          });

          const shortId = doc._id.toString().slice(-6);
          const ts      = Math.floor(scheduledAt.getTime() / 1000);

          const confirm = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ Embed riche programmé')
            .addFields(
              { name: '📍 Salon',       value: `<#${target.id}>`,                    inline: true },
              { name: '🕐 Publication', value: `<t:${ts}:F> (<t:${ts}:R>)`,          inline: true },
              { name: '🆔 ID court',    value: `\`${shortId}\``,                     inline: true },
              { name: '📋 Titre',       value: title        || '*(aucun)*',           inline: true },
              { name: '👤 Auteur',      value: authorName   || '*(aucun)*',           inline: true },
              { name: '🖼️ Thumbnail',   value: thumbnailUrl ? '✅ Défini' : '*(aucun)*', inline: true },
              { name: '📝 Aperçu desc', value: desc.slice(0, 200) || '*(vide)*',     inline: false },
            )
            .setFooter({ text: `!embed déprogrammer ${shortId} pour annuler` })
            .setTimestamp();

          await message.reply({ embeds: [confirm] });

          await staffLog(client, {
            action: 'embed riche programmer',
            details: [
              `**Salon :** <#${target.id}>`,
              `**Date :** <t:${ts}:F>`,
              `**Titre :** ${title || '—'}`,
              `**ID :** \`${shortId}\``,
              thumbnailUrl ? `**Thumbnail :** ${thumbnailUrl}` : null,
              authorName   ? `**Auteur :** ${authorName}`      : null,
            ].filter(Boolean).join('\n'),
            author: message.author.tag,
          });
          return;
        }

        // ── Mode publication immédiate ──────────────────────────────────────
        const embed = new EmbedBuilder()
          .setColor(parseColor(colorRaw))
          .setTimestamp();

        if (title)        embed.setTitle(title);
        if (desc)         embed.setDescription(desc);
        if (imageUrl)     embed.setImage(imageUrl);
        if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
        if (footer)       embed.setFooter({ text: footer });
        if (authorName)   embed.setAuthor({ name: authorName, iconURL: authorIcon || undefined });

        if (isPreview) {
          const confirmed = await awaitConfirmation(message, embed);
          if (!confirmed) return message.reply('❌ Publication annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        await target.send({ embeds: [embed] });
        try { await message.delete(); } catch {}
        if (target.id !== message.channel.id) {
          message.channel.send(`✅ Embed riche publié dans <#${target.id}>.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        await staffLog(client, {
          action: 'embed riche',
          details: [
            `**Salon :** <#${target.id}>`,
            `**Titre :** ${title || '—'}`,
            imageUrl     ? `**Image :** ${imageUrl}`          : null,
            thumbnailUrl ? `**Thumbnail :** ${thumbnailUrl}`   : null,
            authorName   ? `**Auteur :** ${authorName}`        : null,
            isPreview    ? '*(prévisualisé)*'                   : null,
          ].filter(Boolean).join('\n'),
          author: message.author.tag,
        });
        return;
      }

      // ── Sous-commande inconnue ─────────────────────────────────────────────
      return message.reply(`❌ Sous-commande \`${sub}\` inconnue.\n\n${HELP_TEXT}`);

    } catch (err) {
      console.error('[embed]', err);
    }
  });
};
