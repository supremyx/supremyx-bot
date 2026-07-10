const { EmbedBuilder } = require('discord.js');
const Pronostic = require('../database/models/Pronostic');
const Team      = require('../database/models/Team');
const { checkCooldown, replyCooldown } = require('../utils/cooldown');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.content.startsWith('!pronostic')) return;
      if (!message.member) return;

      const content = message.content.trim();
      const args    = content.slice('!pronostic'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const guildId = message.guild.id;

      // ── !pronostic classement ────────────────────────────────────────────
      if (sub === 'classement') {
        const cd = checkCooldown(message.author.id, 'pronostic-class', 10, message.guild?.id);
        if (cd) return replyCooldown(message, cd, 'pronostic-class');

        const all = await Pronostic.find({ guildId, correct: { $ne: null } });
        const map = new Map();
        for (const p of all) {
          if (!map.has(p.userId)) map.set(p.userId, { username: p.username, correct: 0, total: 0 });
          const e = map.get(p.userId);
          e.total++;
          if (p.correct) e.correct++;
        }
        const sorted = [...map.values()].sort((a, b) => b.correct - a.correct || b.total - a.total).slice(0, 10);
        if (!sorted.length) return message.reply('❌ Aucun pronostic résolu pour le moment.');

        const lines = sorted.map((e, i) => {
          const pct = e.total > 0 ? Math.round((e.correct / e.total) * 100) : 0;
          return `**#${i + 1}** ${e.username} — ${e.correct}/${e.total} correct(s) (${pct}%)`;
        });

        const embed = new EmbedBuilder()
          .setColor(0xFF8C00)
          .setTitle('🔮 Classement des pronostiqueurs')
          .setDescription(lines.join('\n'))
          .setFooter({ text: '!pronostic <T1> vs <T2> pour parier' })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // ── !pronostic resultats ─────────────────────────────────────────────
      if (sub === 'resultats' || sub === 'résultats') {
        const cd = checkCooldown(message.author.id, 'pronostic-res', 10, message.guild?.id);
        if (cd) return replyCooldown(message, cd, 'pronostic-res');

        const prons = await Pronostic.find({ guildId, userId: message.author.id }).sort({ createdAt: -1 }).limit(15);
        if (!prons.length) return message.reply('❌ Tu n\'as pas encore fait de pronostic. Utilise `!pronostic <T1> vs <T2>`.');

        const lines = prons.map(p => {
          const status = p.correct === null ? '⏳ En attente' : p.correct ? '✅ Correct' : '❌ Incorrect';
          return `${status} **${p.prediction}** *(${p.team1} vs ${p.team2})*`;
        });

        const correct = prons.filter(p => p.correct === true).length;
        const total   = prons.filter(p => p.correct !== null).length;

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🔮 Tes pronostics — ${message.author.username}`)
          .setDescription(lines.join('\n'))
          .addFields({ name: '📊 Score', value: `${correct}/${total} correct(s)${total > 0 ? ` (${Math.round((correct / total) * 100)}%)` : ''}`, inline: false })
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      // ── !pronostic valider <T1> vs <T2> <vainqueur> (staff) ─────────────
      if (sub === 'valider') {
        if (!message.member.permissions.has('Administrator')) return message.reply('⛔ Staff uniquement.');
        const rest = content.slice(content.indexOf('valider') + 7).trim();
        const vsIdx = rest.toLowerCase().indexOf(' vs ');
        if (vsIdx === -1) return message.reply('Usage : `!pronostic valider <T1> vs <T2> <vainqueur>`');
        const t1Parts  = rest.slice(0, vsIdx).trim();
        const afterVs  = rest.slice(vsIdx + 4).trim();
        const spaceIdx = afterVs.lastIndexOf(' ');
        if (spaceIdx === -1) return message.reply('Usage : `!pronostic valider <T1> vs <T2> <vainqueur>`');
        const t2Parts  = afterVs.slice(0, spaceIdx).trim();
        const winner   = afterVs.slice(spaceIdx + 1).trim();

        const updated = await Pronostic.updateMany(
          { guildId, team1: new RegExp(`^${t1Parts}$`, 'i'), team2: new RegExp(`^${t2Parts}$`, 'i'), correct: null },
          [{ $set: { correct: { $regexMatch: { input: '$prediction', regex: new RegExp(`^${winner}$`, 'i') } }, resolvedAt: new Date() } }]
        );
        return message.reply(`✅ **${updated.modifiedCount}** pronostic(s) résolu(s) pour **${t1Parts} vs ${t2Parts}** — vainqueur : **${winner}**.`);
      }

      // ── !pronostic <T1> vs <T2> ──────────────────────────────────────────
      const rest  = content.slice('!pronostic'.length).trim();
      const vsIdx = rest.toLowerCase().indexOf(' vs ');
      if (vsIdx === -1) {
        return message.reply(
          '**Usage :** `!pronostic <équipe1> vs <équipe2>`\n' +
          'Ex : `!pronostic TeamAlpha vs TeamBeta`\n\n' +
          '**Sous-commandes :** `resultats` · `classement` · `valider <T1> vs <T2> <vainqueur>` *(staff)*'
        );
      }

      const t1Name = rest.slice(0, vsIdx).trim();
      const t2Name = rest.slice(vsIdx + 4).trim();
      if (!t1Name || !t2Name) return message.reply('❌ Précise les deux équipes.');

      const cd = checkCooldown(message.author.id, 'pronostic', 10, message.guild?.id);
      if (cd) return replyCooldown(message, cd, 'pronostic');

      const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [t1, t2] = await Promise.all([
        Team.findOne({ name: new RegExp(`^${esc(t1Name)}$`, 'i') }),
        Team.findOne({ name: new RegExp(`^${esc(t2Name)}$`, 'i') }),
      ]);
      if (!t1) return message.reply(`❌ Équipe **${t1Name}** introuvable.`);
      if (!t2) return message.reply(`❌ Équipe **${t2Name}** introuvable.`);

      const existing = await Pronostic.findOne({ guildId, userId: message.author.id, team1: t1.name, team2: t2.name, correct: null });
      if (existing) return message.reply(`❌ Tu as déjà un pronostic en attente pour **${t1.name} vs ${t2.name}** : **${existing.prediction}**.`);

      const prompt = `
**${t1.name}** — ${t1.points} pts, ${t1.kills} kills, ${t1.wins}V/${t1.losses}D
**${t2.name}** — ${t2.points} pts, ${t2.kills} kills, ${t2.wins}V/${t2.losses}D

Qui préféres-tu comme vainqueur ?
`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🔮 Pronostic — ${t1.name} vs ${t2.name}`)
        .setDescription(`${prompt}\nRéponds avec \`1\` pour **${t1.name}** ou \`2\` pour **${t2.name}** dans les 30 secondes.`)
        .setTimestamp();

      const prompt_msg = await message.reply({ embeds: [embed] });

      const filter = m => m.author.id === message.author.id && ['1', '2'].includes(m.content.trim());
      let collected;
      try {
        collected = await message.channel.awaitMessages({ filter, max: 1, time: 30_000, errors: ['time'] });
      } catch {
        return prompt_msg.edit({ content: '⏱️ Temps écoulé — pronostic annulé.', embeds: [] });
      }

      const choice    = collected.first().content.trim();
      const predicted = choice === '1' ? t1.name : t2.name;

      await Pronostic.create({ guildId, userId: message.author.id, username: message.author.username, team1: t1.name, team2: t2.name, prediction: predicted });
      return message.reply(`✅ Pronostic enregistré — tu mises sur **${predicted}** !`);

    } catch (err) {
      console.error('[pronostic]', err);
    }
  });
};
