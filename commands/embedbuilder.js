const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!embed')) return;
    if (!message.guild) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const rest = content.slice('!embed'.length).trim();

    if (!rest) {
      return message.reply(
        '**Usage :** `!embed <titre> | <description> | [couleur] | [image_url] | [footer]`\n\n' +
        '**Exemples :**\n' +
        '`!embed Bienvenue | Rejoins notre serveur ! `\n' +
        '`!embed Règles | Sois respectueux. | #FF0000`\n' +
        '`!embed Annonce | Texte | #5865F2 | https://... | Pied de page`\n\n' +
        '**Couleurs prédéfinies :** `rouge`, `vert`, `bleu`, `jaune`, `orange`, `violet`, `blanc`, `noir`'
      );
    }

    const parts = rest.split('|').map(p => p.trim());
    const title = parts[0] || '';
    const description = parts[1] || '';
    const colorRaw = parts[2] || 'bleu';
    const imageUrl = parts[3] || '';
    const footer = parts[4] || '';

    // Parse color
    const COLOR_MAP = {
      rouge: 0xED4245, rougepur: 0xFF0000, vert: 0x57F287, bleu: 0x5865F2, bleucliel: 0x87CEEB,
      jaune: 0xFEE75C, orange: 0xE67E22, violet: 0x9B59B6,
      blanc: 0xFFFFFF, noir: 0x2C2F33, gris: 0x808080,
      or: 0xF1C40F, cyan: 0x1ABC9C
    };
    let color = COLOR_MAP[colorRaw.toLowerCase()] || 0xF1C40F;
    if (colorRaw.startsWith('#')) {
      const parsed = parseInt(colorRaw.slice(1), 16);
      if (!isNaN(parsed)) color = parsed;
    }

    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (imageUrl) embed.setImage(imageUrl);
    if (footer) embed.setFooter({ text: footer });
    embed.setTimestamp();

    await message.channel.send({ embeds: [embed] });
    try { await message.delete(); } catch {}

    logStaffAction(client, `📝 **Embed posté** — "${title || 'Sans titre'}" | Par : ${message.author.tag}`);
  });
};
