const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const InscriptionConfig = require('../database/models/InscriptionConfig');
const Registration      = require('../database/models/Registration');
const { staffLog }      = require('../utils/staffLog');
const { escapeRegex }   = require('../utils/lib');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStaff(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function fmtUpdated(date) {
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
  const d = new Date(date);
  return `${d.getUTCDate()} ${mois[d.getUTCMonth()]} ${d.getUTCFullYear()} à ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

// ─── Build & update waitlist embed ───────────────────────────────────────────

async function buildAndUpdateEmbed(client, config) {
  const regs = await Registration.find({
    guildId: config.guildId,
    status:  { $ne: 'rejected' },
  }).sort({ position: 1 });

  const total    = regs.length;
  const pending  = regs.filter(r => r.status === 'pending').length;
  const vipCount = regs.filter(r => r.vip).length;
  const free     = Math.max(0, config.maxSlots - total);

  const lines = regs.map((r, i) => {
    const vipBadge  = r.vip ? ' ⭐' : '';
    const confBadge = r.status === 'confirmed' ? ' ✅' : '';
    return `**${i + 1}.** \`${r.tag}\` ${r.teamName} <@${r.captainId}>${vipBadge}${confBadge}`;
  });

  const bodyList = lines.length > 0
    ? lines.join('\n')
    : '*Aucune inscription pour le moment.*';

  const desc = [
    bodyList,
    '',
    `\`Places libres\` **${free}**`,
    `\`En attente de confirmation\` **${pending}**`,
    `\`Places VIP\` **${vipCount}**`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle(config.tournamentTitle || 'INSCRIPTIONS')
    .setColor(0xF1C40F)
    .setDescription(desc)
    .setFooter({ text: `Mis à jour le ${fmtUpdated(new Date())}` });

  const channel = client.channels.cache.get(config.waitlistChannelId);
  if (!channel) return null;

  if (config.waitlistMessageId) {
    try {
      const msg = await channel.messages.fetch(config.waitlistMessageId);
      await msg.edit({ embeds: [embed] });
      return msg;
    } catch { /* message deleted — create fresh */ }
  }

  const sent = await channel.send({ embeds: [embed] });
  await InscriptionConfig.findByIdAndUpdate(config._id, { waitlistMessageId: sent.id });
  return sent;
}

// ─── Re-order positions after removal ────────────────────────────────────────

