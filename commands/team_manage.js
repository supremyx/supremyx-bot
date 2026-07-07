const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Lineup = require('../database/models/Lineup');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { escapeRegex } = require('../utils/lib');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    const isStaff = message.member.permissions.has('Administrator');

    // --- !rename <ancien> | <nouveau> ---
    if (cmd === '!renommer') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!renommer'.length).trim();
      const parts = raw.split('|').map(p => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1])
        return message.reply('Usage : `!renommer <ancien nom> | <nouveau nom>`');

      const [oldName, newName] = parts;
      const team = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(oldName)}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${oldName}** introuvable.`);

      const alreadyExists = await Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(newName)}$`, 'i') } });
      if (alreadyExists) return message.reply(`❌ Une équipe nommée **${newName}** existe déjà.`);

      const previousName = team.name;
      team.name = newName;
      await team.save();

      // Update all matches referencing old name
      await Match.updateMany({ team: previousName }, { $set: { team: newName } });
      await Lineup.findOneAndUpdate({ team: { $regex: new RegExp(`^${escapeRegex(oldName)}$`, 'i') } }, { team: newName });

      logStaffAction(client, `✏️ **Rename** — \`${previousName}\` → \`${newName}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ Équipe renommée : **${previousName}** → **${newName}** (historique mis à jour).`);
    }

    // --- !fusionner <equipe1> | <equipe2> ---
    if (cmd === '!fusionner') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!fusionner'.length).trim();
      const parts = raw.split('|').map(p => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1])
        return message.reply('Usage : `!fusionner <équipe à absorber> | <équipe principale>`\nLes stats de la 1ère sont ajoutées à la 2ème, puis elle est supprimée.');

      const [srcName, dstName] = parts;
      const [src, dst] = await Promise.all([
        Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(srcName)}$`, 'i') } }),
        Team.findOne({ name: { $regex: new RegExp(`^${escapeRegex(dstName)}$`, 'i') } })
      ]);

      if (!src) return message.reply(`❌ Équipe **${srcName}** introuvable.`);
      if (!dst) return message.reply(`❌ Équipe **${dstName}** introuvable.`);

      dst.points += src.points;
      dst.kills += src.kills;
      dst.wins += src.wins;
      dst.losses += src.losses;
      await dst.save();

      await Match.updateMany({ team: src.name }, { $set: { team: dst.name } });
      await Team.findByIdAndDelete(src._id);

      logStaffAction(client, `🔀 **Merge** — \`${src.name}\` absorbé dans \`${dst.name}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ **${src.name}** fusionnée dans **${dst.name}**.\nPoints : +${src.points} | Kills : +${src.kills}`);
    }

    // NOTE: !composition est géré entièrement par lineup.js (plus complet)
    } catch (err) {
      console.error('[team_manage] Erreur:', err);
      message.reply('❌ Une erreur est survenue. Réessaie dans un instant.').catch(() => {});
    }
  });
};
