const Team = require('../database/models/Team');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      const content = message.content.trim();
      if (!content.startsWith('!configlogo') && !content.startsWith('!setlogo')) return;
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const _slCmd = content.startsWith('!configlogo') ? '!configlogo' : '!setlogo';
      const rest = content.slice(_slCmd.length).trim();
      const pipeIdx = rest.indexOf('|');

      if (pipeIdx === -1 || !rest.slice(0, pipeIdx).trim() || !rest.slice(pipeIdx + 1).trim()) {
        return message.reply(
          '**Usage :** `!configlogo <équipe> | <url>`\n' +
          'Exemple : `!configlogo TeamAlpha | https://i.imgur.com/abc.png`\n' +
          'Pour supprimer : `!configlogo TeamAlpha | supprimer`'
        );
      }

      const teamName = rest.slice(0, pipeIdx).trim();
      const url = rest.slice(pipeIdx + 1).trim();

      const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${teamName}** introuvable.`);

      if (url.toLowerCase() === 'supprimer') {
        team.logo = '';
        await team.save();
        logStaffAction(client, `🖼️ **Logo supprimé** — ${team.name} | Par : ${message.author.tag}`);
        return message.reply(`✅ Logo de **${team.name}** supprimé.`);
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return message.reply('❌ L\'URL doit commencer par `http://` ou `https://`.');
      }

      team.logo = url;
      await team.save();

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Logo mis à jour — ${team.name}`)
        .setColor(0x57F287)
        .setThumbnail(url)
        .addFields({ name: '🔗 URL', value: url.length > 200 ? url.slice(0, 197) + '…' : url })
        .setFooter({ text: `Par ${message.author.tag}` })
        .setTimestamp();

      logStaffAction(client, `🖼️ **Logo défini** — ${team.name} | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[setlogo]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
