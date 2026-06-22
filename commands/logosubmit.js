const { EmbedBuilder } = require('discord.js');
const Team = require('../database/models/Team');
const Config = require('../database/models/Config');
const { escapeRegex } = require('../utils/lib');
const { logStaffAction } = require('../utils/staffLog');

async function getConfig() {
  let config = await Config.findOne();
  if (!config) config = await Config.create({});
  return config;
}

async function refreshLogoList(client, config) {
  const listChannelId = config.logoListChannelId;
  if (!listChannelId) return;

  const listChannel = client.channels.cache.get(listChannelId);
  if (!listChannel) return;

  const teams = await Team.find({ logo: { $ne: '' } }).sort({ name: 1 });

  for (const team of teams) {
    const key = team.name.toLowerCase();
    const existingMsgId = config.logoListMessages.get(key);

    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle(`🛡️ ${team.name}`)
      .setImage(team.logo)
      .setFooter({ text: 'SUPREMYX — Logo officiel' })
      .setTimestamp();

    try {
      if (existingMsgId) {
        const existingMsg = await listChannel.messages.fetch(existingMsgId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit({ embeds: [embed] });
          continue;
        }
      }
      const newMsg = await listChannel.send({ embeds: [embed] });
      config.logoListMessages.set(key, newMsg.id);
    } catch (err) {
      console.error(`[logosubmit] Erreur refresh logo ${team.name}:`, err.message);
    }
  }

  await config.save();
}

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      const content = message.content.trim();
      if (!content.toLowerCase().startsWith('%logo')) return;

      const config = await getConfig();

      if (!config.logoSubmitChannelId) return;
      if (message.channel.id !== config.logoSubmitChannelId) return;

      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      const teamName = lines.slice(1).join(' ').trim();

      if (!teamName) {
        return message.reply(
          '❌ Mentionne le nom de ton équipe après `%logo`.\n' +
          '**Format :**\n```\n%logo\nNOM DE TON ÉQUIPE\n```'
        ).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
      }

      if (message.attachments.size === 0) {
        return message.reply(
          '❌ Aucune image détectée. Joins ton logo à ce message.\n' +
          '**Format :**\n```\n%logo\nNOM DE TON ÉQUIPE\n```'
        ).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
      }

      const attachment = message.attachments.find(a =>
        a.contentType && a.contentType.startsWith('image/')
      );

      if (!attachment) {
        return message.reply('❌ Le fichier joint n\'est pas une image valide (PNG, JPG, GIF…).')
          .then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
      }

      const team = await Team.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') }
      });

      if (!team) {
        return message.reply(
          `❌ Équipe **${teamName}** introuvable dans la base de données.\n` +
          'Vérifie l\'orthographe exacte du nom de ton équipe.'
        ).then(m => setTimeout(() => m.delete().catch(() => {}), 8000));
      }

      team.logo = attachment.url;
      await team.save();

      await message.react('✅');

      logStaffAction(
        client,
        `🖼️ **Logo soumis** — ${team.name} | Par : ${message.author.tag} | URL : ${attachment.url}`
      );

      await refreshLogoList(client, config);

    } catch (err) {
      console.error('[logosubmit]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
