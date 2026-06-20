const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

const BOT_START = Date.now();

function parseDate(str) {
  // DD/MM/YYYY or DD/MM/YYYY HH:MM
  const dm = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dm) {
    const [, d, mo, y, h = 0, mi = 0] = dm;
    return new Date(+y, +mo - 1, +d, +h, +mi);
  }
  // ISO YYYY-MM-DD
  const iso = new Date(str);
  if (!isNaN(iso)) return iso;
  return null;
}

function fmtDuration(ms) {
  if (ms <= 0) return 'Déjà passé !';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const parts = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}min`);
  if (s && !d) parts.push(`${s}s`);
  return parts.join(' ') || '< 1 seconde';
}

function fmtUptime(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return [d && `${d}j`, h && `${h}h`, m && `${m}min`, `${s}s`].filter(Boolean).join(' ');
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const content = message.content.trim();
    const args    = content.split(/\s+/);
    const cmd     = args[0].toLowerCase();

    // ── !rebours <date> [événement] ───────────────────────────────────────────
    if (cmd === '!rebours') {
      const cd = checkCooldown(message.author.id, 'rebours', 10);
      if (cd) return replyCooldown(message, cd, 'rebours');

      const rest = content.slice(cmd.length).trim();
      if (!rest) return message.reply('Usage : `!rebours <DD/MM/YYYY [HH:MM]> [nom de l\'événement]`\nEx : `!rebours 25/12/2026 14:00 Finale du tournoi`');

      // Séparer date et label
      const parts = rest.split(' ');
      let dateStr, label;

      // Si format DD/MM/YYYY HH:MM → 2 tokens pour la date
      if (parts[1]?.match(/^\d{1,2}:\d{2}$/)) {
        dateStr = parts[0] + ' ' + parts[1];
        label   = parts.slice(2).join(' ') || null;
      } else {
        dateStr = parts[0];
        label   = parts.slice(1).join(' ') || null;
      }

      const target = parseDate(dateStr);
      if (!target || isNaN(target)) {
        return message.reply('❌ Date invalide. Format attendu : `DD/MM/YYYY` ou `DD/MM/YYYY HH:MM`');
      }

      const diff = target - Date.now();
      const embed = new EmbedBuilder()
        .setColor(diff > 0 ? 0xFF8C00 : 0xED4245)
        .setAuthor({ name: '⏳ Compte à rebours', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: label ? `🎯 ${label}` : '🎯 Événement', value: target.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }), inline: false },
          { name: '⏱️ Temps restant', value: `**${fmtDuration(diff)}**`, inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !tempsenligne ─────────────────────────────────────────────────────────
    if (cmd === '!tempsenligne') {
      const cd = checkCooldown(message.author.id, 'tempsenligne', 10);
      if (cd) return replyCooldown(message, cd, 'tempsenligne');

      const uptimeMs   = Date.now() - BOT_START;
      const nodeUptime = process.uptime() * 1000;

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: '🟢 Temps en ligne — SUPREMYX Bot', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '⏱️ En ligne depuis', value: `**${fmtUptime(uptimeMs)}**`, inline: true },
          { name: '🖥️ Processus Node.js', value: `**${fmtUptime(nodeUptime)}**`, inline: true },
          { name: '🚀 Démarré le', value: new Date(BOT_START).toLocaleString('fr-FR'), inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !memoire ───────────────────────────────────────────────────────────────
    if (cmd === '!memoire' || cmd === '!mémoire') {
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const cd = checkCooldown(message.author.id, 'memoire', 10);
      if (cd) return replyCooldown(message, cd, 'memoire');

      const mem = process.memoryUsage();
      const toMB = (b) => (b / 1024 / 1024).toFixed(2);

      const usedPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
      const bar     = '█'.repeat(Math.round(usedPct / 5)) + '░'.repeat(20 - Math.round(usedPct / 5));

      const embed = new EmbedBuilder()
        .setColor(usedPct < 70 ? 0x57F287 : usedPct < 90 ? 0xF1C40F : 0xED4245)
        .setAuthor({ name: '💾 Mémoire — SUPREMYX Bot', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '📊 Tas JS utilisé / total', value: `**${toMB(mem.heapUsed)} MB** / ${toMB(mem.heapTotal)} MB`, inline: false },
          { name: '🖥️ RAM réservée (RSS)', value: `**${toMB(mem.rss)} MB**`, inline: true },
          { name: '📦 Externe (bindings)', value: `**${toMB(mem.external)} MB**`, inline: true },
          { name: `📈 Utilisation tas (${usedPct}%)`, value: `\`${bar}\``, inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports · Données en temps réel' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !lienbot ───────────────────────────────────────────────────────────────
    if (cmd === '!lienbot') {
      const cd = checkCooldown(message.author.id, 'lienbot', 30);
      if (cd) return replyCooldown(message, cd, 'lienbot');

      const clientId = client.user.id;
      const permissions = '8'; // Administrator
      const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot%20applications.commands`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: '🔗 Inviter SUPREMYX Bot', iconURL: client.user.displayAvatarURL() })
        .setDescription(`Clique sur le lien ci-dessous pour inviter le bot sur un autre serveur :\n\n[👉 **Inviter SUPREMYX Bot**](${inviteUrl})`)
        .addFields(
          { name: '🔐 Permissions', value: 'Administrateur (requis pour toutes les fonctionnalités)', inline: false },
        )
        .setFooter({ text: 'SUPREMYX Esports' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
