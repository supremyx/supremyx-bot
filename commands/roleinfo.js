const { EmbedBuilder, PermissionsBitField } = require('discord.js');

const KEY_PERMS = [
  ['Administrator', 'Administrateur'],
  ['ManageGuild', 'Gérer le serveur'],
  ['ManageChannels', 'Gérer les salons'],
  ['ManageRoles', 'Gérer les rôles'],
  ['ManageMessages', 'Gérer les messages'],
  ['KickMembers', 'Expulser des membres'],
  ['BanMembers', 'Bannir des membres'],
  ['MentionEveryone', 'Mentionner @everyone'],
  ['ModerateMembers', 'Mettre en sourdine'],
];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!inforole')) return;

    const role = message.mentions.roles.first();
    if (!role) return message.reply('Usage : `!inforole @role`');

    await message.guild.members.fetch().catch(() => {});
    const memberCount = message.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
    const createdAt = `<t:${Math.floor(role.createdAt.getTime() / 1000)}:R>`;
    const perms = KEY_PERMS.filter(([perm]) => role.permissions.has(PermissionsBitField.Flags[perm])).map(([, label]) => label);

    const embed = new EmbedBuilder()
      .setTitle(`🏷️ @${role.name}`)
      .setColor(role.color || 0x5865F2)
      .addFields(
        { name: '🆔 ID', value: role.id, inline: true },
        { name: '🎨 Couleur', value: role.hexColor, inline: true },
        { name: '📅 Créé', value: createdAt, inline: true },
        { name: '👥 Membres', value: `${memberCount}`, inline: true },
        { name: '📍 Position', value: `#${role.position}`, inline: true },
        { name: '📌 Mentionnable', value: role.mentionable ? '✅ Oui' : '❌ Non', inline: true },
        { name: '🔼 Affiché séparément', value: role.hoist ? '✅ Oui' : '❌ Non', inline: true },
        { name: '🔑 Permissions clés', value: perms.length ? perms.join(', ') : '*Aucune permission spéciale*' }
      )
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  });
};
