const Ticket = require('../database/models/Ticket');
const TicketConfig = require('../database/models/TicketConfig');
const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

const CATEGORIES = {
  support: { label: '🛠️ Support', color: 0x5865F2, desc: 'Problème technique ou question générale' },
  signalement: { label: '🚨 Signalement', color: 0xED4245, desc: 'Signaler un joueur ou un comportement' },
  candidature: { label: '📋 Candidature', color: 0x57F287, desc: 'Postuler pour rejoindre le staff' }
};

const STATUS_LABELS = {
  ouvert: '🟢 Ouvert',
  en_cours: '🟡 En cours',
  résolu: '✅ Résolu',
  fermé: '🔴 Fermé'
};

async function getConfig(guildId) {
  let cfg = await TicketConfig.findOne({ guildId });
  if (!cfg) cfg = await TicketConfig.create({ guildId });
  return cfg;
}

async function buildPermissionOverwrites(guild, userId, cfg) {
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    }
  ];

  // Staff role if configured
  if (cfg.staffRoleId) {
    overwrites.push({
      id: cfg.staffRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
      ]
    });
  } else {
    // Fall back to admin role
    const adminRole = guild.roles.cache.find(r =>
      r.permissions.has(PermissionFlagsBits.Administrator) && r.id !== guild.id
    );
    if (adminRole) {
      overwrites.push({
        id: adminRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      });
    }
  }

  return overwrites;
}

