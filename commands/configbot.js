const Config = require('../database/models/Config');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

async function getOrCreateConfig() {
  let config = await Config.findOne();
  if (!config) {
    config = await Config.create({});
  }
  return config;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !config ---
    if (cmd === '!config') {
      const config = await getOrCreateConfig();
      const ptMap = config.pointSystem instanceof Map ? Object.fromEntries(config.pointSystem) : config.pointSystem;
      const ptRows = Object.entries(ptMap)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([place, pts]) => `  #${place} → ${pts} pts`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Configuration du bot')
        .setColor(0x5865F2)
        .addFields(
          { name: '🏆 Système de points', value: `\`\`\`${ptRows}\`\`\`` },
          { name: '💀 Bonus kill', value: `${config.killBonus} pt(s) par kill`, inline: true }
        )
        .setFooter({ text: 'Modifie avec !setpointssystem' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !setpointssystem <p1:pts> <p2:pts> ... [kill:<pts>] ---
    if (cmd === '!setpoints') {
      if (!isStaff) return message.reply('Staff uniquement');

      const pairs = args.slice(1);
      if (!pairs.length)
        return message.reply(
          'Usage : `!setpoints <place:pts> ... [kill:<pts>]`\n' +
          'Exemple : `!setpoints 1:10 2:6 3:5 4:4 5:3 6:2 7:1 8:1 kill:1`'
        );

      const config = await getOrCreateConfig();
      const newMap = new Map(config.pointSystem instanceof Map ? config.pointSystem : Object.entries(config.pointSystem));
      let killBonus = config.killBonus;

      for (const pair of pairs) {
        const [key, val] = pair.split(':');
        if (!key || val === undefined || isNaN(parseInt(val))) continue;
        if (key.toLowerCase() === 'kill' || key.toLowerCase() === 'élimination') {
          killBonus = parseInt(val);
        } else {
          newMap.set(String(parseInt(key)), parseInt(val));
        }
      }

      config.pointSystem = newMap;
      config.killBonus = killBonus;
      await config.save();

      const ptRows = Array.from(newMap.entries())
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([place, pts]) => `#${place} → ${pts} pts`)
        .join(' | ');

      logStaffAction(client, `⚙️ **Config mise à jour** — ${ptRows} | Kill: ${killBonus}pt | Par : ${message.author.tag}`);
      message.reply(`✅ Système de points mis à jour : ${ptRows}\n💀 Bonus kill : **${killBonus}** pt(s)`);
    }
    } catch (err) {
      console.error('[configbot] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
