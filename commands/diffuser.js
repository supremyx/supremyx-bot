const { EmbedBuilder } = require('discord.js');
const DiffuseurConfig = require('../database/models/DiffuseurConfig');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const contenu = message.content.trim();
    if (!contenu.startsWith('!diffuser')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator'))
      return message.reply('⛔ Staff uniquement.');

    const args    = contenu.split(' ').slice(1);
    const sousCmd = args[0]?.toLowerCase();
    const guildId = message.guild.id;

    try {

      // ─── !diffuser ajouter #canal ───────────────────────────────────────────
      if (sousCmd === 'ajouter') {
        const canal = message.mentions.channels.first();
        if (!canal) return message.reply('❌ Mentionne un canal. Ex : `!diffuser ajouter #général`');

        await DiffuseurConfig.findOneAndUpdate(
          { guildId },
          { $addToSet: { canaux: canal.id } },
          { upsert: true }
        );
        return message.reply(`✅ <#${canal.id}> ajouté à la liste de diffusion.`);
      }

      // ─── !diffuser retirer #canal ───────────────────────────────────────────
      if (sousCmd === 'retirer') {
        const canal = message.mentions.channels.first();
        if (!canal) return message.reply('❌ Mentionne un canal. Ex : `!diffuser retirer #général`');

        await DiffuseurConfig.findOneAndUpdate(
          { guildId },
          { $pull: { canaux: canal.id } }
        );
        return message.reply(`✅ <#${canal.id}> retiré de la liste de diffusion.`);
      }

      // ─── !diffuser liste ────────────────────────────────────────────────────
      if (sousCmd === 'liste') {
        const config = await DiffuseurConfig.findOne({ guildId }).lean();
        const ids    = config?.canaux || [];

        if (!ids.length) return message.reply('📋 Aucun canal configuré. Utilise `!diffuser ajouter #canal`.');

        const lignes = ids.map(id => {
          const c = message.guild.channels.cache.get(id);
          return c ? `• <#${id}>` : `• \`${id}\` *(introuvable)*`;
        }).join('\n');

        const embed = new EmbedBuilder()
          .setTitle('📋 Canaux de diffusion configurés')
          .setColor(0x5865F2)
          .setDescription(lignes)
          .setFooter({ text: `${ids.length} canal(aux) • !diffuser ajouter/retirer` })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      // ─── !diffuser aperçu <message> ─────────────────────────────────────────
      if (sousCmd === 'aperçu' || sousCmd === 'apercu') {
        const texte = args.slice(1).join(' ').trim();
        if (!texte) return message.reply('❌ Fournis un message. Ex : `!diffuser aperçu Tournoi ce soir !`');

        const embed = construireEmbed(texte, message);
        return message.channel.send({
          content: '*Aperçu de l\'annonce (non envoyée) :*',
          embeds: [embed]
        });
      }

      // ─── !diffuser <message> ────────────────────────────────────────────────
      // Peut aussi cibler des canaux spécifiques : !diffuser #canal1 #canal2 | message
      let cibles = [];
      let texte  = '';

      const mentionneCanaux = message.mentions.channels.size > 0 &&
        contenu.includes('|');

      if (mentionneCanaux) {
        const [, partie] = contenu.split('|');
        texte  = partie?.trim();
        cibles = [...message.mentions.channels.values()];
      } else {
        texte = args.join(' ').trim();
        const config = await DiffuseurConfig.findOne({ guildId }).lean();
        const ids = config?.canaux || [];
        if (!ids.length) {
          return message.reply(
            '❌ Aucun canal configuré.\n' +
            'Utilise `!diffuser ajouter #canal` ou cible des canaux directement :\n' +
            '`!diffuser #annonces #général | Votre message ici`'
          );
        }
        for (const id of ids) {
          const c = message.guild.channels.cache.get(id);
          if (c) cibles.push(c);
        }
      }

      if (!texte) {
        return message.reply(
          '**Commandes `!diffuser` :**\n' +
          '`!diffuser <message>` — Envoyer aux canaux configurés\n' +
          '`!diffuser #canal1 #canal2 | <message>` — Cibler des canaux précis\n' +
          '`!diffuser aperçu <message>` — Prévisualiser sans envoyer\n' +
          '`!diffuser ajouter #canal` — Ajouter un canal à la liste\n' +
          '`!diffuser retirer #canal` — Retirer un canal\n' +
          '`!diffuser liste` — Voir les canaux configurés'
        );
      }

      if (!cibles.length) return message.reply('❌ Aucun canal valide trouvé pour la diffusion.');

      const embed = construireEmbed(texte, message);
      let envoyes  = 0;
      let echecs   = 0;

      for (const canal of cibles) {
        try {
          await canal.send({ embeds: [embed] });
          envoyes++;
        } catch {
          echecs++;
        }
      }

      const ligne1 = `✅ Annonce diffusée dans **${envoyes}** canal(aux).`;
      const ligne2 = echecs ? `\n⚠️ ${echecs} canal(aux) inaccessible(s).` : '';
      return message.reply(ligne1 + ligne2);

    } catch (err) {
      console.error('[diffuser]', err);
      message.reply('❌ Erreur lors de la diffusion.').catch(() => {});
    }
  });
};

function construireEmbed(texte, message) {
  return new EmbedBuilder()
    .setAuthor({
      name: message.guild.name,
      iconURL: message.guild.iconURL({ dynamic: true }) || undefined
    })
    .setDescription(texte)
    .setColor(0x5865F2)
    .setFooter({ text: `Annonce par ${message.author.tag}` })
    .setTimestamp();
}
