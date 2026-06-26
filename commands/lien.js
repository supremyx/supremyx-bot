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

// ── !embededit ─────────────────────────────────────────────────────────────
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

  // ── !embed ─────────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (content !== '!embed' && !content.startsWith('!embed ')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!embed'.length).trim();

    if (!rest) {
      return message.reply([
        '**Commandes `!embed` :**',
        '',
        '**Publier directement :**',
        '`!embed #salon | Titre | Texte avec [lien](https://url.com) | couleur`',
        '`!embed ici | Titre | Texte avec [lien](https://url.com) | couleur`',
        '',
        '**Prévisualiser avant de publier :**',
        '`!embed aperçu | #salon | Titre | Texte avec [lien](https://url.com) | couleur`',
        '',
        '**Avec boutons cliquables :**',
        '`!embedbutton #salon | Titre | Description | Texte >> https://... | couleur`',
        '`!embedbutton aperçu | #salon | Titre | Description | Texte >> https://... | couleur`',
        '',
        '**Couleurs :** `rouge` `vert` `bleu` `jaune` `orange` `violet` `rose` `or` `cyan` `gris` ou `#HEX`',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());
    const isPreview = parts[0].toLowerCase() === 'aperçu';
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

  // ── !embedbutton ───────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!embedbutton')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!embedbutton'.length).trim();

    if (!rest) {
      return message.reply([
        '**Usage `!embedbutton` :**',
        '`!embedbutton #salon | Titre | Description | Texte >> https://... | couleur`',
        '`!embedbutton aperçu | #salon | Titre | Description | Texte >> https://... | couleur`',
        '',
        '**Exemple :**',
        '`!embedbutton #annonces | 📋 Inscription | Clique pour t\'inscrire. | S\'inscrire >> https://supremyx.xyz | or`',
        '',
        'Maximum **5 boutons**. URLs commençant par `https://`.',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());
    const isPreview  = parts[0].toLowerCase() === 'aperçu';
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

  // ── !embedlist ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!embedlist')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const channelArg = content.slice('!embedlist'.length).trim();
    const target = !channelArg
      ? message.channel
      : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg.replace(/\D/g, '')) || null);

    if (!target) return message.reply('❌ Salon introuvable.');

    let fetched;
    try {
      fetched = await target.messages.fetch({ limit: 100 });
    } catch {
      return message.reply('❌ Impossible de lire les messages de ce salon (permissions manquantes ?).');
    }

    const botEmbeds = fetched
      .filter(m => m.author.id === client.user.id && m.embeds.length > 0)
      .first(10); // max 10 résultats

    if (!botEmbeds.length)
      return message.reply(`❌ Aucun embed du bot trouvé dans <#${target.id}> (sur les 100 derniers messages).`);

    const lines = botEmbeds.map(m => {
      const emb   = m.embeds[0];
      const title = emb.title ? `**${emb.title}**` : '*(sans titre)*';
      const desc  = emb.description ? emb.description.slice(0, 80).replace(/\n/g, ' ') + (emb.description.length > 80 ? '…' : '') : '*(vide)*';
      const hasButtons = m.components.length > 0 ? ' 🔘' : '';
      return `\`${m.id}\` — ${title}${hasButtons}\n↳ ${desc}\n↳ [Aller au message](${m.url})`;
    });

    const list = new EmbedBuilder()
      .setTitle(`📋 Embeds du bot dans #${target.name}`)
      .setDescription(lines.join('\n\n'))
      .setColor(0x5865F2)
      .setFooter({ text: `${botEmbeds.length} embed(s) trouvé(s) · Utilise !embededit pour modifier` })
      .setTimestamp();

    await message.reply({ embeds: [list] });
  });

  // ── !embedsupprimer ────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!embedsupprimer')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!embedsupprimer'.length).trim();

    if (!rest || !rest.includes('|')) {
      return message.reply([
        '**Usage :** `!embedsupprimer #salon | ID_message`',
        '`!embedsupprimer ici | ID_message` — dans le salon courant',
        '',
        '**Comment obtenir l\'ID du message :**',
        'Active le mode développeur Discord *(Paramètres → Apparence → Mode développeur)*',
        'puis fais clic droit sur le message → **Copier l\'identifiant**.',
        '',
        '**Exemple :**',
        '`!embedsupprimer #annonces | 1234567890123456789`',
        '',
        '⚠️ Je ne peux supprimer que mes propres messages.',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());
    const channelArg = parts[0];
    const messageId  = parts[1];

    if (!messageId || !/^\d{15,20}$/.test(messageId))
      return message.reply('❌ ID de message invalide. Il doit s\'agir d\'un identifiant numérique (ex : `1234567890123456789`).');

    const target = resolveTarget(message, channelArg);
    if (!target) return message.reply('❌ Salon introuvable. Mentionne-le avec `#salon` ou utilise `ici`.');

    let targetMessage;
    try {
      targetMessage = await target.messages.fetch(messageId);
    } catch {
      return message.reply(`❌ Message \`${messageId}\` introuvable dans <#${target.id}>. Vérifie l'ID et le salon.`);
    }

    if (targetMessage.author.id !== client.user.id)
      return message.reply('⛔ Je ne peux supprimer que **mes propres messages**.');

    if (!targetMessage.embeds.length)
      return message.reply('⚠️ Ce message ne contient pas d\'embed. Utilise `!embedsupprimer` uniquement sur des embeds publiés par le bot.');

    // Prévisualisation + confirmation
    const preview = targetMessage.embeds[0];
    const title   = preview.title || '*(sans titre)*';
    const desc    = preview.description
      ? preview.description.slice(0, 120).replace(/\n/g, ' ') + (preview.description.length > 120 ? '…' : '')
      : '*(vide)*';
    const hasButtons = targetMessage.components.length > 0 ? ' 🔘 *(contient des boutons)*' : '';

    const confirmEmbed = new EmbedBuilder()
      .setTitle('🗑️ Confirmer la suppression')
      .setColor(0xED4245)
      .addFields(
        { name: '📋 Titre',   value: title, inline: true },
        { name: '📍 Salon',   value: `<#${target.id}>`, inline: true },
        { name: '🆔 ID',      value: `\`${messageId}\``, inline: true },
        { name: '📝 Aperçu',  value: desc + hasButtons },
      )
      .setFooter({ text: 'Réagis ✅ pour supprimer, ❌ pour annuler (30s)' });

    const confirmed = await awaitConfirmation(message, confirmEmbed);

    if (!confirmed)
      return message.channel.send('❌ Suppression annulée.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));

    try {
      await targetMessage.delete();
    } catch {
      return message.reply('❌ Impossible de supprimer ce message (permissions manquantes ?).');
    }

    await message.reply(`✅ Message \`${messageId}\` supprimé dans <#${target.id}>.`);

    await staffLog(client, {
      action: 'liensupprimer',
      details: `**Salon :** <#${target.id}>\n**ID :** \`${messageId}\`\n**Titre :** ${title}`,
      author: message.author.tag
    });
  });

  // ── !embededit ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!embededit')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!embededit'.length).trim();

    if (!rest) {
      return message.reply([
        '**Usage `!embededit` :**',
        '`!embededit #salon | ID_message | Nouveau titre | Nouvelle description | couleur`',
        '`!embededit ici | ID_message | Nouveau titre | Nouvelle description | couleur`',
        '',
        '**Comment obtenir l\'ID du message :**',
        'Active le mode développeur Discord *(Paramètres → Apparence → Mode développeur)*',
        'puis fais clic droit sur le message → **Copier l\'identifiant**.',
        '',
        '**Exemple :**',
        '`!embededit #annonces | 1234567890123456789 | 🏆 Tournoi MAJ | Inscriptions closes. | rouge`',
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
