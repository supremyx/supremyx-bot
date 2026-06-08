const Config = require('../database/models/Config');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

async function getOrCreateConfig() {
  let config = await Config.findOne();
  if (!config) config = await Config.create({});
  return config;
}

async function sendMotd(client) {
  const config = await Config.findOne();
  if (!config || !config.motd) return;

  const announceChannel = client.channels.cache.get(process.env.ANNOUNCE_CHANNEL_ID);
  if (!announceChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('📢 Message du jour')
    .setColor(0xFEE75C)
    .setDescription(config.motd)
    .setFooter({ text: `Défini par ${config.motdSetBy}` })
    .setTimestamp();

  announceChannel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = (client, sendOnStartup = false) => {
  if (sendOnStartup) {
    client.once('clientReady', () => sendMotd(client));
  }

  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !setmotd <texte> ---
    if (cmd === '!setmotd') {
      if (!isStaff) return message.reply('Staff uniquement');

      const text = content.slice('!setmotd'.length).trim();
      if (!text) return message.reply('Usage : `!setmotd <message du jour>`');

      const config = await getOrCreateConfig();
      config.motd = text;
      config.motdSetBy = message.author.tag;
      await config.save();

      logStaffAction(client, `📢 **MOTD défini** par ${message.author.tag}`);
      return message.reply(`✅ Message du jour enregistré. Il sera envoyé dans le salon d'annonce au prochain démarrage du bot.\nUtilise \`!motd\` pour l'afficher maintenant.`);
    }

    // --- !motd ---
    if (cmd === '!motd') {
      const config = await getOrCreateConfig();
      if (!config.motd) return message.reply('Aucun message du jour défini. Utilise `!setmotd <texte>` pour en créer un.');

      const embed = new EmbedBuilder()
        .setTitle('📢 Message du jour')
        .setColor(0xFEE75C)
        .setDescription(config.motd)
        .setFooter({ text: `Défini par ${config.motdSetBy}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }
  });
};
