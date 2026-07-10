const { EmbedBuilder } = require('discord.js');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.content !== '!latence' && message.content !== '!ping') return;
    const cd = checkCooldown(message.author.id, 'latence', 10, message.guild?.id);
    if (cd) return replyCooldown(message, cd, 'latence');

    try {
      const sent = await message.channel.send('🏓 Calcul...');
      const latency = sent.createdTimestamp - message.createdTimestamp;
      const apiLatency = Math.round(client.ws.ping);

      const color = latency < 100 ? 0x57F287 : latency < 300 ? 0xFEE75C : 0xED4245;

      const embed = new EmbedBuilder()
        .setTitle('🏓 Pong !')
        .setColor(color)
        .addFields(
          { name: '⏱️ Latence bot', value: `${latency}ms`, inline: true },
          { name: '💡 Latence API', value: `${apiLatency}ms`, inline: true }
        )
        .setFooter({ text: latency < 100 ? 'Excellent' : latency < 300 ? 'Correct' : 'Lent' })
        .setTimestamp();

      await sent.edit({ content: '', embeds: [embed] });
    } catch (err) {
      console.error('[ping] Erreur:', err);
    }
  });
};
