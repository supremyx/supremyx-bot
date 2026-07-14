const CooldownConfig = require('../database/models/CooldownConfig');
const { EmbedBuilder } = require('discord.js');
const { invalidateCooldownCache } = require('../utils/cooldown');
const { logStaffAction } = require('../utils/staffLog');

// Known public commands with their default cooldown in seconds
const DEFAULTS = {
  latence: 10, classement: 10, statistiques: 5, recherche: 5,
  comparer: 5, top: 10, matchs: 15, mvp: 15,
  historique: 10, tournois: 10, classniveau: 15,
  pileface: 3, tirageequipe: 5, faceatface: 10,
  serie: 5, regularite: 5, calculer: 3,
  regles: 10, saisons: 10, calendrier: 5
};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    if (!content.startsWith('!configdelai') && !content.startsWith('!delais') && !content.startsWith('!supprimerdelai')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !cooldowns --- list all
    if (cmd === '!delais') {
      const overrides = await CooldownConfig.find().sort({ command: 1 });
      const overrideMap = Object.fromEntries(overrides.map(o => [o.command, o.seconds]));

      const embed = new EmbedBuilder()
        .setTitle('⏳ Cooldowns des commandes publiques')
        .setColor(0x5865F2)
        .setTimestamp();

      const rows = Object.entries(DEFAULTS).map(([name, def]) => {
        const override = overrideMap[name];
        const active = override !== undefined ? override : def;
        const tag = override !== undefined ? ' *(modifié)*' : '';
        const status = active === 0 ? '🟢 désactivé' : `**${active}s**`;
        return `\`!${name}\` — ${status}${tag}`;
      });

      embed.setDescription(rows.join('\n'));
      embed.setFooter({ text: 'Modifie avec !configdelai <commande> <secondes> • 0 = sans cooldown' });
      return message.channel.send({ embeds: [embed] });
    }

    // --- !configdelai <commande> <secondes> ---
    if (cmd === '!configdelai') {
      const commandName = args[1]?.toLowerCase().replace(/^!/, '');
      const seconds = parseInt(args[2]);

      if (!commandName || isNaN(seconds) || seconds < 0)
        return message.reply(
          'Usage : `!configdelai <commande> <secondes>`\n' +
          'Exemple : `!configdelai ranking 30` — 30s entre chaque `!ranking`\n' +
          'Utilise `0` pour désactiver le cooldown d\'une commande.'
        );

      if (seconds > 3600) return message.reply('❌ Maximum 3600 secondes (1 heure).');

      await CooldownConfig.findOneAndUpdate(
        { command: commandName },
        { command: commandName, seconds, updatedBy: message.author.tag },
        { upsert: true, new: true }
      );

      await invalidateCooldownCache();

      const label = seconds === 0 ? 'désactivé' : `${seconds}s`;
      logStaffAction(client, `⏳ **Cooldown** — \`!${commandName}\` → ${label} | Par : ${message.author.tag}`);
      return message.reply(`✅ Cooldown de \`!${commandName}\` mis à **${label}**.`);
    }

    // --- !delcooldown <commande> --- reset to default
    if (cmd === '!supprimerdelai') {
      const commandName = args[1]?.toLowerCase().replace(/^!/, '');
      if (!commandName) return message.reply('Usage : `!supprimerdelai <commande>`');

      const deleted = await CooldownConfig.findOneAndDelete({ command: commandName });
      if (!deleted) return message.reply(`❌ Aucun cooldown personnalisé pour \`!${commandName}\`. Il utilise déjà la valeur par défaut.`);

      await invalidateCooldownCache();
      const def = DEFAULTS[commandName] ?? '?';
      logStaffAction(client, `🔄 **Cooldown réinitialisé** — \`!${commandName}\` → défaut (${def}s) | Par : ${message.author.tag}`);
      return message.reply(`✅ Cooldown de \`!${commandName}\` réinitialisé à la valeur par défaut (**${def}s**).`);
    }
    } catch (err) {
      console.error('[cooldowncmd] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
