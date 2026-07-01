const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { staffLog } = require('../utils/staffLog');
const { logStaffAction } = require('../utils/staffLog');
const ScheduledEmbed   = require('../database/models/ScheduledEmbed');
const EmbedTemplate    = require('../database/models/EmbedTemplate');

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
  '**📤 Publier un embed simple :**',
  '`!embed envoyer #salon | Titre | Description | couleur`',
  '`!embed envoyer ici | Titre | Description | couleur`',
  '`!embed envoyer aperçu | #salon | Titre | Description | couleur` — prévisualiser avant publication',
  '',
  '**🔘 Embed avec boutons URL :**',
  '`!embed boutons #salon | Titre | Description | Texte >> https://... | couleur`',
  '`!embed boutons aperçu | #salon | Titre | Description | Texte >> https://... | couleur`',
  '',
  '**⚙️ Embed avancé (salon courant, image + footer) :**',
  '`!embed avancé Titre | Description | couleur | image_url | pied de page`',
  '',
  '**✨ Embed complet (toutes les fonctionnalités) :**',
  '`!embed complet #salon | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | Bouton>>URL ; Bouton2>>URL2 | Champ::Valeur::oui ; Champ2::Valeur2`',
  '`!embed complet aperçu | #salon | ...` — prévisualiser avant publication',
  '`!embed complet modifier #salon | ID | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | boutons | champs` — éditer (`-` pour conserver un champ)',
  '`!embed complet programmer #salon | ... | YYYY-MM-DD HH:MM` — planifier',
  'Dans la description : `[texte](https://lien)` crée un lien cliquable.',
  '',
  '**📋 Gérer les embeds existants :**',
  '`!embed liste [#salon]` — lister les embeds du bot dans un salon',
  '`!embed modifier #salon | ID | Nouveau titre | Nouvelle description | couleur`',
  '`!embed supprimer #salon | ID_message`',
  '`!embed cloner #salon | ID_message | #salon_destination` — dupliquer un embed vers un autre salon',
  '',
  '**🕐 Planification simple :**',
  '`!embed programmer #salon | Titre | Description | couleur | YYYY-MM-DD HH:MM`',
  '`!embed programmes` — voir les embeds en attente de publication',
  '`!embed déprogrammer <id>` — annuler un embed planifié',
  '',
  '**📁 Modèles d\'embeds :**',
  '`!embed modèle sauvegarder <nom> | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | boutons | champs`',
  '`!embed modèle charger <nom> | #salon` — publier un modèle',
  '`!embed modèle aperçu <nom>` — prévisualiser un modèle',
  '`!embed modèle liste` — voir tous les modèles sauvegardés',
  '`!embed modèle supprimer <nom>` — supprimer un modèle',
  '`!embed modèle renommer <ancien> | <nouveau>` — renommer un modèle',
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

      // ── !embed complet ─────────────────────────────────────────────────────
      if (sub === 'complet') {
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

        const COMPLET_USAGE = [
          '**✨ Embed complet — toutes les fonctionnalités :**',
          '`!embed complet #salon | Titre | Description | couleur | image_url | thumbnail_url | auteur | auteur_icon_url | pied de page | url_titre | Bouton>>URL ; Bouton2>>URL2 | Champ::Valeur::oui ; Champ2::Valeur2`',
          '',
          '> Tous les champs après `#salon` sont **optionnels** — laisse vide (`||`) pour les ignorer.',
          '',
          '**📋 Détail des champs :**',
          '• `couleur` — nom (`rouge`, `vert`, `bleu`...) ou code `#HEX`',
          '• `image_url` — grande image en bas de l\'embed',
          '• `thumbnail_url` — petite image en haut à droite',
          '• `auteur` / `auteur_icon_url` — nom et icône au-dessus du titre',
          '• `pied de page` — texte en bas de l\'embed',
          '• `url_titre` — rend le titre cliquable (lien hypertexte)',
          '• `boutons` — jusqu\'à 5 boutons URL séparés par `;` : `Texte>>https://... ; Texte2>>https://...`',
          '• `champs` — jusqu\'à 25 champs séparés par `;` : `Nom::Valeur::oui` (oui/non = inline)',
          '',
          '**👁️ Prévisualisation :**',
          '`!embed complet aperçu | #salon | ...`',
          '',
          '**✏️ Modifier un embed existant :**',
          '`!embed complet modifier #salon | ID_message | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | boutons | champs`',
          '> Utilise `-` pour **conserver** la valeur actuelle d\'un champ.',
          '',
          '**🕐 Planifier :**',
          '`!embed complet programmer #salon | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | boutons | champs | YYYY-MM-DD HH:MM`',
          '',
          '**Exemple :**',
          '```',
          '!embed complet #annonces | 🏆 Tournoi | Inscriptions ouvertes ! | or | https://img.jpg | https://logo.png | SUPREMYX | | Bonne chance ! | https://supremyx.gg | Rejoindre>>https://... ; Règles>>https://... | 📅 Date::15 Août::oui ; 🎮 Format::5v5::oui',
          '```',
        ].join('\n');

        if (!rest) return message.reply(COMPLET_USAGE);

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
        const urlTitre     = parts[9] || '';
        const boutonsRaw   = parts[10] || '';
        const champsRaw    = parts[11] || '';
        const dateRaw      = parts[12] || '';   // uniquement pour la planification

        // Helper : boutons séparés par `;`
        const parseButtonsComp = (raw) => raw.split(';').map(s => s.trim()).filter(Boolean).map(part => {
          const sep = part.indexOf('>>');
          if (sep === -1) return null;
          const label = part.slice(0, sep).trim();
          const url   = part.slice(sep + 2).trim();
          if (!label || !url.startsWith('http')) return null;
          return { label, url };
        }).filter(Boolean).slice(0, 5);

        // Helper : champs séparés par `;`, colonnes par `::`
        const parseFieldsComp = (raw) => raw.split(';').map(s => s.trim()).filter(Boolean).map(part => {
          const cols   = part.split('::').map(c => c.trim());
          const name   = cols[0] || '';
          const value  = cols[1] || '\u200B';
          const inline = (cols[2] || '').toLowerCase() === 'oui';
          if (!name) return null;
          return { name, value, inline };
        }).filter(Boolean).slice(0, 25);

        // Helper : construire l'embed complet
        function buildCompletEmbed(t, d, cRaw, imgUrl, thumbUrl, aName, aIcon, ft, urlT) {
          const emb = new EmbedBuilder().setColor(parseColor(cRaw)).setTimestamp();
          if (t)       emb.setTitle(t);
          if (d)       emb.setDescription(d);
          if (imgUrl)  emb.setImage(imgUrl);
          if (thumbUrl) emb.setThumbnail(thumbUrl);
          if (ft)      emb.setFooter({ text: ft });
          if (aName)   emb.setAuthor({ name: aName, iconURL: aIcon || undefined });
          if (urlT)    emb.setURL(urlT);
          return emb;
        }

        // ── Mode modification d'un embed complet existant ──────────────────
        if (isModifier) {
          const mParts      = rest.split('|').map(p => p.trim());
          const mChannelArg = mParts[0] || '';
          const mMsgId      = (mParts[1] || '').replace(/\D/g, '');
          const mTitle      = mParts[2] || '';
          const mDesc       = mParts[3] || '';
          const mColorRaw   = mParts[4] || '';
          const mImageUrl   = mParts[5] || '';
          const mThumbUrl   = mParts[6] || '';
          const mAuthorName = mParts[7] || '';
          const mAuthorIcon = mParts[8] || '';
          const mFooter     = mParts[9] || '';
          const mUrlTitre   = mParts[10] || '';
          const mBoutonsRaw = mParts[11] || '';
          const mChampsRaw  = mParts[12] || '';

          if (!mChannelArg || !mMsgId) return message.reply([
            '**Usage :** `!embed complet modifier #salon | ID_message | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | boutons | champs`',
            '> Utilise `-` pour **conserver** la valeur actuelle d\'un champ.',
            '',
            '**Exemple :**',
            '`!embed complet modifier #annonces | 1234567890 | 🏆 Nouveau titre | - | or | - | https://logo.png | - | - | Bonne chance ! | https://supremyx.gg | Règles>>https://... | Date::15 Août::oui`',
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

          const prev = mMsg.embeds[0];
          const keep = v => (!v || v === '-');

          const newTitle      = keep(mTitle)      ? (prev.title           || '') : mTitle;
          const newDesc       = keep(mDesc)       ? (prev.description     || '') : mDesc;
          const newColor      = keep(mColorRaw)   ? (prev.color ?? 0xFFA500)     : parseColor(mColorRaw);
          const newImage      = keep(mImageUrl)   ? (prev.image?.url      || null) : mImageUrl || null;
          const newThumb      = keep(mThumbUrl)   ? (prev.thumbnail?.url  || null) : mThumbUrl || null;
          const newAuthorName = keep(mAuthorName) ? (prev.author?.name    || '') : mAuthorName;
          const newAuthorIcon = keep(mAuthorIcon) ? (prev.author?.iconURL || '') : mAuthorIcon;
          const newFooter     = keep(mFooter)     ? (prev.footer?.text    || '') : mFooter;
          const newUrlTitre   = keep(mUrlTitre)   ? (prev.url             || '') : mUrlTitre;

          const updated = new EmbedBuilder().setColor(newColor).setTimestamp();
          if (newTitle)      updated.setTitle(newTitle);
          if (newDesc)       updated.setDescription(newDesc);
          if (newImage)      updated.setImage(newImage);
          if (newThumb)      updated.setThumbnail(newThumb);
          if (newFooter)     updated.setFooter({ text: newFooter });
          if (newAuthorName) updated.setAuthor({ name: newAuthorName, iconURL: newAuthorIcon || undefined });
          if (newUrlTitre)   updated.setURL(newUrlTitre);

          // Champs
          if (!keep(mChampsRaw)) {
            const fields = parseFieldsComp(mChampsRaw);
            if (fields.length) updated.addFields(fields);
          } else if (prev.fields?.length) {
            updated.addFields(prev.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })));
          }

          // Boutons
          let newComponents = mMsg.components;
          if (!keep(mBoutonsRaw)) {
            const buttons = parseButtonsComp(mBoutonsRaw);
            newComponents = buttons.length ? [new ActionRowBuilder().addComponents(
              buttons.map(b => new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link))
            )] : [];
          }

          await mMsg.edit({ embeds: [updated], components: newComponents });
          await message.delete().catch(() => {});
          message.channel.send(`✅ Embed complet modifié dans <#${mTarget.id}>.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

          await staffLog(client, {
            action: 'embed complet modifier',
            details: [
              `**Salon :** <#${mTarget.id}>`,
              `**Message :** \`${mMsgId}\``,
              newTitle      ? `**Titre :** ${newTitle}`        : null,
              newThumb      ? `**Thumbnail :** ${newThumb}`    : null,
              newAuthorName ? `**Auteur :** ${newAuthorName}`  : null,
              newFooter     ? `**Footer :** ${newFooter}`      : null,
              newUrlTitre   ? `**URL titre :** ${newUrlTitre}` : null,
            ].filter(Boolean).join('\n'),
            author: message.author.tag,
          });
          return;
        }

        if (!channelArg) return message.reply('❌ Précise le salon cible. Ex : `!embed complet #annonces | ...`');

        const target = resolveTarget(message, channelArg);
        if (!target) return message.reply('❌ Salon introuvable. Mentionne-le avec `#` ou écris `ici`.');

        const buttons = parseButtonsComp(boutonsRaw);
        const fields  = parseFieldsComp(champsRaw);

        // ── Mode planification ──────────────────────────────────────────────
        if (isProgrammer) {
          if (!dateRaw) return message.reply(
            '❌ La date est requise pour planifier.\n' +
            '**Format :** `YYYY-MM-DD HH:MM` (ex : `2025-08-01 20:00`)\n' +
            '→ Ajoute-la comme **13ᵉ champ** séparé par `|` (après les champs).'
          );

          const match = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
          if (!match) return message.reply('❌ Format de date invalide. Utilise `YYYY-MM-DD HH:MM`');

          const [, y, mo, d, h, mi] = match;
          const scheduledAt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
          if (isNaN(scheduledAt.getTime())) return message.reply('❌ Date invalide.');
          if (scheduledAt <= new Date()) return message.reply('❌ La date doit être dans le futur.');

          const previewEmbed = buildCompletEmbed(title, desc, colorRaw, imageUrl, thumbnailUrl, authorName, authorIcon, footer, urlTitre);
          if (fields.length) previewEmbed.addFields(fields);
          const previewComponents = buttons.length ? [new ActionRowBuilder().addComponents(
            buttons.map(b => new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link))
          )] : null;

          const confirmed = await awaitConfirmation(message, previewEmbed, previewComponents);
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
            .setTitle('✅ Embed complet programmé')
            .addFields(
              { name: '📍 Salon',       value: `<#${target.id}>`,                           inline: true },
              { name: '🕐 Publication', value: `<t:${ts}:F> (<t:${ts}:R>)`,                 inline: true },
              { name: '🆔 ID court',    value: `\`${shortId}\``,                            inline: true },
              { name: '📋 Titre',       value: title        || '*(aucun)*',                  inline: true },
              { name: '👤 Auteur',      value: authorName   || '*(aucun)*',                  inline: true },
              { name: '🖼️ Thumbnail',   value: thumbnailUrl ? '✅ Défini' : '*(aucun)*',     inline: true },
              { name: '🔗 URL titre',   value: urlTitre     ? '✅ Défini' : '*(aucun)*',     inline: true },
              { name: '🔘 Boutons',     value: buttons.length ? `${buttons.length} bouton(s)` : '*(aucun)*', inline: true },
              { name: '📊 Champs',      value: fields.length  ? `${fields.length} champ(s)`   : '*(aucun)*', inline: true },
              { name: '📝 Aperçu desc', value: desc.slice(0, 200) || '*(vide)*',             inline: false },
            )
            .setFooter({ text: `!embed déprogrammer ${shortId} pour annuler` })
            .setTimestamp();

          await message.reply({ embeds: [confirm] });

          await staffLog(client, {
            action: 'embed complet programmer',
            details: [
              `**Salon :** <#${target.id}>`,
              `**Date :** <t:${ts}:F>`,
              `**Titre :** ${title || '—'}`,
              `**ID :** \`${shortId}\``,
              thumbnailUrl   ? `**Thumbnail :** ${thumbnailUrl}`        : null,
              authorName     ? `**Auteur :** ${authorName}`             : null,
              urlTitre       ? `**URL titre :** ${urlTitre}`            : null,
              buttons.length ? `**Boutons :** ${buttons.length}`        : null,
              fields.length  ? `**Champs :** ${fields.length}`          : null,
            ].filter(Boolean).join('\n'),
            author: message.author.tag,
          });
          return;
        }

        // ── Mode publication immédiate ──────────────────────────────────────
        const embed = buildCompletEmbed(title, desc, colorRaw, imageUrl, thumbnailUrl, authorName, authorIcon, footer, urlTitre);
        if (fields.length) embed.addFields(fields);

        const components = buttons.length ? [new ActionRowBuilder().addComponents(
          buttons.map(b => new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link))
        )] : [];

        if (isPreview) {
          const confirmed = await awaitConfirmation(message, embed, components.length ? components : null);
          if (!confirmed) return message.reply('❌ Publication annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
        }

        await target.send({ embeds: [embed], components });
        try { await message.delete(); } catch {}
        if (target.id !== message.channel.id) {
          message.channel.send(`✅ Embed complet publié dans <#${target.id}>.`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
        }

        await staffLog(client, {
          action: 'embed complet',
          details: [
            `**Salon :** <#${target.id}>`,
            `**Titre :** ${title || '—'}`,
            imageUrl       ? `**Image :** ${imageUrl}`         : null,
            thumbnailUrl   ? `**Thumbnail :** ${thumbnailUrl}` : null,
            authorName     ? `**Auteur :** ${authorName}`      : null,
            urlTitre       ? `**URL titre :** ${urlTitre}`     : null,
            buttons.length ? `**Boutons :** ${buttons.length}` : null,
            fields.length  ? `**Champs :** ${fields.length}`   : null,
            isPreview      ? '*(prévisualisé)*'                 : null,
          ].filter(Boolean).join('\n'),
          author: message.author.tag,
        });
        return;
      }

      // ── !embed modèle ──────────────────────────────────────────────────────
      if (sub === 'modèle' || sub === 'modele') {
        const spIdx   = args.indexOf(' ');
        const action  = (spIdx === -1 ? args : args.slice(0, spIdx)).toLowerCase().trim();
        const rest    = spIdx === -1 ? '' : args.slice(spIdx + 1).trim();

        const MODELE_USAGE = [
          '**📁 Modèles d\'embeds — Commandes :**',
          '',
          '`!embed modèle sauvegarder <nom> | Titre | Desc | couleur | image | thumbnail | auteur | auteur_icon | footer | url_titre | Bouton>>URL ; B2>>URL2 | Champ::Valeur::oui ; Champ2::Valeur2`',
          '`!embed modèle charger <nom> | #salon` — publier un modèle dans un salon',
          '`!embed modèle aperçu <nom>` — prévisualiser un modèle',
          '`!embed modèle liste` — voir tous les modèles sauvegardés',
          '`!embed modèle supprimer <nom>` — supprimer un modèle',
          '`!embed modèle renommer <ancien> | <nouveau>` — renommer un modèle',
          '',
          '> Le `<nom>` ne peut pas contenir `|`. Utilise un nom court sans espaces si possible.',
        ].join('\n');

        if (!action) return message.reply(MODELE_USAGE);

        // Helper : reconstruit boutons/champs depuis le doc BDD
        function docButtons(doc) {
          if (!doc.buttons?.length) return [];
          return [new ActionRowBuilder().addComponents(
            doc.buttons.map(b => new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link))
          )];
        }
        function buildFromDoc(doc) {
          const emb = new EmbedBuilder().setColor(doc.color || 0x5865F2).setTimestamp();
          if (doc.title)        emb.setTitle(doc.title);
          if (doc.description)  emb.setDescription(doc.description);
          if (doc.imageUrl)     emb.setImage(doc.imageUrl);
          if (doc.thumbnailUrl) emb.setThumbnail(doc.thumbnailUrl);
          if (doc.footer)       emb.setFooter({ text: doc.footer });
          if (doc.authorName)   emb.setAuthor({ name: doc.authorName, iconURL: doc.authorIconUrl || undefined });
          if (doc.urlTitre)     emb.setURL(doc.urlTitre);
          if (doc.fields?.length) emb.addFields(doc.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })));
          return emb;
        }

        // ── sauvegarder ──────────────────────────────────────────────────────
        if (action === 'sauvegarder') {
          const pipeIdx = rest.indexOf('|');
          const tplName = (pipeIdx === -1 ? rest : rest.slice(0, pipeIdx)).trim();
          const fieldsRaw = pipeIdx === -1 ? '' : rest.slice(pipeIdx + 1);

          if (!tplName) return message.reply('❌ Indique un nom pour le modèle.\n**Usage :** `!embed modèle sauvegarder <nom> | Titre | ...`');

          const parts = fieldsRaw.split('|').map(p => p.trim());
          const tTitle       = parts[0] || '';
          const tDesc        = parts[1] || '';
          const tColorRaw    = parts[2] || 'bleu';
          const tImageUrl    = parts[3] || '';
          const tThumbUrl    = parts[4] || '';
          const tAuthorName  = parts[5] || '';
          const tAuthorIcon  = parts[6] || '';
          const tFooter      = parts[7] || '';
          const tUrlTitre    = parts[8] || '';
          const tBoutonsRaw  = parts[9] || '';
          const tChampsRaw   = parts[10] || '';

          const parseButtonsT = (raw) => raw.split(';').map(s => s.trim()).filter(Boolean).map(p => {
            const sep = p.indexOf('>>');
            if (sep === -1) return null;
            const label = p.slice(0, sep).trim();
            const url   = p.slice(sep + 2).trim();
            return (label && url.startsWith('http')) ? { label, url } : null;
          }).filter(Boolean).slice(0, 5);

          const parseFieldsT = (raw) => raw.split(';').map(s => s.trim()).filter(Boolean).map(p => {
            const cols = p.split('::').map(c => c.trim());
            return cols[0] ? { name: cols[0], value: cols[1] || '\u200B', inline: (cols[2] || '').toLowerCase() === 'oui' } : null;
          }).filter(Boolean).slice(0, 25);

          const tButtons = parseButtonsT(tBoutonsRaw);
          const tFields  = parseFieldsT(tChampsRaw);

          const existing = await EmbedTemplate.findOne({ guildId: message.guild.id, name: { $regex: new RegExp(`^${tplName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });

          const data = {
            guildId:      message.guild.id,
            name:         tplName,
            title:        tTitle,
            description:  tDesc,
            color:        parseColor(tColorRaw),
            imageUrl:     tImageUrl,
            thumbnailUrl: tThumbUrl,
            authorName:   tAuthorName,
            authorIconUrl: tAuthorIcon,
            footer:       tFooter,
            urlTitre:     tUrlTitre,
            buttons:      tButtons,
            fields:       tFields,
            updatedBy:    message.author.tag,
          };
          if (!existing) data.createdBy = message.author.tag;

          const doc = existing
            ? await EmbedTemplate.findByIdAndUpdate(existing._id, data, { new: true })
            : await EmbedTemplate.create(data);

          const confirm = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle(existing ? `✅ Modèle \`${tplName}\` mis à jour` : `✅ Modèle \`${tplName}\` sauvegardé`)
            .addFields(
              { name: '📋 Titre',     value: tTitle     || '*(aucun)*',                           inline: true },
              { name: '🎨 Couleur',   value: tColorRaw  || 'bleu',                                inline: true },
              { name: '👤 Auteur',    value: tAuthorName || '*(aucun)*',                           inline: true },
              { name: '🖼️ Thumbnail', value: tThumbUrl  ? '✅' : '*(aucun)*',                     inline: true },
              { name: '🔗 URL titre', value: tUrlTitre  ? '✅' : '*(aucun)*',                     inline: true },
              { name: '🔘 Boutons',   value: tButtons.length ? `${tButtons.length} bouton(s)` : '*(aucun)*', inline: true },
              { name: '📊 Champs',    value: tFields.length  ? `${tFields.length} champ(s)`   : '*(aucun)*', inline: true },
              { name: '📝 Aperçu desc', value: tDesc.slice(0, 200) || '*(vide)*', inline: false },
            )
            .setFooter({ text: `!embed modèle charger ${tplName} | #salon — pour publier ce modèle` })
            .setTimestamp();

          await message.reply({ embeds: [confirm] });
          await staffLog(client, {
            action: 'embed modèle sauvegarder',
            details: `**Nom :** \`${tplName}\`\n**Titre :** ${tTitle || '—'}\n**Boutons :** ${tButtons.length} · **Champs :** ${tFields.length}${existing ? '\n*(mise à jour)*' : ''}`,
            author: message.author.tag,
          });
          return;
        }

        // ── liste ────────────────────────────────────────────────────────────
        if (action === 'liste') {
          const docs = await EmbedTemplate.find({ guildId: message.guild.id }).sort({ name: 1 }).limit(25);
          if (!docs.length) return message.reply('📭 Aucun modèle sauvegardé sur ce serveur.\n💡 Utilise `!embed modèle sauvegarder <nom> | ...` pour en créer un.');

          const lines = docs.map((d, i) => {
            const tags = [
              d.thumbnailUrl ? '🖼️' : '',
              d.authorName   ? '👤' : '',
              d.imageUrl     ? '📷' : '',
              d.buttons?.length ? `🔘×${d.buttons.length}` : '',
              d.fields?.length  ? `📊×${d.fields.length}`  : '',
              d.urlTitre        ? '🔗' : '',
            ].filter(Boolean).join(' ');
            const titre = d.title ? `**${d.title}**` : '*(sans titre)*';
            return `**${i + 1}.** \`${d.name}\` — ${titre}${tags ? `  ${tags}` : ''}\n↳ par ${d.createdBy} · ${d.description ? d.description.slice(0, 60).replace(/\n/g, ' ') + (d.description.length > 60 ? '…' : '') : '*(vide)*'}`;
          });

          const listEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📁 Modèles d'embeds — ${docs.length} modèle(s)`)
            .setDescription(lines.join('\n\n'))
            .setFooter({ text: '!embed modèle charger <nom> | #salon — pour publier · !embed modèle aperçu <nom> — pour prévisualiser' })
            .setTimestamp();

          return message.reply({ embeds: [listEmbed] });
        }

        // ── aperçu ───────────────────────────────────────────────────────────
        if (action === 'aperçu' || action === 'apercu') {
          const tplName = rest.trim();
          if (!tplName) return message.reply('**Usage :** `!embed modèle aperçu <nom>`');

          const doc = await EmbedTemplate.findOne({ guildId: message.guild.id, name: { $regex: new RegExp(`^${tplName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (!doc) return message.reply(`❌ Modèle \`${tplName}\` introuvable. Utilise \`!embed modèle liste\` pour voir les modèles disponibles.`);

          const previewEmbed = buildFromDoc(doc);
          const components   = docButtons(doc);

          const info = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📋 Modèle : \`${doc.name}\``)
            .addFields(
              { name: '🎨 Couleur',   value: `\`#${(doc.color || 0x5865F2).toString(16).padStart(6, '0').toUpperCase()}\``, inline: true },
              { name: '👤 Auteur',    value: doc.authorName    || '*(aucun)*',       inline: true },
              { name: '🖼️ Thumbnail', value: doc.thumbnailUrl ? '✅' : '*(aucun)*',  inline: true },
              { name: '🔗 URL titre', value: doc.urlTitre     ? '✅' : '*(aucun)*',  inline: true },
              { name: '🔘 Boutons',   value: doc.buttons?.length ? `${doc.buttons.length} bouton(s)` : '*(aucun)*', inline: true },
              { name: '📊 Champs',    value: doc.fields?.length  ? `${doc.fields.length} champ(s)`  : '*(aucun)*', inline: true },
              { name: '💾 Créé par',  value: doc.createdBy || '—', inline: true },
              { name: '✏️ Modifié par', value: doc.updatedBy || '—', inline: true },
            )
            .setFooter({ text: `!embed modèle charger ${doc.name} | #salon — pour publier ce modèle` })
            .setTimestamp();

          await message.reply({ embeds: [info] });
          await message.channel.send({ embeds: [previewEmbed], components });
          return;
        }

        // ── charger ──────────────────────────────────────────────────────────
        if (action === 'charger') {
          const pipeIdx  = rest.indexOf('|');
          const tplName  = (pipeIdx === -1 ? rest : rest.slice(0, pipeIdx)).trim();
          const chanArg  = pipeIdx === -1 ? '' : rest.slice(pipeIdx + 1).trim();

          if (!tplName) return message.reply('**Usage :** `!embed modèle charger <nom> | #salon`');
          if (!chanArg) return message.reply('❌ Indique le salon de destination.\n**Usage :** `!embed modèle charger <nom> | #salon`');

          const doc = await EmbedTemplate.findOne({ guildId: message.guild.id, name: { $regex: new RegExp(`^${tplName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (!doc) return message.reply(`❌ Modèle \`${tplName}\` introuvable. Utilise \`!embed modèle liste\` pour voir les modèles disponibles.`);

          const target = resolveTarget(message, chanArg);
          if (!target) return message.reply('❌ Salon introuvable. Mentionne-le avec `#` ou écris `ici`.');

          const sendEmbed    = buildFromDoc(doc);
          const components   = docButtons(doc);

          const confirmed = await awaitConfirmation(message, sendEmbed, components.length ? components : null);
          if (!confirmed) return message.reply('❌ Publication annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));

          await target.send({ embeds: [sendEmbed], components });
          await message.delete().catch(() => {});
          if (target.id !== message.channel.id)
            message.channel.send(`✅ Modèle \`${doc.name}\` publié dans <#${target.id}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

          await staffLog(client, {
            action: 'embed modèle charger',
            details: `**Modèle :** \`${doc.name}\`\n**Salon :** <#${target.id}>\n**Titre :** ${doc.title || '—'}`,
            author: message.author.tag,
          });
          return;
        }

        // ── supprimer ────────────────────────────────────────────────────────
        if (action === 'supprimer') {
          const tplName = rest.trim();
          if (!tplName) return message.reply('**Usage :** `!embed modèle supprimer <nom>`');

          const doc = await EmbedTemplate.findOne({ guildId: message.guild.id, name: { $regex: new RegExp(`^${tplName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (!doc) return message.reply(`❌ Modèle \`${tplName}\` introuvable.`);

          const confirmEmbed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🗑️ Confirmer la suppression du modèle')
            .addFields(
              { name: '📁 Nom',    value: `\`${doc.name}\``,       inline: true },
              { name: '📋 Titre', value: doc.title || '*(aucun)*', inline: true },
            )
            .setFooter({ text: 'Réagis ✅ pour supprimer, ❌ pour annuler (30s)' });

          const confirmed = await awaitConfirmation(message, confirmEmbed);
          if (!confirmed) return message.channel.send('❌ Suppression annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));

          await EmbedTemplate.findByIdAndDelete(doc._id);
          await message.reply(`✅ Modèle \`${doc.name}\` supprimé.`);

          await staffLog(client, {
            action: 'embed modèle supprimer',
            details: `**Nom :** \`${doc.name}\`\n**Titre :** ${doc.title || '—'}`,
            author: message.author.tag,
          });
          return;
        }

        // ── renommer ─────────────────────────────────────────────────────────
        if (action === 'renommer') {
          const parts   = rest.split('|').map(p => p.trim());
          const oldName = parts[0] || '';
          const newName = parts[1] || '';

          if (!oldName || !newName) return message.reply('**Usage :** `!embed modèle renommer <ancien_nom> | <nouveau_nom>`');

          const doc = await EmbedTemplate.findOne({ guildId: message.guild.id, name: { $regex: new RegExp(`^${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (!doc) return message.reply(`❌ Modèle \`${oldName}\` introuvable.`);

          const conflict = await EmbedTemplate.findOne({ guildId: message.guild.id, name: { $regex: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
          if (conflict) return message.reply(`❌ Un modèle nommé \`${newName}\` existe déjà.`);

          await EmbedTemplate.findByIdAndUpdate(doc._id, { name: newName, updatedBy: message.author.tag });
          await message.reply(`✅ Modèle renommé : \`${oldName}\` → \`${newName}\``);

          await staffLog(client, {
            action: 'embed modèle renommer',
            details: `\`${oldName}\` → \`${newName}\``,
            author: message.author.tag,
          });
          return;
        }

        return message.reply(`❌ Action \`${action}\` inconnue.\n\n${MODELE_USAGE}`);
      }

      // ── Sous-commande inconnue ─────────────────────────────────────────────
      return message.reply(`❌ Sous-commande \`${sub}\` inconnue.\n\n${HELP_TEXT}`);

    } catch (err) {
      console.error('[embed]', err);
    }
  });
};
