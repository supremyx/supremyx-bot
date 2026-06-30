const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const TournRegConfig = require('../database/models/TournRegConfig');
const TournamentRegistration = require('../database/models/TournamentRegistration');
const { staffLog } = require('../utils/staffLog');
const { updateRegistrationBoard } = require('../utils/registrationManager');

module.exports = (client) => {

  // ─── Commande !inscription ───────────────────────────────────────────────
  client.on('messageCreate', async (message) => {
    if (!message.guild) return;
    if (!message.content.startsWith('!inscription')) return;
    if (message.author.bot) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ Commande réservée au staff.');

    const args = message.content.split(' ').slice(1);
    const sub = args[0]?.toLowerCase();

    // ── !inscription aide ──
    if (!sub || sub === 'aide') {
      const embed = new EmbedBuilder()
        .setTitle('📋 Système d\'inscriptions tournoi')
        .setColor(0xF1C40F)
        .setDescription('Gérez les inscriptions à votre tournoi.')
        .addFields(
          { name: '`!inscription ouvrir <nom tournoi>`', value: 'Ouvrir les inscriptions pour un tournoi' },
          { name: '`!inscription fermer`', value: 'Fermer les inscriptions' },
          { name: '`!inscription salon <#channel>`', value: 'Définir le salon d\'inscriptions' },
          { name: '`!inscription annonces <#channel>`', value: 'Définir le salon d\'annonces des inscrits' },
          { name: '`!inscription max <nombre>`', value: 'Définir le nombre max d\'équipes (0 = illimité)' },
          { name: '`!inscription liste`', value: 'Voir toutes les inscriptions' },
          { name: '`!inscription valider <@user ou nom équipe>`', value: 'Valider manuellement une inscription' },
          { name: '`!inscription refuser <@user ou nom équipe> [raison]`', value: 'Refuser une inscription' },
          { name: '`!inscription réinitialiser`', value: 'Réinitialiser toutes les inscriptions du tournoi' },
        )
        .setFooter({ text: 'Les équipes s\'inscrivent avec !inscrire' });
      return message.channel.send({ embeds: [embed] });
    }

    let config = await TournRegConfig.findOne({ guildId: message.guild.id });
    if (!config) config = await TournRegConfig.create({ guildId: message.guild.id });

    // ── !inscription salon <#channel> ──
    if (sub === 'salon') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!inscription salon <#channel>`');
      config.registrationChannelId = channel.id;
      await config.save();
      return message.reply(`✅ Salon d'inscriptions défini sur ${channel}`);
    }

    // ── !inscription annonces <#channel> ──
    if (sub === 'annonces') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!inscription annonces <#channel>`');
      config.announcementChannelId = channel.id;
      await config.save();
      return message.reply(`✅ Salon d'annonces défini sur ${channel}`);
    }

    // ── !inscription max <n> ──
    if (sub === 'max') {
      const n = parseInt(args[1]);
      if (isNaN(n) || n < 0) return message.reply('Usage : `!inscription max <nombre>` (0 = illimité)');
      config.maxTeams = n;
      await config.save();
      return message.reply(`✅ Maximum d'équipes : **${n === 0 ? 'illimité' : n}**`);
    }

    // ── !inscription ouvrir <nom> ──
    if (sub === 'ouvrir') {
      const name = args.slice(1).join(' ');
      if (!name) return message.reply('Usage : `!inscription ouvrir <nom du tournoi>`');
      if (!config.registrationChannelId) return message.reply('❌ Définis d\'abord un salon avec `!inscription salon <#channel>`');

      config.isOpen = true;
      config.tournamentName = name;
      config.boardMessageId = null;
      await config.save();

      // Poster l'annonce dans le salon d'inscriptions
      const regChannel = message.guild.channels.cache.get(config.registrationChannelId);
      if (regChannel) {
        const announceEmbed = new EmbedBuilder()
          .setTitle(`🏆 Inscriptions ouvertes — ${name}`)
          .setColor(0x57F287)
          .setDescription([
            '> Les inscriptions sont désormais **ouvertes** !',
            '',
            '**Comment s\'inscrire ?**',
            '```',
            '!inscrire <Nom de l\'équipe> | <Joueur1, Joueur2, ...>',
            '```',
            '**Exemple :**',
            '```',
            '!inscrire Team Alpha | PlayerOne, PlayerTwo, PlayerThree',
            '```',
            '',
            '📌 Votre inscription sera examinée par le staff.',
          ].join('\n'))
          .addFields(
            config.maxTeams > 0 ? { name: '🎯 Places disponibles', value: `${config.maxTeams} équipes max`, inline: true } : { name: '🎯 Places', value: 'Illimité', inline: true },
            { name: '📅 Ouvert le', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
          )
          .setFooter({ text: 'Système de tournois SUPREMYX' })
          .setTimestamp();

        const msg = await regChannel.send({ embeds: [announceEmbed] });
        config.announcementMessageId = msg.id;
        await config.save();
        await updateRegistrationBoard(client, message.guild.id);
      }

      await staffLog(client, {
        action: 'inscription',
        details: `**Inscriptions ouvertes** pour le tournoi : **${name}**`,
        author: message.author.tag
      });

      return message.reply(`✅ Inscriptions ouvertes pour **${name}** dans ${regChannel || 'le salon configuré'} !`);
    }

    // ── !inscription fermer ──
    if (sub === 'fermer') {
      if (!config.isOpen) return message.reply('⚠️ Les inscriptions sont déjà fermées.');
      config.isOpen = false;
      await config.save();

      const regChannel = message.guild.channels.cache.get(config.registrationChannelId);
      if (regChannel) {
        const closeEmbed = new EmbedBuilder()
          .setTitle(`🔒 Inscriptions fermées — ${config.tournamentName}`)
          .setColor(0xED4245)
          .setDescription('Les inscriptions sont désormais **fermées**. Bonne chance à toutes les équipes !')
          .setTimestamp();
        regChannel.send({ embeds: [closeEmbed] });
      }

      await updateRegistrationBoard(client, message.guild.id);
      await staffLog(client, {
        action: 'inscription',
        details: `**Inscriptions fermées** pour le tournoi : **${config.tournamentName}**`,
        author: message.author.tag
      });

      return message.reply(`🔒 Inscriptions fermées pour **${config.tournamentName}**.`);
    }

    // ── !inscription liste ──
    if (sub === 'liste') {
      if (!config.tournamentName) return message.reply('❌ Aucun tournoi configuré.');
      const regs = await TournamentRegistration.find({ guildId: message.guild.id, tournamentName: config.tournamentName }).sort({ registeredAt: 1 });
      if (!regs.length) return message.reply('📭 Aucune inscription pour ce tournoi.');

      const pending = regs.filter(r => r.status === 'pending');
      const accepted = regs.filter(r => r.status === 'accepted');
      const refused = regs.filter(r => r.status === 'refused');

      const fmt = (list) => list.length
        ? list.map((r, i) => `${i + 1}. **${r.teamName}** — <@${r.contactId}>`).join('\n')
        : '*Aucune*';

      const embed = new EmbedBuilder()
        .setTitle(`📋 Inscriptions — ${config.tournamentName}`)
        .setColor(0x5865F2)
        .addFields(
          { name: `✅ Acceptées (${accepted.length})`, value: fmt(accepted) },
          { name: `⏳ En attente (${pending.length})`, value: fmt(pending) },
          { name: `❌ Refusées (${refused.length})`, value: fmt(refused) },
        )
        .setFooter({ text: `Total : ${regs.length} inscription(s)` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // ── !inscription valider <nom> ──
    if (sub === 'valider') {
      const search = args.slice(1).join(' ');
      if (!search) return message.reply('Usage : `!inscription valider <nom équipe>`');

      const reg = await TournamentRegistration.findOne({
        guildId: message.guild.id,
        tournamentName: config.tournamentName,
        teamName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        status: 'pending'
      });
      if (!reg) return message.reply(`❌ Aucune inscription en attente trouvée pour **${search}**.`);

      reg.status = 'accepted';
      reg.reviewedBy = message.author.tag;
      reg.reviewedAt = new Date();
      await reg.save();

      await notifyTeam(client, reg, 'accepted');
      await updateRegistrationBoard(client, message.guild.id);
      await postToAnnouncementChannel(client, message.guild.id, reg, config);

      await staffLog(client, {
        action: 'inscription',
        details: `**Inscription validée** : **${reg.teamName}** pour **${config.tournamentName}**`,
        author: message.author.tag
      });

      return message.reply(`✅ Inscription de **${reg.teamName}** validée !`);
    }

    // ── !inscription refuser <nom> [raison] ──
    if (sub === 'refuser') {
      const parts = args.slice(1).join(' ').split('|');
      const search = parts[0]?.trim();
      const reason = parts[1]?.trim() || 'Aucune raison fournie';
      if (!search) return message.reply('Usage : `!inscription refuser <nom équipe> | <raison>`');

      const reg = await TournamentRegistration.findOne({
        guildId: message.guild.id,
        tournamentName: config.tournamentName,
        teamName: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        status: 'pending'
      });
      if (!reg) return message.reply(`❌ Aucune inscription en attente trouvée pour **${search}**.`);

      reg.status = 'refused';
      reg.refuseReason = reason;
      reg.reviewedBy = message.author.tag;
      reg.reviewedAt = new Date();
      await reg.save();

      await notifyTeam(client, reg, 'refused', reason);
      await updateRegistrationBoard(client, message.guild.id);

      await staffLog(client, {
        action: 'inscription',
        details: `**Inscription refusée** : **${reg.teamName}** — Raison : ${reason}`,
        author: message.author.tag
      });

      return message.reply(`❌ Inscription de **${reg.teamName}** refusée.`);
    }

    // ── !inscription réinitialiser ──
    if (sub === 'réinitialiser' || sub === 'reinitialiser') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('reset_confirm').setLabel('Confirmer').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('reset_cancel').setLabel('Annuler').setStyle(ButtonStyle.Secondary)
      );
      const confirm = await message.reply({ content: '⚠️ Supprimer **toutes** les inscriptions de ce tournoi ?', components: [row] });
      const col = confirm.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });
      col.on('collect', async (i) => {
        if (i.user.id !== message.author.id) return i.reply({ content: 'Pas pour toi.', ephemeral: true });
        if (i.customId === 'reset_confirm') {
          await TournamentRegistration.deleteMany({ guildId: message.guild.id, tournamentName: config.tournamentName });
          config.boardMessageId = null;
          await config.save();
          await updateRegistrationBoard(client, message.guild.id);
          await i.update({ content: '✅ Inscriptions réinitialisées.', components: [] });
        } else {
          await i.update({ content: '❌ Annulé.', components: [] });
        }
        col.stop();
      });
      return;
    }

    message.reply('❓ Sous-commande inconnue. Tape `!inscription aide` pour l\'aide.');
  });

  // ─── Boutons valider/refuser depuis les embeds d'inscriptions ────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    const { customId } = interaction;

    if (customId.startsWith('reg_accept_') || customId.startsWith('reg_refuse_')) {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });
      }

      const regId = customId.replace('reg_accept_', '').replace('reg_refuse_', '');
      const isAccept = customId.startsWith('reg_accept_');

      const reg = await TournamentRegistration.findById(regId);
      if (!reg) return interaction.reply({ content: '❌ Inscription introuvable.', ephemeral: true });
      const STATUS_FR = { pending: 'en attente', accepted: 'acceptée', refused: 'refusée' };
      if (reg.status !== 'pending') return interaction.reply({ content: `⚠️ Déjà traitée (${STATUS_FR[reg.status] ?? reg.status}).`, ephemeral: true });

      const config = await TournRegConfig.findOne({ guildId: interaction.guild.id });

      if (isAccept) {
        reg.status = 'accepted';
        reg.reviewedBy = interaction.user.tag;
        reg.reviewedAt = new Date();
        await reg.save();

        await notifyTeam(client, reg, 'accepted');
        await updateRegistrationBoard(client, interaction.guild.id);
        await postToAnnouncementChannel(client, interaction.guild.id, reg, config);

        const updated = new EmbedBuilder()
          .setTitle(`✅ Inscription validée — ${reg.teamName}`)
          .setColor(0x57F287)
          .addFields(
            { name: '👥 Joueurs', value: reg.players.join(', ') || '*Non renseigné*' },
            { name: '📞 Contact', value: `<@${reg.contactId}>` },
            { name: '✅ Validé par', value: interaction.user.tag },
            { name: '🕐 À', value: `<t:${Math.floor(Date.now() / 1000)}:f>` }
          )
          .setTimestamp();

        await interaction.update({ embeds: [updated], components: [] });

        await staffLog(client, {
          action: 'inscription',
          details: `**Inscription validée** : **${reg.teamName}** par **${interaction.user.tag}**`,
          author: interaction.user.tag
        });

      } else {
        // Demander la raison via modal-like reply
        await interaction.reply({ content: `Tape la raison du refus (ou \`aucune\`) dans les 30s :`, ephemeral: true });

        const filter = m => m.author.id === interaction.user.id && m.channel.id === interaction.channel.id;
        const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 }).catch(() => null);
        const reason = collected?.first()?.content || 'Aucune raison fournie';
        collected?.first()?.delete().catch(() => {});

        reg.status = 'refused';
        reg.refuseReason = reason;
        reg.reviewedBy = interaction.user.tag;
        reg.reviewedAt = new Date();
        await reg.save();

        await notifyTeam(client, reg, 'refused', reason);
        await updateRegistrationBoard(client, interaction.guild.id);

        const updated = new EmbedBuilder()
          .setTitle(`❌ Inscription refusée — ${reg.teamName}`)
          .setColor(0xED4245)
          .addFields(
            { name: '👥 Joueurs', value: reg.players.join(', ') || '*Non renseigné*' },
            { name: '📞 Contact', value: `<@${reg.contactId}>` },
            { name: '❌ Refusé par', value: interaction.user.tag },
            { name: '📝 Raison', value: reason }
          )
          .setTimestamp();

        await interaction.message.edit({ embeds: [updated], components: [] });
        await staffLog(client, {
          action: 'inscription',
          details: `**Inscription refusée** : **${reg.teamName}** — Raison : ${reason}`,
          author: interaction.user.tag
        });
      }
    }
  });
};

