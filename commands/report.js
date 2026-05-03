const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!report')) return;

    const report = message.content.slice('!report'.length).trim();

    if (!report) {
      return message.reply(
        '**Usage :** `!report <description du problème>`\n' +
        'Ton signalement sera transmis au staff de façon anonyme.\n' +
        'Exemple : `!report TeamX triche pendant les matchs`'
      );
    }

    const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL_ID);
    if (!logChannel) {
      return message.reply('❌ Impossible de contacter le staff pour le moment. Réessaie plus tard.');
    }

    const reportId = Math.random().toString(36).slice(2, 7).toUpperCase();
    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const staffEmbed = new EmbedBuilder()
      .setTitle(`🚨 Signalement #${reportId}`)
      .setColor(0xED4245)
      .setDescription(`> ${report}`)
      .addFields(
        { name: '📅 Date', value: now, inline: true },
        { name: '📍 Salon', value: `<#${message.channel.id}>`, inline: true }
      )
      .setFooter({ text: 'Signalement anonyme — identité masquée au staff' })
      .setTimestamp();

    await logChannel.send({ embeds: [staffEmbed] });

    // Delete the user's message to preserve anonymity
    message.delete().catch(() => {});

    // Confirm via DM
    const confirmEmbed = new EmbedBuilder()
      .setTitle('✅ Signalement envoyé')
      .setColor(0x57F287)
      .setDescription(`Ton signalement **#${reportId}** a bien été transmis au staff.\nMerci de contribuer à maintenir un environnement sain.`)
      .setTimestamp();

    message.author.createDM()
      .then(dm => dm.send({ embeds: [confirmEmbed] }))
      .catch(() => {
        // If DMs are closed, silently ignore
      });
  });
};
