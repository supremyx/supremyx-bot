const Achievement = require('../database/models/Achievement');
const Match = require('../database/models/Match');
const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !achievement <icon> <equipe> <titre> | <description> ---
    if (cmd === '!achievement') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!achievement'.length).trim();
      const pipeIdx = raw.indexOf('|');
      const mainPart = pipeIdx >= 0 ? raw.slice(0, pipeIdx).trim() : raw;
      const description = pipeIdx >= 0 ? raw.slice(pipeIdx + 1).trim() : '';
      const mainArgs = mainPart.split(' ');

      // Check if first arg is an emoji (icon)
      const emojiRegex = /\p{Emoji}/u;
      let icon = '🏅';
      let rest = mainArgs;
      if (mainArgs[0] && emojiRegex.test(mainArgs[0]) && mainArgs[0].length <= 4) {
        icon = mainArgs[0];
        rest = mainArgs.slice(1);
      }

      if (rest.length < 2)
        return message.reply('Usage : `!achievement [emoji] <équipe> <titre> | <description>`\nExemple : `!achievement 🔥 TeamA Sniper d\'élite | 10 kills en un match`');

      const target = rest[0];
      const title = rest.slice(1).join(' ');

      await Achievement.create({ target, title, description, icon, awardedBy: message.author.tag });

      const embed = new EmbedBuilder()
        .setTitle(`${icon} Trophée attribué !`)
        .setColor(0xFEE75C)
        .addFields(
          { name: '🎯 Équipe', value: target, inline: true },
          { name: '🏅 Titre', value: title, inline: true }
        )
        .setTimestamp();

      if (description) embed.setDescription(description);
      embed.setFooter({ text: `Attribué par ${message.author.tag}` });

      logStaffAction(client, `🏅 **Achievement** — "${title}" attribué à \`${target}\` | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // --- !achievements <equipe> ---
    if (cmd === '!achievements') {
      const target = args.slice(1).join(' ').trim();
      if (!target) return message.reply('Usage : `!achievements <équipe>`');

      const achs = await Achievement.find({
        target: { $regex: new RegExp(`^${target}$`, 'i') }
      }).sort({ createdAt: -1 });

      if (!achs.length) return message.reply(`🏆 Aucun trophée pour **${target}** pour le moment.`);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Trophées — ${target}`)
        .setColor(0xFEE75C)
        .setDescription(`**${achs.length}** trophée(s) obtenu(s)`)
        .setTimestamp();

      for (const a of achs) {
        const date = new Date(a.createdAt).toLocaleDateString('fr-FR');
        embed.addFields({
          name: `${a.icon} ${a.title}`,
          value: `${a.description ? a.description + '\n' : ''}📅 ${date} • par ${a.awardedBy}`
        });
      }

      return message.channel.send({ embeds: [embed] });
    }

    // --- !mvpseason ---
    if (cmd === '!mvpseason') {
      const teams = await Team.find().sort({ kills: -1 }).limit(5);
      if (!teams.length) return message.reply('Aucune équipe enregistrée.');

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
      const rows = teams.map((t, i) => `${medals[i]} **${t.name}** — ${t.kills} kills • ${t.points} pts`);

      const embed = new EmbedBuilder()
        .setTitle('💀 MVP — Classement des kills')
        .setColor(0xED4245)
        .setDescription(rows.join('\n'))
        .setFooter({ text: 'Classement par kills totaux' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
    } catch (err) {
      console.error('[achievement] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
