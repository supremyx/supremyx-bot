const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const content = message.content.trim();
    if (content !== '!infoserveur') return;
    if (!message.guild) return message.reply('❌ Cette commande fonctionne uniquement sur un serveur.').catch(() => {});

    const guild = message.guild;
    await guild.fetch().catch(() => {});

    const owner = await guild.fetchOwner().catch(() => null);
    const createdAt = `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>`;
    const members = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = members - bots;
    const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    const categories = guild.channels.cache.filter(c => c.type === 4).size;
    const roles = guild.roles.cache.size - 1; // exclude @everyone
    const boosts = guild.premiumSubscriptionCount || 0;
    const boostLevel = guild.premiumTier;

    const BOOST_LEVEL = { 0: 'Aucun', 1: 'Niveau 1', 2: 'Niveau 2', 3: 'Niveau 3' };

    const embed = new EmbedBuilder()
      .setTitle(`🏠 ${guild.name}`)
      .setColor(0x5865F2)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: '🆔 ID Serveur', value: guild.id, inline: true },
        { name: '👑 Propriétaire', value: owner ? `${owner.user.tag}` : 'Inconnu', inline: true },
        { name: '📅 Créé', value: createdAt, inline: true },
        { name: '👥 Membres', value: `${humans} humains • ${bots} bots`, inline: true },
        { name: '💬 Salons', value: `${textChannels} texte • ${voiceChannels} vocal • ${categories} catégories`, inline: true },
        { name: '🏷️ Rôles', value: `${roles}`, inline: true },
        { name: '🚀 Boosts', value: `${boosts} boost(s) — ${BOOST_LEVEL[boostLevel] || 'Aucun'}`, inline: true },
        { name: '🌍 Région', value: guild.preferredLocale || 'Non définie', inline: true }
      )
      .setFooter({ text: `SUPREMYX • ${guild.name}` })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
