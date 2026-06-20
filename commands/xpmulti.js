const { EmbedBuilder } = require('discord.js');
const ChannelMultiplier = require('../database/models/ChannelMultiplier');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!xp')) return;
      if (!message.member) return;

      const content = message.content.trim();
      const args    = content.slice('!xp'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const guildId = message.guild.id;

      // ── !xp multiplicateurs ───────────────────────────────────────────────
      if (sub === 'multiplicateurs') {
        if (!message.member.permissions.has('Administrator')) return message.reply('⛔ Staff uniquement.');
        const list = await ChannelMultiplier.find({ guildId });
        if (!list.length) return message.reply('❌ Aucun multiplicateur configuré. Utilise `!xp multiplicateur #salon <valeur>`.');
        const lines = list.map(m => {
          const label = m.multiplier === 0 ? '🚫 Désactivé' : m.multiplier > 1 ? `⚡ ×${m.multiplier}` : `×${m.multiplier}`;
          return `<#${m.channelId}> — ${label}`;
        });
        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle('⚡ Multiplicateurs XP par salon')
          .setDescription(lines.join('\n'))
          .setFooter({ text: '!xp multiplicateur #salon <valeur> pour modifier' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !xp multiplicateur #salon <valeur> ────────────────────────────────
      if (sub === 'multiplicateur') {
        if (!message.member.permissions.has('Administrator')) return message.reply('⛔ Staff uniquement.');
        const chan = message.mentions.channels.first();
        const val  = parseFloat(args[args.length - 1]);
        if (!chan || isNaN(val) || val < 0 || val > 10)
          return message.reply('Usage : `!xp multiplicateur #salon <valeur>`\nValeur entre **0** (désactivé) et **10**.\nEx : `!xp multiplicateur #général 2` pour doubler l\'XP dans ce salon.');

        await ChannelMultiplier.findOneAndUpdate(
          { guildId, channelId: chan.id },
          { multiplier: val },
          { upsert: true }
        );

        const label = val === 0 ? '🚫 **désactivé** (XP = 0)' : `⚡ **×${val}**`;
        return message.reply(`✅ Multiplicateur XP pour <#${chan.id}> défini à ${label}.`);
      }

    } catch (err) {
      console.error('[xpmulti]', err);
    }
  });
};