async function saveTranscript(client, ticket, channel, cfg, closedBy) {
  if (!cfg.transcriptChannelId) return;
  const transcriptChannel = client.channels.cache.get(cfg.transcriptChannelId);
  if (!transcriptChannel) return;

  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();
    const lines = sorted.map(m => {
      const time = new Date(m.createdTimestamp).toLocaleString('fr-FR');
      return `[${time}] ${m.author.tag}: ${m.content || '[embed/fichier]'}`;
    });

    const catInfo = CATEGORIES[ticket.category];
    const embed = new EmbedBuilder()
      .setTitle(`📄 Transcript — ${catInfo.label}`)
      .setColor(catInfo.color)
      .addFields(
        { name: '👤 Auteur', value: `${ticket.userTag} (<@${ticket.userId}>)`, inline: true },
        { name: '🏷️ Catégorie', value: catInfo.label, inline: true },
        { name: '📌 Statut final', value: STATUS_LABELS[ticket.status] || ticket.status, inline: true },
        { name: '🔒 Fermé par', value: closedBy, inline: true },
        { name: '📅 Ouvert le', value: new Date(ticket.createdAt).toLocaleString('fr-FR'), inline: true },
        { name: '💬 Messages', value: `${lines.length}`, inline: true }
      )
      .setTimestamp();

    const transcriptText = lines.join('\n').slice(0, 3900);
    if (transcriptText) {
      embed.addFields({ name: '📝 Historique', value: `\`\`\`\n${transcriptText}\n\`\`\`` });
    }

    await transcriptChannel.send({ embeds: [embed] });
  } catch {}
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    const isStaff = message.member?.permissions.has('Administrator');

    // =========================================================
    // !ticketconfig
    // =========================================================
    if (cmd === '!ticketconfig') {
      if (!isStaff) return message.reply('Staff uniquement');
      const sub = args[1]?.toLowerCase();
      const cfg = await getConfig(message.guild.id);

      if (!sub) {
        const embed = new EmbedBuilder()
          .setTitle('🎫 Configuration des tickets')
          .setColor(0x5865F2)
          .addFields(
            { name: '🏷️ Rôle staff', value: cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : '*Non configuré*', inline: true },
            { name: '📄 Salon transcripts', value: cfg.transcriptChannelId ? `<#${cfg.transcriptChannelId}>` : '*Non configuré*', inline: true },
            { name: '📁 Catégorie Discord', value: cfg.ticketCategoryId || '*Non configurée*', inline: true }
          )
          .setDescription(
            '**Commandes de configuration :**\n' +
            '`!ticketconfig staffrole @role` — Rôle qui voit tous les tickets\n' +
            '`!ticketconfig transcript #salon` — Salon pour les transcripts\n' +
            '`!ticketconfig category <id>` — Catégorie Discord pour les salons ticket'
          )
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (sub === 'staffrole') {
        const role = message.mentions.roles.first();
        if (!role) return message.reply('Usage : `!ticketconfig staffrole @role`');
        cfg.staffRoleId = role.id;
        await cfg.save();
        logStaffAction(client, `🎫 **Ticket staffrole** → @${role.name} | Par : ${message.author.tag}`);
        return message.reply(`✅ Rôle staff tickets : **@${role.name}**`);
      }

      if (sub === 'transcript') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('Usage : `!ticketconfig transcript #salon`');
        cfg.transcriptChannelId = channel.id;
        await cfg.save();
        logStaffAction(client, `🎫 **Ticket transcript** → <#${channel.id}> | Par : ${message.author.tag}`);
        return message.reply(`✅ Transcripts dans <#${channel.id}>`);
      }

      if (sub === 'category') {
        const categoryId = args[2];
        if (!categoryId) return message.reply('Usage : `!ticketconfig category <id>` — Copie l\'ID de la catégorie Discord (mode développeur)');
        const category = message.guild.channels.cache.get(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory)
          return message.reply('❌ Catégorie introuvable. Vérifie l\'ID (catégorie Discord, pas un salon).');
        cfg.ticketCategoryId = categoryId;
        await cfg.save();
        logStaffAction(client, `🎫 **Ticket catégorie** configurée | Par : ${message.author.tag}`);
        return message.reply(`✅ Les tickets seront créés dans la catégorie **${category.name}**.`);
      }

      return message.reply('Sous-commandes : `staffrole`, `transcript`, `category`');
    }

    // =========================================================
    // !ticket panel
    // =========================================================
    if (cmd === '!ticket' && args[1]?.toLowerCase() === 'panel') {
      if (!isStaff) return message.reply('Staff uniquement');

      const embed = new EmbedBuilder()
        .setTitle('🎫 Ouvrir un ticket')
        .setColor(0x5865F2)
        .setDescription(
          'Sélectionne le type de ticket en tapant la commande correspondante :\n\n' +
          '🛠️ `!ticket support` — Question ou problème technique\n' +
          '🚨 `!ticket signalement` — Signaler un joueur ou comportement\n' +
          '📋 `!ticket candidature` — Postuler pour le staff\n\n' +
          '*Le staff te répondra dès que possible.*'
        )
        .setFooter({ text: 'Un seul ticket ouvert à la fois par membre' })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });
      try { await message.delete(); } catch {}
      return;
    }

    // =========================================================
    // !ticket [support|signalement|candidature] [sujet...]
    // =========================================================
    if (cmd === '!ticket' && args[1]?.toLowerCase() !== 'panel') {
      const rawCat = args[1]?.toLowerCase();
      const category = CATEGORIES[rawCat] ? rawCat : 'support';
      const subject = (rawCat && !CATEGORIES[rawCat] ? args.slice(1) : args.slice(2)).join(' ').trim();
      const catInfo = CATEGORIES[category];

      // One open ticket at a time
      const existing = await Ticket.findOne({ userId: message.author.id, closed: false });
      if (existing) return message.reply(`Tu as déjà un ticket ouvert : <#${existing.channelId}>\nFerme-le d'abord avec \`!close\`.`);

      const cfg = await getConfig(message.guild.id);
      const safeName = message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'membre';
      const channelName = `${category}-${safeName}`;

      const overwrites = await buildPermissionOverwrites(message.guild, message.author.id, cfg);
      const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites
      };
      if (cfg.ticketCategoryId) channelOptions.parent = cfg.ticketCategoryId;

      const channel = await message.guild.channels.create(channelOptions).catch(() => null);
      if (!channel) return message.reply('❌ Impossible de créer le salon ticket (permissions manquantes).');

      const ticket = await Ticket.create({
        channelId: channel.id,
        userId: message.author.id,
        userTag: message.author.tag,
        subject,
        category,
        status: 'ouvert'
      });

      const embed = new EmbedBuilder()
        .setTitle(`${catInfo.label} — Ticket #${ticket._id.toString().slice(-5).toUpperCase()}`)
        .setColor(catInfo.color)
        .setDescription(
          `Bonjour ${message.author} ! Bienvenue dans ton ticket **${catInfo.label}**.\n\n` +
          `📝 *${catInfo.desc}*\n\n` +
          (subject ? `**Sujet :** ${subject}\n\n` : '') +
          'Décris ton problème en détail, le staff arrivera dès que possible.\n\n' +
          '**Commandes disponibles ici :**\n' +
          '`!close` — Fermer ce ticket\n' +
          '`!resolve` — Marquer comme résolu *(staff)*\n' +
          '`!claim` — Prendre en charge *(staff)*\n' +
          '`!adduser @user` — Ajouter un membre *(staff)*'
        )
        .addFields({ name: '📌 Statut', value: STATUS_LABELS.ouvert, inline: true })
        .setFooter({ text: `Ouvert par ${message.author.tag}` })
        .setTimestamp();

      await channel.send({ content: cfg.staffRoleId ? `<@&${cfg.staffRoleId}>` : '', embeds: [embed] });
      await message.reply(`✅ Ton ticket a été créé : ${channel}`);
      logStaffAction(client, `🎫 **Ticket ouvert** [${category}] par \`${message.author.tag}\`${subject ? ` — "${subject}"` : ''} → <#${channel.id}>`);
      return;
    }

    // =========================================================
    // !tickets — list open tickets (staff)
    // =========================================================
    if (cmd === '!tickets') {
      if (!isStaff) return message.reply('Staff uniquement');

      const open = await Ticket.find({ closed: false }).sort({ createdAt: -1 });
      if (!open.length) return message.reply('✅ Aucun ticket ouvert en ce moment.');

      const embed = new EmbedBuilder()
        .setTitle(`🎫 Tickets ouverts — ${open.length}`)
        .setColor(0x5865F2)
        .setTimestamp();

      for (const t of open.slice(0, 15)) {
        const catInfo = CATEGORIES[t.category];
        const since = `<t:${Math.floor(new Date(t.createdAt).getTime() / 1000)}:R>`;
        embed.addFields({
          name: `${catInfo.label} — ${t.userTag}`,
          value: `<#${t.channelId}> • ${STATUS_LABELS[t.status]} • Ouvert ${since}${t.claimedByTag ? ` • 👤 ${t.claimedByTag}` : ''}`
        });
      }

      if (open.length > 15) embed.setFooter({ text: `Affichage de 15 sur ${open.length}` });
      return message.channel.send({ embeds: [embed] });
    }

    // =========================================================
    // !claim — claim the current ticket (staff, inside ticket channel)
    // =========================================================
    if (cmd === '!claim') {
      if (!isStaff) return message.reply('Staff uniquement');
      const ticket = await Ticket.findOne({ channelId: message.channel.id, closed: false });
      if (!ticket) return;

      ticket.claimedBy = message.author.id;
      ticket.claimedByTag = message.author.tag;
      ticket.status = 'en_cours';
      await ticket.save();

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setDescription(`🟡 Ce ticket a été pris en charge par **${message.author}**.`)
        .setTimestamp();

      logStaffAction(client, `🎫 **Ticket claim** — \`${ticket.userTag}\` → par \`${message.author.tag}\``);
      return message.channel.send({ embeds: [embed] });
    }

    // =========================================================
    // !resolve — mark ticket as resolved (staff)
    // =========================================================
    if (cmd === '!resolve') {
      if (!isStaff) return message.reply('Staff uniquement');
      const ticket = await Ticket.findOne({ channelId: message.channel.id, closed: false });
      if (!ticket) return;

      ticket.status = 'résolu';
      await ticket.save();

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`✅ Ce ticket a été marqué comme **résolu** par **${message.author}**.\nTape \`!close\` pour le fermer définitivement.`)
        .setTimestamp();

      logStaffAction(client, `🎫 **Ticket résolu** — \`${ticket.userTag}\` | Par : ${message.author.tag}`);
      return message.channel.send({ embeds: [embed] });
    }

    // =========================================================
    // !adduser @user — add a member to the current ticket (staff)
    // =========================================================
    if (cmd === '!adduser') {
      if (!isStaff) return message.reply('Staff uniquement');
      const ticket = await Ticket.findOne({ channelId: message.channel.id, closed: false });
      if (!ticket) return;

      const target = message.mentions.members.first();
      if (!target) return message.reply('Usage : `!adduser @user`');

      await message.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      });

      logStaffAction(client, `🎫 **Ticket adduser** — ${target.user.tag} ajouté | Par : ${message.author.tag}`);
      return message.reply(`✅ **${target.user.username}** a été ajouté au ticket.`);
    }

    // =========================================================
    // !close — close current ticket
    // =========================================================
    if (cmd === '!close') {
      const ticket = await Ticket.findOne({ channelId: message.channel.id, closed: false });
      if (!ticket) return;

      const isTicketOwner = ticket.userId === message.author.id;
      if (!isStaff && !isTicketOwner) return message.reply('Seul le staff ou l\'auteur du ticket peut le fermer.');

      const cfg = await getConfig(message.guild.id);
      ticket.closed = true;
      ticket.status = 'fermé';
      await ticket.save();

      // Save transcript
      await saveTranscript(client, ticket, message.channel, cfg, message.author.tag);

      const catInfo = CATEGORIES[ticket.category];
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('🔒 Ticket fermé')
            .setDescription(
              `Ce ticket a été fermé par **${message.author}**.\n` +
              (cfg.transcriptChannelId ? `📄 Transcript sauvegardé dans <#${cfg.transcriptChannelId}>.` : '') +
              '\n\nCe salon sera supprimé dans **10 secondes**.'
            )
            .addFields(
              { name: '🏷️ Catégorie', value: catInfo.label, inline: true },
              { name: '👤 Auteur', value: ticket.userTag, inline: true },
              { name: '📌 Statut', value: STATUS_LABELS[ticket.status], inline: true }
            )
            .setTimestamp()
        ]
      });

      logStaffAction(client, `🔒 **Ticket fermé** [${ticket.category}] — \`${ticket.userTag}\` | Par : ${message.author.tag}`);
      setTimeout(() => message.channel.delete().catch(() => {}), 10000);
    }
  });
};
