const CooldownConfig = require('../database/models/CooldownConfig');
const { EmbedBuilder } = require('discord.js');
const { invalidateCooldownCache } = require('../utils/cooldown');
const { logStaffAction } = require('../utils/staffLog');

// Known public commands with their default cooldown in seconds
const DEFAULTS = {
  ping: 10, ranking: 10, stats: 5, search: 5,
  compare: 10, top: 10, matchs: 10, mvp: 10,
  history: 5, tournois: 10, leaderboard: 10,
  coinflip: 3, randteam: 5, h2h: 10,
  streak: 5, consistency: 5, calc: 3,
  rules: 10, saisons: 10, schedule: 5
};

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!setcooldown') && !content.startsWith('!cooldowns') && !content.startsWith('!delcooldown')) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const cmd = args[0].toLowerCase();

    // --- !cooldowns --- list all
    if (cmd === '!cooldowns') {
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
      embed.setFooter({ text: 'Modifie avec !setcooldown <commande> <secondes> • 0 = sans cooldown' });
      return message.channel.send({ embeds: [embed] });
    }

    // --- !setcooldown <commande> <secondes> ---
    if (cmd === '!setcooldown') {
      const commandName = args[1]?.toLowerCase().replace(/^!/, '');
      const seconds = parseInt(args[2]);

      if (!commandName || isNaN(seconds) || seconds < 0)
        return message.reply(
          'Usage : `!setcooldown <commande> <secondes>`\n' +
          'Exemple : `!setcooldown ranking 30` — 30s entre chaque `!ranking`\n' +
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
    if (cmd === '!delcooldown') {
      const commandName = args[1]?.toLowerCase().replace(/^!/, '');
      if (!commandName) return message.reply('Usage : `!delcooldown <commande>`');

      const deleted = await CooldownConfig.findOneAndDelete({ command: commandName });
      if (!deleted) return message.reply(`❌ Aucun cooldown personnalisé pour \`!${commandName}\`. Il utilise déjà la valeur par défaut.`);

      await invalidateCooldownCache();
      const def = DEFAULTS[commandName] ?? '?';
      logStaffAction(client, `🔄 **Cooldown réinitialisé** — \`!${commandName}\` → défaut (${def}s) | Par : ${message.author.tag}`);
      return message.reply(`✅ Cooldown de \`!${commandName}\` réinitialisé à la valeur par défaut (**${def}s**).`);
    }
  });
};
