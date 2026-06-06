const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const TournRegConfig = require('../database/models/TournRegConfig');
const TournamentRegistration = require('../database/models/TournamentRegistration');
const Blacklist = require('../database/models/Blacklist');
const { updateRegistrationBoard } = require('../utils/registrationManager');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (!message.guild) return;
    if (!message.content.startsWith('!inscrire')) return;
    if (message.author.bot) return;

    const config = await TournRegConfig.findOne({ guildId: message.guild.id });

    // Vérifier que les inscriptions sont ouvertes
    if (!config || !config.isOpen) {
      return message.reply('❌ Les inscriptions ne sont pas ouvertes en ce moment.');
    }

    // Vérifier qu'on est dans le bon salon
    if (config.registrationChannelId && message.channel.id !== config.registrationChannelId) {
      const regChannel = message.guild.channels.cache.get(config.registrationChannelId);
      return message.reply(`❌ Les inscriptions se font dans ${regChannel ? regChannel : 'le salon dédié'}.`);
    }

    // Parser : !inscrire <Nom équipe> | <Joueur1, Joueur2, ...>
    const content = message.content.slice('!inscrire'.length).trim();
    const parts = content.split('|');

    if (parts.length < 1 || !parts[0].trim()) {
      return message.reply([
        '❌ Format incorrect. Exemple :',
        '```',
        '!inscrire Team Alpha | PlayerOne, PlayerTwo, PlayerThree',
        '```',
      ].join('\n'));
    }

    const teamName = parts[0].trim();
    const players = parts[1]
      ? parts[1].split(',').map(p => p.trim()).filter(Boolean)
      : [];

    // Vérifier blacklist
    const blacklisted = await Blacklist.findOne({
      target: { $regex: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (blacklisted) {
      return message.reply(`🚫 L'équipe **${teamName}** est dans la blacklist.\nRaison : *${blacklisted.reason}*`);
    }

    // Vérifier doublon
    const existing = await TournamentRegistration.findOne({
      guildId: message.guild.id,
      tournamentName: config.tournamentName,
      teamName: new RegExp(`^${teamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      status: { $ne: 'refused' }
    });
    if (existing) {
      return message.reply(`⚠️ L'équipe **${teamName}** est déjà inscrite (statut : **${existing.status === 'pending' ? 'en attente' : 'acceptée'}**).`);
    }

    // Vérifier si l'utilisateur a déjà une inscription active
    const userExisting = await TournamentRegistration.findOne({
      guildId: message.guild.id,
      tournamentName: config.tournamentName,
      contactId: message.author.id,
      status: { $ne: 'refused' }
    });
    if (userExisting) {
      return message.reply(`⚠️ Tu as déjà inscrit l'équipe **${userExisting.teamName}** pour ce tournoi.`);
    }

    // Vérifier le max d'équipes
    if (config.maxTeams > 0) {
      const acceptedCount = await TournamentRegistration.countDocuments({
        guildId: message.guild.id,
        tournamentName: config.tournamentName,
        status: 'accepted'
      });
      if (acceptedCount >= config.maxTeams) {
        return message.reply(`❌ Le nombre maximum d'équipes (**${config.maxTeams}**) est atteint.`);
      }
    }

    // Créer l'inscription en base
    const reg = await TournamentRegistration.create({
      guildId: message.guild.id,
      tournamentName: config.tournamentName,
      teamName,
      players,
      contact: message.author.tag,
      contactId: message.author.id,
      status: 'pending'
    });

    // Supprimer le message de l'utilisateur pour garder le salon propre
    message.delete().catch(() => {});

    // Embed de notification staff
    const staffEmbed = new EmbedBuilder()
      .setTitle(`📥 Nouvelle inscription — ${teamName}`)
      .setColor(0xF1C40F)
      .addFields(
        { name: '🏆 Tournoi', value: config.tournamentName, inline: true },
        { name: '📞 Contact', value: `<@${message.author.id}>`, inline: true },
        { name: '👥 Joueurs', value: players.length ? players.join(', ') : '*Non renseigné*', inline: false },
        { name: '🕐 Inscrit le', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
      )
      .setFooter({ text: `ID: ${reg._id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`reg_accept_${reg._id}`)
        .setLabel('✅ Valider')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reg_refuse_${reg._id}`)
        .setLabel('❌ Refuser')
        .setStyle(ButtonStyle.Danger)
    );

    // Poster l'embed staff dans le salon des inscriptions
    const sentMsg = await message.channel.send({ embeds: [staffEmbed], components: [row] });
    reg.embedMessageId = sentMsg.id;
    await reg.save();

    // Confirmer à l'utilisateur par DM
    try {
      const dm = new EmbedBuilder()
        .setTitle(`⏳ Inscription reçue — ${teamName}`)
        .setColor(0xF1C40F)
        .setDescription(`Ton inscription pour le tournoi **${config.tournamentName}** a bien été reçue et est **en attente de validation** par le staff.`)
        .addFields(
          { name: '👥 Joueurs', value: players.length ? players.join(', ') : '*Non renseigné*' }
        )
        .setFooter({ text: 'Tu recevras un DM dès que le staff aura statué.' })
        .setTimestamp();
      await message.author.send({ embeds: [dm] });
    } catch {
      // DM désactivés
    }

    // Mettre à jour le tableau des inscrits
    await updateRegistrationBoard(client, message.guild.id);
  });
};
