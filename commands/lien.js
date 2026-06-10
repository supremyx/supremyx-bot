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

// Parse boutons depuis une chaîne : "Texte 1 >> https://... | Texte 2 >> https://..."
function parseButtons(raw = '') {
  return raw.split('|').map(s => s.trim()).filter(Boolean).map(part => {
    const sep = part.indexOf('>>');
    if (sep === -1) return null;
    const label = part.slice(0, sep).trim();
    const url   = part.slice(sep + 2).trim();
    if (!label || !url.startsWith('http')) return null;
    return { label, url };
  }).filter(Boolean).slice(0, 5); // max 5 boutons (limite Discord)
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!lien')) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const rest = content.slice('!lien'.length).trim();

    // ── Aide ───────────────────────────────────────────────────────────────
    if (!rest) {
      return message.reply([
        '**Commandes `!lien` :**',
        '',
        '**Embed avec liens cliquables (dans le texte) :**',
        '`!lien #salon | Titre | Texte avec [lien](https://url.com) ici | couleur`',
        '`!lien ici | Titre | Rejoins [notre Discord](https://discord.gg/...) ! | bleu`',
        '',
        '**Embed avec boutons cliquables :**',
        '`!lienbutton #salon | Titre | Description | Bouton 1 >> https://... | Bouton 2 >> https://...`',
        '',
        '**Couleurs :** `rouge`, `vert`, `bleu`, `jaune`, `orange`, `violet`, `rose`, `or`, `cyan`, `gris` ou `#HEX`',
        '**`ici`** = poste dans le salon actuel',
        '',
        '**Exemple complet :**',
        '`!lien #annonces | 🏆 Tournoi | Inscris-toi sur [notre site](https://supremyx.xyz) avant le 20 juin ! | or`',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());

    // ── !lien ──────────────────────────────────────────────────────────────
    const channelArg = parts[0];
    const title      = parts[1] || '';
    const desc       = parts[2] || '';
    const colorRaw   = parts[3] || 'bleu';

    if (!desc) return message.reply('❌ La description est requise. Usage : `!lien #salon | Titre | Description | couleur`');

    const target = channelArg.toLowerCase() === 'ici'
      ? message.channel
      : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg));

    if (!target) return message.reply('❌ Salon introuvable. Mentionne un salon avec `#` ou écris `ici`.');

    const embed = new EmbedBuilder()
      .setColor(parseColor(colorRaw))
      .setDescription(desc)
      .setFooter({ text: `Posté par ${message.author.tag}` })
      .setTimestamp();

    if (title) embed.setTitle(title);

    await target.send({ embeds: [embed] });

    if (target.id !== message.channel.id)
      message.reply(`✅ Message envoyé dans <#${target.id}>.`);
    else
      message.reply('✅ Message envoyé.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));

    await message.delete().catch(() => {});

    await staffLog(client, {
      action: 'lien',
      details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Contenu :** ${desc.slice(0, 200)}`,
      author: message.author.tag
    });
  });

  // ── !lienbutton — embed + boutons cliquables ───────────────────────────
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
        '`!lienbutton #salon | Titre | Description | Bouton 1 >> https://... | Bouton 2 >> https://...`',
        '',
        '**Exemple :**',
        '`!lienbutton #annonces | 📋 Inscription | Clique sur le bouton pour t\'inscrire au tournoi. | S\'inscrire >> https://supremyx.xyz | Règlement >> https://supremyx.xyz/regles`',
        '',
        'Maximum **5 boutons**. Les URLs doivent commencer par `https://`.',
      ].join('\n'));
    }

    const parts = rest.split('|').map(p => p.trim());

    const channelArg  = parts[0];
    const title       = parts[1] || '';
    const desc        = parts[2] || '';
    const buttonsRaw  = parts.slice(3).join('|');
    const buttons     = parseButtons(buttonsRaw);

    if (!desc) return message.reply('❌ La description est requise.');
    if (!buttons.length) return message.reply('❌ Aucun bouton valide trouvé. Format : `Texte >> https://url.com`');

    const target = channelArg.toLowerCase() === 'ici'
      ? message.channel
      : (message.mentions.channels.first() || message.guild.channels.cache.get(channelArg));

    if (!target) return message.reply('❌ Salon introuvable. Mentionne un salon avec `#` ou écris `ici`.');

    const embed = new EmbedBuilder()
      .setColor(parseColor('bleu'))
      .setDescription(desc)
      .setFooter({ text: `Posté par ${message.author.tag}` })
      .setTimestamp();

    if (title) embed.setTitle(title);

    const row = new ActionRowBuilder().addComponents(
      buttons.map(b =>
        new ButtonBuilder()
          .setLabel(b.label)
          .setURL(b.url)
          .setStyle(ButtonStyle.Link)
      )
    );

    await target.send({ embeds: [embed], components: [row] });

    if (target.id !== message.channel.id)
      message.reply(`✅ Message avec boutons envoyé dans <#${target.id}>.`);
    else
      message.reply('✅ Message avec boutons envoyé.').then(m => setTimeout(() => m.delete().catch(() => {}), 4000));

    await message.delete().catch(() => {});

    await staffLog(client, {
      action: 'lienbutton',
      details: `**Salon :** <#${target.id}>\n**Titre :** ${title || '—'}\n**Boutons :** ${buttons.map(b => `[${b.label}](${b.url})`).join(', ')}`,
      author: message.author.tag
    });
  });
};