async function renumber(guildId) {
  const regs = await Registration.find({ guildId, status: { $ne: 'rejected' } }).sort({ position: 1 });
  for (let i = 0; i < regs.length; i++) {
    await Registration.findByIdAndUpdate(regs[i]._id, { position: i + 1 });
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

module.exports = (client) => {

  // ════════════════════════════════════════════════════════════════════════════
  //  LISTENER : %inscrire dans le salon d'inscription
  // ════════════════════════════════════════════════════════════════════════════
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild)     return;

    const content = message.content.trim();
    if (!content.toLowerCase().startsWith('%inscrire')) return;

    const config = await InscriptionConfig.findOne({ guildId: message.guild.id, active: true });
    if (!config || !config.registrationChannelId) return;
    if (message.channel.id !== config.registrationChannelId) return;

    // ── Parse les 4 lignes ──────────────────────────────────────────────────
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 4) {
      return message.reply([
        '❌ **Format invalide.** Utilise exactement **4 lignes** :',
        '```',
        '%inscrire',
        'NOM DE L\'ÉQUIPE',
        'TAG',
        '@capitaine',
        '```',
      ].join('\n')).then(m => setTimeout(() => m.delete().catch(() => {}), 12000));
    }

    const teamName   = lines[1];
    const tag        = lines[2];
    const captionRaw = lines[3];

    // ── Extraire le captainId depuis la mention ──────────────────────────────
    const captainIdMatch = captionRaw.match(/<@!?(\d+)>/);
    const captainId      = captainIdMatch ? captainIdMatch[1] : null;

    if (!captainId) {
      return message.reply('❌ Le capitaine doit être une **mention Discord valide**. Ex : `@SilverHulk`')
        .then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
    }

    let captain;
    try   { captain = await message.guild.members.fetch(captainId); }
    catch { return message.reply('❌ Capitaine introuvable sur ce serveur.').then(m => setTimeout(() => m.delete().catch(() => {}), 10000)); }

    // ── Vérifier doublons ────────────────────────────────────────────────────
    const tagEsc   = escapeRegex(tag);
    const existing = await Registration.findOne({
      guildId: message.guild.id,
      status:  { $ne: 'rejected' },
      $or: [
        { tag:       { $regex: new RegExp(`^${tagEsc}$`, 'i') } },
        { captainId },
      ],
    });

    if (existing) {
      const why = existing.captainId === captainId
        ? 'Ce capitaine est déjà inscrit'
        : `Le tag \`${existing.tag}\` est déjà pris`;
      return message.reply(`❌ **${why}.**`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
    }

    // ── Vérifier les places disponibles ──────────────────────────────────────
    const count = await Registration.countDocuments({ guildId: message.guild.id, status: { $ne: 'rejected' } });
    if (count >= config.maxSlots) {
      return message.reply(`❌ **Plus de places disponibles.** Liste complète (${config.maxSlots}/${config.maxSlots}).`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 10000));
    }

    // ── Enregistrer ──────────────────────────────────────────────────────────
    await Registration.create({
      guildId:      message.guild.id,
      teamName,
      tag,
      captainId,
      captainTag:   captain.user.tag,
      position:     count + 1,
      status:       'pending',
      registeredBy: message.author.id,
      messageId:    message.id,
    });

    // ── Assigner le rôle au capitaine ─────────────────────────────────────────
    if (config.roleId) {
      try   { await captain.roles.add(config.roleId); }
      catch (err) { console.error('[waitlist] Erreur rôle:', err.message); }
    }

    // ── Mettre à jour l'embed waitlist ────────────────────────────────────────
    try   { await buildAndUpdateEmbed(client, config); }
    catch (err) { console.error('[waitlist] Erreur embed:', err.message); }

    // ── Réaction ✅ sur le message de l'utilisateur ───────────────────────────
    try { await message.react('✅'); } catch {}

    // ── Log staff ────────────────────────────────────────────────────────────
    await staffLog(client, {
      action:  'inscription %inscrire',
      details: `**Équipe :** ${teamName} (\`${tag}\`)\n**Capitaine :** <@${captainId}>\n**Position :** ${count + 1}/${config.maxSlots}`,
      author:  message.author.tag,
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  COMMANDES STAFF : !listedattente
  // ════════════════════════════════════════════════════════════════════════════
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild)     return;
    if (!message.member)    return;
    if (!message.content.startsWith('!listedattente')) return;
    if (!isStaff(message.member)) return message.reply('❌ Permissions insuffisantes (Gérer le serveur).');

    const full = message.content.slice('!listedattente'.length).trim();
    const sub  = full.split(/\s+/)[0]?.toLowerCase() || '';
    const rest = full.replace(/^\S+\s*/, '').trim();

    try {

      // ── !listedattente configurer #reg | #listedattente | @rôle | places | Titre ──────
      if (sub === 'configurer' || sub === 'config') {
        const fields = rest.split('|').map(f => f.trim());
        if (fields.length < 2) return message.reply([
          '**Usage :** `!listedattente configurer #salon-inscriptions | #salon-listedattente | @rôle | max_places | Titre`',
          '',
          '**Exemple :**',
          '`!listedattente configurer #es・inscription | #es・listedattente | @Participant | 16 | PUBG MOBILE AFRICA — ELITE SCRIMS (LISTE D\'ATTENTE)`',
          '',
          '`@rôle`, `max_places` et le titre sont **optionnels**.',
        ].join('\n'));

        const chMentions = [...message.mentions.channels.values()];
        const regCh      = chMentions[0]  || message.guild.channels.cache.get(fields[0].replace(/\D/g, ''));
        const waitCh     = chMentions[1]  || message.guild.channels.cache.get(fields[1].replace(/\D/g, ''));
        const roleId     = message.mentions.roles.first()?.id || fields[2]?.replace(/\D/g, '') || '';
        const maxSlots   = parseInt(fields[3]) || 16;
        const cleanTitle = fields.slice(4).join(' | ').trim() || 'INSCRIPTIONS';

        if (!regCh)  return message.reply('❌ Salon d\'inscription introuvable. Mentionne-le avec `#`.');
        if (!waitCh) return message.reply('❌ Salon liste d\'attente introuvable. Mentionne-le avec `#`.');

        await InscriptionConfig.findOneAndUpdate(
          { guildId: message.guild.id },
          {
            guildId:               message.guild.id,
            registrationChannelId: regCh.id,
            waitlistChannelId:     waitCh.id,
            waitlistMessageId:     '',
            roleId,
            maxSlots,
            tournamentTitle:       cleanTitle,
            active:                true,
          },
          { upsert: true, new: true },
        );

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Système `%inscrire` configuré')
          .addFields(
            { name: '📝 Salon inscriptions', value: `<#${regCh.id}>`,                          inline: true },
            { name: '📋 Salon waitlist',     value: `<#${waitCh.id}>`,                         inline: true },
            { name: '🎭 Rôle assigné',       value: roleId ? `<@&${roleId}>` : '*(aucun)*',  inline: true },
            { name: '🔢 Places max',         value: String(maxSlots),                          inline: true },
            { name: '🏆 Titre',             value: cleanTitle,                                inline: false },
          )
          .setFooter({ text: `Lance !listedattente initialiser pour publier l'embed. Les équipes utilisent %inscrire dans #${regCh.name}.` });

        await message.reply({ embeds: [embed] });
        await staffLog(client, {
          action:  'waitlist setup',
          details: `Reg: <#${regCh.id}> | Waitlist: <#${waitCh.id}> | Slots: ${maxSlots} | Titre: ${cleanTitle}`,
          author:  message.author.tag,
        });
        return;
      }

      // ── !listedattente initialiser ────────────────────────────────────────────
      if (sub === 'initialiser' || sub === 'init') {
        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Configure d\'abord : `!listedattente configurer #reg | #listedattente | @rôle | places | Titre`');
        await InscriptionConfig.findByIdAndUpdate(config._id, { waitlistMessageId: '' });
        config.waitlistMessageId = '';
        const msg = await buildAndUpdateEmbed(client, config);
        if (!msg) return message.reply('❌ Salon waitlist introuvable ou permissions manquantes.');
        return message.reply(`✅ Embed waitlist publié dans <#${config.waitlistChannelId}>.`);
      }

      // ── !listedattente liste ──────────────────────────────────────────────────
      if (sub === 'liste') {
        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Système non configuré.');
        const regs = await Registration.find({ guildId: message.guild.id, status: { $ne: 'rejected' } }).sort({ position: 1 });
        if (!regs.length) return message.reply('📭 Aucune inscription pour le moment.');

        const lines = regs.map(r => {
          const icon = r.status === 'confirmed' ? '✅' : r.vip ? '⭐' : '⏳';
          return `${icon} **${r.position}.** \`${r.tag}\` ${r.teamName} — <@${r.captainId}>`;
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`📋 Inscriptions — ${config.tournamentTitle}`)
          .setDescription(lines.join('\n'))
          .setFooter({ text: `${regs.length}/${config.maxSlots} • ✅ confirmé • ⏳ en attente • ⭐ VIP` })
          .setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      // ── !listedattente confirmer <TAG> ───────────────────────────────────
      if (sub === 'confirmer') {
        if (!rest) return message.reply('**Usage :** `!listedattente confirmer <TAG>`');

        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Système non configuré.');

        const reg = await Registration.findOne({
          guildId: message.guild.id,
          tag:     { $regex: new RegExp(`^${escapeRegex(rest)}$`, 'i') },
          status:  'pending',
        });
        if (!reg) return message.reply(`❌ Équipe \`${rest}\` introuvable ou déjà confirmée.`);

        await Registration.findByIdAndUpdate(reg._id, { status: 'confirmed' });
        await buildAndUpdateEmbed(client, config);
        await message.reply(`✅ **${reg.teamName}** (\`${reg.tag}\`) **confirmée** !`);

        try {
          const captain = await message.guild.members.fetch(reg.captainId);
          await captain.send(`✅ Votre équipe **${reg.teamName}** a été **confirmée** pour **${config.tournamentTitle}** !`);
        } catch {}

        await staffLog(client, {
          action:  'waitlist confirmer',
          details: `**Équipe :** ${reg.teamName} (\`${reg.tag}\`) — <@${reg.captainId}>`,
          author:  message.author.tag,
        });
        return;
      }

      // ── !listedattente retirer <TAG> ─────────────────────────────────────
      if (sub === 'retirer') {
        if (!rest) return message.reply('**Usage :** `!listedattente retirer <TAG>`');
        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Système non configuré.');

        const reg = await Registration.findOne({
          guildId: message.guild.id,
          tag:     { $regex: new RegExp(`^${escapeRegex(rest)}$`, 'i') },
          status:  { $ne: 'rejected' },
        });
        if (!reg) return message.reply(`❌ Équipe \`${rest}\` introuvable.`);

        if (config.roleId) {
          try {
            const member = await message.guild.members.fetch(reg.captainId);
            await member.roles.remove(config.roleId);
          } catch {}
        }

        await Registration.findByIdAndUpdate(reg._id, { status: 'rejected' });
        await renumber(message.guild.id);
        await buildAndUpdateEmbed(client, config);
        await message.reply(`✅ **${reg.teamName}** (\`${reg.tag}\`) retirée de la liste.`);

        await staffLog(client, {
          action:  'waitlist retirer',
          details: `**Équipe :** ${reg.teamName} (\`${reg.tag}\`) — <@${reg.captainId}>`,
          author:  message.author.tag,
        });
        return;
      }

      // ── !listedattente vip <TAG> ─────────────────────────────────────────
      if (sub === 'vip') {
        if (!rest) return message.reply('**Usage :** `!listedattente vip <TAG>`');
        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Système non configuré.');

        const reg = await Registration.findOne({
          guildId: message.guild.id,
          tag:     { $regex: new RegExp(`^${escapeRegex(rest)}$`, 'i') },
          status:  { $ne: 'rejected' },
        });
        if (!reg) return message.reply(`❌ Équipe \`${rest}\` introuvable.`);

        const newVip = !reg.vip;
        await Registration.findByIdAndUpdate(reg._id, { vip: newVip });
        await buildAndUpdateEmbed(client, config);
        return message.reply(`${newVip ? '⭐ VIP activé' : '🔹 VIP retiré'} pour **${reg.teamName}** (\`${reg.tag}\`).`);
      }

      // ── !listedattente places <n> ────────────────────────────────────────
      if (sub === 'places' || sub === 'slots') {
        const n = parseInt(rest);
        if (isNaN(n) || n < 1) return message.reply('**Usage :** `!listedattente places <nombre>` (ex: `!listedattente places 16`)');
        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Système non configuré.');
        await InscriptionConfig.findByIdAndUpdate(config._id, { maxSlots: n });
        config.maxSlots = n;
        await buildAndUpdateEmbed(client, config);
        return message.reply(`✅ Nombre de places mis à jour : **${n}**.`);
      }

      // ── !listedattente reinitialiser ─────────────────────────────────────
      if (sub === 'réinitialiser' || sub === 'reinitialiser') {
        const confirm = await message.reply('⚠️ Effacer **toutes les inscriptions** ? Réagis ✅ pour confirmer (15s).');
        try { await confirm.react('✅'); } catch {}

        const filter = (r, u) => r.emoji.name === '✅' && u.id === message.author.id;
        let collected;
        try   { collected = await confirm.awaitReactions({ filter, max: 1, time: 15000, errors: ['time'] }); }
        catch { return confirm.edit('❌ Reset annulé (timeout).'); }

        if (!collected.size) return confirm.edit('❌ Reset annulé.');

        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        await Registration.deleteMany({ guildId: message.guild.id });
        if (config) {
          await InscriptionConfig.findByIdAndUpdate(config._id, { waitlistMessageId: '' });
          config.waitlistMessageId = '';
          await buildAndUpdateEmbed(client, config);
        }

        await confirm.edit('✅ Toutes les inscriptions ont été effacées et l\'embed réinitialisé.');
        await staffLog(client, {
          action:  'waitlist reset',
          details: 'Toutes les inscriptions supprimées.',
          author:  message.author.tag,
        });
        return;
      }

      // ── !listedattente info ───────────────────────────────────────────────
      if (sub === 'infos') {
        const config = await InscriptionConfig.findOne({ guildId: message.guild.id });
        if (!config) return message.reply('❌ Système non configuré. Lance : `!listedattente configurer #reg | #listedattente | @rôle | places | Titre`');

        const count = await Registration.countDocuments({ guildId: message.guild.id, status: { $ne: 'rejected' } });
        const embed = new EmbedBuilder()
          .setColor(0xd4963a)
          .setTitle('⚙️ Configuration Waitlist')
          .addFields(
            { name: '📝 Salon inscriptions', value: config.registrationChannelId ? `<#${config.registrationChannelId}>` : '*(non défini)*', inline: true },
            { name: '📋 Salon waitlist',     value: config.waitlistChannelId     ? `<#${config.waitlistChannelId}>`     : '*(non défini)*', inline: true },
            { name: '🎭 Rôle assigné',       value: config.roleId                ? `<@&${config.roleId}>`               : '*(aucun)*',      inline: true },
            { name: '🔢 Places',             value: `${count} / ${config.maxSlots}`,                                                        inline: true },
            { name: '🏆 Titre',             value: config.tournamentTitle,                                                                  inline: false },
          )
          .setFooter({ text: 'Commandes : configurer · initialiser · liste · confirmer · retirer · vip · places · réinitialiser · infos' });
        return message.reply({ embeds: [embed] });
      }

      // ── Aide ──────────────────────────────────────────────────────────────
      return message.reply([
        '**Commandes `!listedattente` :**',
        '',
        '`!listedattente configurer #reg | #listedattente | @rôle | places | Titre` — configurer le système',
        '`!listedattente initialiser` — publier/rafraîchir l\'embed liste d\'attente',
        '`!listedattente liste` — voir toutes les inscriptions',
        '`!listedattente confirmer <TAG>` — confirmer une équipe',
        '`!listedattente retirer <TAG>` — retirer une équipe',
        '`!listedattente vip <TAG>` — activer/désactiver le statut VIP ⭐',
        '`!listedattente places <n>` — changer le nombre de places',
        '`!listedattente réinitialiser` — effacer toutes les inscriptions',
        '`!listedattente infos` — voir la configuration actuelle',
        '',
        '> Les équipes s\'inscrivent avec `%inscrire` dans le salon configuré.',
      ].join('\n'));

    } catch (err) {
      console.error('[waitlist]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
