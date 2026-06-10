const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { staffLog } = require('../utils/staffLog');

const COLOR_MAP = {
  rouge: 0xED4245, vert: 0x57F287, bleu: 0x5865F2, jaune: 0xFEE75C,
  orange: 0xE67E22, violet: 0x9B59B6, blanc: 0xFFFFFF, noir: 0x2C2F33,
  or: 0xF1C40F, cyan: 0x1ABC9C, rose: 0xEB459E, gris: 0x808080,
};

function parseColor(raw = '') {
  const key = raw.trim().toLowerCase();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
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
  return message.mentions.channels.first() || message.guild.channels.cache.get(channelArg) || null;
}

// Affiche un embed en prévisualisation avec ✅ / ❌, attend la réaction du staff
async function awaitConfirmation(message, previewEmbed, components = null) {
  const payload = { embeds: [previewEmbed] };
  if (components) payload.components = components;

  const preview = await message.channel.send(payload);
  await preview.react('✅').catch(() => {});
  await preview.react('❌').catch(() => {});

  const notice = await message.channel.send(
    `📋 **Prévisualisation** — Réagis ✅ pour publier ou ❌ pour annuler *(60s)*`
  );

  let confirmed = false;
  try {
    const collected = await preview.awaitReactions({
      filter: (r, u) => ['✅', '❌'].includes(r.emoji.name) && u.id === message.author.id,
      max: 1,
      time: 60_000,
      errors: ['time'],
    });
    confirmed = collected.first()?.emoji?.name === '✅';
  } catch {
    confirmed = false;
  }

  await preview.delete().catch(() => {});
  await notice.delete().catch(() => {});
  return confirmed;
}

// ── !lienedit ─────────────────────────────────────────────────────────────
async function editLienMessage(message, parts) {
  // parts: [#salon, messageID, titre, description, couleur?]
  const channelArg = parts[0];
  const msgId      = parts[1]?.replace(/\D/g, '');
  const title      = parts[2] || '';
  const desc       = parts[3] || '';
  const colorRaw   = parts[4] || 'bleu';

  if (!msgId)  return message.reply('❌ ID de message invalide.');
  if (!desc)   return message.reply('❌ La nouvelle description est requise.');

  const target = channelArg.toLowerCase() === 'ici'
    ? message.channel
    : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg) || null);

  if (!target) return message.reply('❌ Salon introuvable.');

  let targetMsg;
  try {
    targetMsg = await target.messages.fetch(msgId);
  } catch {
    return message.reply('❌ Message introuvable. Vérifie l\'ID et le salon.');
  }

  if (targetMsg.author.id !== message.client.user.id)
    return message.reply('❌ Je ne peux modifier que mes propres messages.');

  if (!targetMsg.embeds.length)
    return message.reply('❌ Ce message ne contient pas d\'embed à modifier.');

  const original = targetMsg.embeds[0];

  const updated = new EmbedBuilder()
    .setColor(parseColor(colorRaw))
    .setDescription(desc)
    .setFooter({ text: `Modifié par ${message.author.tag}` })
    .setTimestamp();
  if (title) updated.setTitle(title);

  // Conserver les composants (boutons) du message original
  await targetMsg.edit({
    embeds: [updated],
    components: targetMsg.components,
  });

  await message.delete().catch(() => {});
  message.channel.send(`✅ Embed modifié dans <#${target.id}>.`)
    .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

  return { target, title, desc };
}

