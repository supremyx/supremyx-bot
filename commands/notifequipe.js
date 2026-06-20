const Roster = require('../database/models/Roster');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      const content = message.content.trim();
      if (!content.startsWith('!notifequipe')) return;
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const rest = content.slice('!notifequipe'.length).trim();
      const pipeIdx = rest.indexOf('|');

      if (pipeIdx === -1 || !rest.slice(0, pipeIdx).trim() || !rest.slice(pipeIdx + 1).trim()) {
        return message.reply(
          '**Usage :** `!notifequipe <équipe> | <message>`\n' +
          'Exemple : `!notifequipe TeamAlpha | Match demain 20h00, soyez disponibles !`'
        );
      }

      const teamName = rest.slice(0, pipeIdx).trim();
      const msg = rest.slice(pipeIdx + 1).trim();

      const roster = await Roster.findOne({
        guildId: message.guild.id,
        teamName: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, 'i') }
      });

      if (!roster) return message.reply(`❌ Aucun roster trouvé pour **${teamName}**. Assure-toi que le roster est configuré avec \`!liste ajouter\`.`);

      const members = roster.members.filter(m => m.userId);
      if (!members.length) return message.reply(`❌ Aucun membre Discord lié dans le roster de **${teamName}**. Les membres doivent être ajoutés avec \`!liste ajouter <équipe> @user\`.`);

      const dmEmbed = new EmbedBuilder()
        .setTitle(`📣 Message du staff — ${roster.teamName}`)
        .setColor(0xFF8C00)
        .setDescription(msg)
        .setFooter({ text: `Envoyé par ${message.author.tag} · SUPREMYX` })
        .setTimestamp();

      let sent = 0;
      let failed = 0;
      for (const m of members) {
        const user = await client.users.fetch(m.userId).catch(() => null);
        if (!user) { failed++; continue; }
        const ok = await user.createDM()
          .then(dm => dm.send({ embeds: [dmEmbed] }))
          .catch(() => null);
        ok ? sent++ : failed++;
      }

      logStaffAction(client, `📣 **Notif équipe** — ${roster.teamName} (${sent} envoyés, ${failed} échoués) | Par : ${message.author.tag}`);

      const resultMsg = failed
        ? `✅ **${sent}/${members.length}** DM(s) envoyés à **${roster.teamName}** (${failed} inaccessible(s) — DM fermés).`
        : `✅ Notification envoyée à tous les **${sent}** membre(s) de **${roster.teamName}**.`;

      return message.reply(resultMsg);
    } catch (err) {
      console.error('[notifequipe]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