// ─── Helper : notifier l'équipe par DM ───────────────────────────────────
async function notifyTeam(client, reg, status, reason = null) {
  try {
    const user = await client.users.fetch(reg.contactId);
    const embed = new EmbedBuilder()
      .setTimestamp();

    if (status === 'accepted') {
      embed
        .setTitle('✅ Inscription acceptée !')
        .setColor(0x57F287)
        .setDescription(`Votre équipe **${reg.teamName}** a été **acceptée** pour le tournoi **${reg.tournamentName}** !`)
        .addFields({ name: '👥 Joueurs inscrits', value: reg.players.join(', ') || '*Non renseigné*' });
    } else {
      embed
        .setTitle('❌ Inscription refusée')
        .setColor(0xED4245)
        .setDescription(`Votre équipe **${reg.teamName}** n'a **pas été acceptée** pour le tournoi **${reg.tournamentName}**.`)
        .addFields({ name: '📝 Raison', value: reason || 'Aucune raison fournie' });
    }

    await user.send({ embeds: [embed] });
  } catch {
    // DM désactivés, on ignore
  }
}

// ─── Helper : poster dans le salon annonces ───────────────────────────────
async function postToAnnouncementChannel(client, guildId, reg, config) {
  if (!config?.announcementChannelId) return;
  try {
    const channel = await client.channels.fetch(config.announcementChannelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(`🎉 Nouvelle équipe inscrite — ${reg.teamName}`)
      .setColor(0x57F287)
      .addFields(
        { name: '👥 Joueurs', value: reg.players.join(', ') || '*Non renseigné*', inline: false },
        { name: '📞 Contact', value: `<@${reg.contactId}>`, inline: true },
        { name: '🏆 Tournoi', value: reg.tournamentName, inline: true }
      )
      .setFooter({ text: 'Système de tournois SUPREMYX' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch {
    // Salon inaccessible
  }
}
