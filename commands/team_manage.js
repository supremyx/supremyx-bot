const Team = require('../database/models/Team');
const Match = require('../database/models/Match');
const Lineup = require('../database/models/Lineup');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    const isStaff = message.member.permissions.has('Administrator');

    // --- !rename <ancien> | <nouveau> ---
    if (cmd === '!rename') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!rename'.length).trim();
      const parts = raw.split('|').map(p => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1])
        return message.reply('Usage : `!rename <ancien nom> | <nouveau nom>`');

      const [oldName, newName] = parts;
      const team = await Team.findOne({ name: { $regex: new RegExp(`^${oldName}$`, 'i') } });
      if (!team) return message.reply(`❌ Équipe **${oldName}** introuvable.`);

      const alreadyExists = await Team.findOne({ name: { $regex: new RegExp(`^${newName}$`, 'i') } });
      if (alreadyExists) return message.reply(`❌ Une équipe nommée **${newName}** existe déjà.`);

      const previousName = team.name;
      team.name = newName;
      await team.save();

      // Update all matches referencing old name
      await Match.updateMany({ team: previousName }, { $set: { team: newName } });
      await Lineup.findOneAndUpdate({ team: { $regex: new RegExp(`^${oldName}$`, 'i') } }, { team: newName });

      logStaffAction(client, `✏️ **Rename** — \`${previousName}\` → \`${newName}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ Équipe renommée : **${previousName}** → **${newName}** (historique mis à jour).`);
    }

    // --- !merge <equipe1> | <equipe2> ---
    if (cmd === '!merge') {
      if (!isStaff) return message.reply('Staff uniquement');

      const raw = content.slice('!merge'.length).trim();
      const parts = raw.split('|').map(p => p.trim());
      if (parts.length < 2 || !parts[0] || !parts[1])
        return message.reply('Usage : `!merge <équipe à absorber> | <équipe principale>`\nLes stats de la 1ère sont ajoutées à la 2ème, puis elle est supprimée.');

      const [srcName, dstName] = parts;
      const [src, dst] = await Promise.all([
        Team.findOne({ name: { $regex: new RegExp(`^${srcName}$`, 'i') } }),
        Team.findOne({ name: { $regex: new RegExp(`^${dstName}$`, 'i') } })
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

    // --- !lineup <equipe> <joueur1,joueur2,...> ---
    if (cmd === '!lineup') {
      const raw = content.slice('!lineup'.length).trim();
      if (!raw) return message.reply('Usage : `!lineup <équipe> <joueur1,joueur2,...>` ou `!lineup <équipe>` pour voir');

      const spaceIdx = raw.indexOf(' ');
      const teamName = spaceIdx >= 0 ? raw.slice(0, spaceIdx).trim() : raw;
      const playersRaw = spaceIdx >= 0 ? raw.slice(spaceIdx + 1).trim() : '';

      if (!playersRaw) {
        // View lineup
        const lineup = await Lineup.findOne({ team: { $regex: new RegExp(`^${teamName}$`, 'i') } });
        if (!lineup || !lineup.players.length)
          return message.reply(`Aucune composition définie pour **${teamName}**.`);

        const embed = new EmbedBuilder()
          .setTitle(`📋 Composition — ${lineup.team}`)
          .setColor(0x5865F2)
          .setDescription(lineup.players.map((p, i) => `**${i + 1}.** ${p}`).join('\n'))
          .setFooter({ text: `Mis à jour le ${new Date(lineup.updatedAt).toLocaleDateString('fr-FR')} par ${lineup.updatedBy}` })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // Set lineup (staff only)
      if (!isStaff) return message.reply('Staff uniquement pour définir la composition.');

      const players = playersRaw.split(',').map(p => p.trim()).filter(Boolean);
      if (!players.length) return message.reply('❌ Aucun joueur valide fourni.');

      await Lineup.findOneAndUpdate(
        { team: { $regex: new RegExp(`^${teamName}$`, 'i') } },
        { team: teamName, players, updatedBy: message.author.tag },
        { upsert: true, new: true }
      );

      logStaffAction(client, `📋 **Lineup** — \`${teamName}\` : ${players.join(', ')} | Par : ${message.author.tag}`);
      return message.reply(`✅ Composition de **${teamName}** enregistrée : ${players.join(', ')}`);
    }
  });
};
