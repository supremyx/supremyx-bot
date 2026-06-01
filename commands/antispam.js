const AntispamConfig = require('../database/models/AntispamConfig');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

async function getOrCreateConfig() {
  let config = await AntispamConfig.findOne();
  if (!config) config = await AntispamConfig.create({});
  return config;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!antispam')) return;
    if (!message.guild) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    const config = await getOrCreateConfig();

    // --- !antispam --- status
    if (!sub) {
      const embed = new EmbedBuilder()
        .setTitle('⏱️ Anti-spam — Configuration')
        .setColor(config.enabled ? 0x57F287 : 0xED4245)
        .addFields(
          { name: '🔘 Statut', value: config.enabled ? '✅ Activé' : '⛔ Désactivé', inline: true },
          { name: '📊 Seuil', value: `**${config.maxMessages}** messages`, inline: true },
          { name: '⏱️ Fenêtre', value: `**${config.windowSeconds}** seconde(s)`, inline: true }
        )
        .setDescription(`Un membre est signalé s'il envoie **${config.maxMessages}+** messages en **${config.windowSeconds}s**.`)
        .setFooter({ text: 'Modifie avec !antispam set <messages> <secondes>' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !antispam on ---
    if (sub === 'on') {
      config.enabled = true;
      await config.save();
      logStaffAction(client, `✅ **Anti-spam activé** | Par : ${message.author.tag}`);
      return message.reply('✅ Anti-spam **activé**.');
    }

    // --- !antispam off ---
    if (sub === 'off') {
      config.enabled = false;
      await config.save();
      logStaffAction(client, `⛔ **Anti-spam désactivé** | Par : ${message.author.tag}`);
      return message.reply('⛔ Anti-spam **désactivé**.');
    }

    // --- !antispam set <messages> <secondes> ---
    if (sub === 'set') {
      const maxMessages = parseInt(args[2]);
      const windowSeconds = parseInt(args[3]);

      if (isNaN(maxMessages) || isNaN(windowSeconds) || maxMessages < 2 || windowSeconds < 1) {
        return message.reply(
          'Usage : `!antispam set <messages> <secondes>`\n' +
          'Exemple : `!antispam set 5 5` — signale si 5 messages en 5 secondes\n' +
          'Minimum : 2 messages, 1 seconde.'
        );
      }

      config.maxMessages = maxMessages;
      config.windowSeconds = windowSeconds;
      await config.save();

      logStaffAction(client, `⚙️ **Anti-spam reconfiguré** — ${maxMessages} msg / ${windowSeconds}s | Par : ${message.author.tag}`);
      return message.reply(`✅ Seuil mis à jour : **${maxMessages}** messages en **${windowSeconds}** seconde(s).`);
    }

    message.reply(
      '**Commandes `!antispam` :**\n' +
      '`!antispam` — Voir le statut et la configuration\n' +
      '`!antispam on` — Activer\n' +
      '`!antispam off` — Désactiver\n' +
      '`!antispam set <messages> <secondes>` — Configurer le seuil'
    );
  });
};
