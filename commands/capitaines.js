/**
 * !capitaines — Liste tous les capitaines de toutes les équipes du serveur
 */
const { EmbedBuilder } = require('discord.js');
const Roster = require('../database/models/Roster');
const Team   = require('../database/models/Team');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (message.content.trim() !== '!capitaines') return;

      await message.channel.sendTyping();

      const rosters = await Roster.find().lean();
      const teams   = await Team.find().sort({ points: -1 }).lean();

      if (!teams.length) return message.reply('❌ Aucune équipe enregistrée.');

      const rosterMap = {};
      for (const r of rosters) rosterMap[r.teamName] = r;

      const lines = teams.map((t, i) => {
        const roster = rosterMap[t.name];
        let cap = '—';
        if (roster) {
          if (roster.captain) {
            cap = `👑 **${roster.captain}**`;
          } else if (roster.members?.length) {
            cap = `_Pas de capitaine défini_ (${roster.members.length} joueur${roster.members.length > 1 ? 's' : ''})`;
          }
        }
        return `**#${i + 1} ${t.name}** — ${cap}`;
      });

      const withCap    = lines.filter(l => l.includes('👑')).length;
      const withoutCap = teams.length - withCap;

      const embed = new EmbedBuilder()
        .setTitle('👑 Capitaines des équipes')
        .setDescription(lines.join('\n'))
        .setColor(0xF1C40F)
        .setFooter({ text: `${withCap} capitaine(s) défini(s) · ${withoutCap} équipe(s) sans capitaine · \`!capitaine <équipe> | @joueur\` pour définir` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[capitaines] Erreur:', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