module.exports = (client) => {

  // ── !lien ─────────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!lien') || content.startsWith('!lienbutton')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!lien'.length).trim();

    if (!rest) {
      return message.reply([
        '**Commandes `!lien` :**',
        '',
        '**Publier directement :**',
        '`!lien #salon | Titre | Texte avec [lien](https://url.com) | couleur`',
        '`!lien ici | Titre | Texte avec [lien](https://url.com) | couleur`',
        '',
        '**Prévisualiser avant de publier :**',
        '`!lien preview | #salon | Titre | Texte avec [lien](https://url.com) | couleur`',
        '',
        '**Avec boutons cliquables :**',
        '`!lienbutton #salon | Titre | Description | Texte >> https://... | couleur`',
        '`!lienbutton preview | #salon | Titre | Description | Texte >> https://... | couleur`',
        '',
        '**Couleurs :** `rouge` `vert` `bleu` `jaune` `orange` `violet` `rose` `or` `cyan` `gris` ou `#HEX`',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());
    const isPreview = parts[0].toLowerCase() === 'preview';
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
      message.channel.send(`✅ Message publié dans <#${target.id}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

    await staffLog(client, {
      action: 'lien',
      details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Contenu :** ${desc.slice(0, 200)}${isPreview ? '\n*(prévisualisé avant publication)*' : ''}`,
      author: message.author.tag
    });
  });

  // ── !lienbutton ───────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!lienbutton')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!lienbutton'.length).trim();

    if (!rest) {
      return message.reply([
        '**Usage `!lienbutton` :**',
        '`!lienbutton #salon | Titre | Description | Texte >> https://... | couleur`',
        '`!lienbutton preview | #salon | Titre | Description | Texte >> https://... | couleur`',
        '',
        '**Exemple :**',
        '`!lienbutton #annonces | 📋 Inscription | Clique pour t\'inscrire. | S\'inscrire >> https://supremyx.xyz | or`',
        '',
        'Maximum **5 boutons**. URLs commençant par `https://`.',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());
    const isPreview  = parts[0].toLowerCase() === 'preview';
    const channelArg = isPreview ? parts[1] : parts[0];
    const title      = isPreview ? (parts[2] || '') : (parts[1] || '');
    const desc       = isPreview ? (parts[3] || '') : (parts[2] || '');

    // Boutons = tout ce qui contient >>; couleur = mot-clé couleur sans >>
    const extras = isPreview ? parts.slice(4) : parts.slice(3);
    const colorRaw = extras.find(p => {
      const k = p.trim().toLowerCase();
      return (COLOR_MAP[k] !== undefined || k.startsWith('#')) && !p.includes('>>');
    }) || 'bleu';
    const buttonsRaw = extras.filter(p => p.includes('>>')).join('|');
    const buttons    = parseButtons(buttonsRaw);

    if (!desc)         return message.reply('❌ La description est requise.');
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
      buttons.map(b =>
        new ButtonBuilder().setLabel(b.label).setURL(b.url).setStyle(ButtonStyle.Link)
      )
    );

    if (isPreview) {
      const confirmed = await awaitConfirmation(message, embed, [row]);
      if (!confirmed) return message.reply('❌ Publication annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
    }

    await target.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});

    if (target.id !== message.channel.id)
      message.channel.send(`✅ Message avec boutons publié dans <#${target.id}>.`).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

    await staffLog(client, {
      action: 'lienbutton',
      details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Boutons :** ${buttons.map(b => `[${b.label}](${b.url})`).join(', ')}${isPreview ? '\n*(prévisualisé avant publication)*' : ''}`,
      author: message.author.tag
    });
  });

  // ── !lienedit ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!lienedit')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!lienedit'.length).trim();

    if (!rest) {
      return message.reply([
        '**Usage `!lienedit` :**',
        '`!lienedit #salon | ID_message | Nouveau titre | Nouvelle description | couleur`',
        '`!lienedit ici | ID_message | Nouveau titre | Nouvelle description | couleur`',
        '',
        '**Comment obtenir l\'ID du message :**',
        'Active le mode développeur Discord *(Paramètres → Apparence → Mode développeur)*',
        'puis fais clic droit sur le message → **Copier l\'identifiant**.',
        '',
        '**Exemple :**',
        '`!lienedit #annonces | 1234567890123456789 | 🏆 Tournoi MAJ | Inscriptions closes. | rouge`',
        '',
        '⚠️ Je ne peux modifier que mes propres messages.',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());
    const result = await editLienMessage(message, parts);

    if (result?.target) {
      await staffLog(client, {
        action: 'lienedit',
        details: `**Salon :** <#${result.target.id}>\n**Titre :** ${result.title || '—'}\n**Nouveau contenu :** ${result.desc.slice(0, 200)}`,
        author: message.author.tag
      });
    }
  });
};
