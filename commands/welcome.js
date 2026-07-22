const WelcomeConfig = require('../database/models/WelcomeConfig');
const AutoroleConfig = require('../database/models/AutoroleConfig');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');
const { generateWelcomeCard } = require('../utils/welcomeCard');

function applyTemplate(template, member) {
  return template
    .replace(/{user}/g, `${member}`)
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString());
}

const HEX_COLOR = /^#?[0-9a-fA-F]{6}$/;

async function sendWelcomeCard(channel, member, config) {
  const text = applyTemplate(config.message, member);
  const title = applyTemplate(config.cardTitle || 'WELCOME', member);
  const subtitle = applyTemplate(config.cardSubtitle || 'HELLO AND WELCOME TO {server}', member);

  const buffer = await generateWelcomeCard({
    member,
    title,
    subtitle,
    color: config.cardColor,
    accentColor: config.cardAccentColor,
  });
  const attachment = new AttachmentBuilder(buffer, { name: 'welcome.png' });

  await channel.send({ content: text, files: [attachment] });
}

module.exports = (client) => {
  // --- Message de bienvenue à l'arrivée d'un membre ---
  client.on('guildMemberAdd', async member => {
    try {
      const config = await WelcomeConfig.findOne({ guildId: member.guild.id });
      if (config && config.enabled && config.channelId) {
        const channel = member.guild.channels.cache.get(config.channelId);
        if (channel) {
          await sendWelcomeCard(channel, member, config).catch(async (err) => {
            console.error('[welcome] Erreur génération affiche :', err);
            // Fallback texte simple si la génération d'image échoue
            const text = applyTemplate(config.message, member);
            const embed = new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(text)
              .setThumbnail(member.user.displayAvatarURL())
              .setFooter({ text: `${member.guild.name} • ${member.guild.memberCount} membres` })
              .setTimestamp();
            await channel.send({ embeds: [embed] });
          });
        }
      }

      // Auto-role
      const autorole = await AutoroleConfig.findOne({ guildId: member.guild.id });
      if (autorole && autorole.enabled && autorole.roleId) {
        const role = member.guild.roles.cache.get(autorole.roleId);
        if (role) await member.roles.add(role).catch(() => {});
      }
    } catch {
      // Silent fail
    }
  });

  // --- Commandes !bienvenue ---
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!bienvenue')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;
    if (!message.member.permissions.has('Administrator')) return message.reply('Staff uniquement');

    const args = content.split(/\s+/).filter(Boolean);
    const sub = args[1]?.toLowerCase().normalize('NFC');

    // --- !bienvenue definir <message> ---
    if (sub === 'definir') {
      const text = content.slice('!bienvenue definir'.length).trim();
      if (!text) return message.reply(
        'Usage : `!bienvenue definir <message>`\n' +
        'Variables : `{user}` `{username}` `{server}` `{count}`\n' +
        'Ex : `!bienvenue definir Bienvenue {user} sur {server} ! Tu es notre {count}e membre.`'
      );
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: { message: text, enabled: true } },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome message** mis à jour | Par : ${message.author.tag}`);
      return message.reply(`✅ Message de bienvenue mis à jour.`);
    }

    // --- !bienvenue salon #salon ---
    if (sub === 'salon') {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply('Usage : `!bienvenue salon #salon`');
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: { channelId: channel.id, enabled: true } },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome channel** → <#${channel.id}> | Par : ${message.author.tag}`);
      return message.reply(`✅ Les messages de bienvenue iront dans <#${channel.id}>.`);
    }

    // --- !bienvenue tester ---
    if (sub === 'tester') {
      const config = await WelcomeConfig.findOne({ guildId: message.guild.id });
      if (!config || !config.channelId) return message.reply('❌ Configure d\'abord un salon avec `!bienvenue salon #salon`.');
      const channel = message.guild.channels.cache.get(config.channelId);
      if (!channel) return message.reply('❌ Salon introuvable.');
      try {
        await sendWelcomeCard(channel, message.member, config);
        return message.reply(`✅ Affiche de bienvenue test envoyée dans <#${channel.id}>.`);
      } catch (err) {
        console.error('[welcome] Erreur génération affiche test :', err);
        return message.reply('❌ Impossible de générer l\'affiche de bienvenue.');
      }
    }

    // --- !bienvenue titre <texte> ---
    if (sub === 'titre') {
      const text = content.slice('!bienvenue titre'.length).trim();
      if (!text) return message.reply('Usage : `!bienvenue titre <texte>` (ex : `!bienvenue titre WELCOME`)');
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: { cardTitle: text } },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome card titre** → "${text}" | Par : ${message.author.tag}`);
      return message.reply(`✅ Titre de l'affiche mis à jour : **${text}**`);
    }

    // --- !bienvenue soustitre <texte> ---
    if (sub === 'soustitre') {
      const text = content.slice('!bienvenue soustitre'.length).trim();
      if (!text) return message.reply(
        'Usage : `!bienvenue soustitre <texte>`\n' +
        'Variables : `{user}` `{username}` `{server}` `{count}`\n' +
        'Ex : `!bienvenue soustitre HELLO AND WELCOME TO {server}`'
      );
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: { cardSubtitle: text } },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome card sous-titre** mis à jour | Par : ${message.author.tag}`);
      return message.reply(`✅ Sous-titre de l'affiche mis à jour.`);
    }

    // --- !bienvenue couleur <hex> [accentHex] ---
    if (sub === 'couleur') {
      const [, , mainHex, accentHex] = args;
      if (!mainHex || !HEX_COLOR.test(mainHex)) {
        return message.reply('Usage : `!bienvenue couleur #RRGGBB [#accentRRGGBB]` (ex : `!bienvenue couleur #5B2A86 #F5C518`)');
      }
      if (accentHex && !HEX_COLOR.test(accentHex)) {
        return message.reply('❌ Couleur d\'accent invalide. Format attendu : `#RRGGBB`');
      }
      const update = { cardColor: mainHex.startsWith('#') ? mainHex : `#${mainHex}` };
      if (accentHex) update.cardAccentColor = accentHex.startsWith('#') ? accentHex : `#${accentHex}`;
      await WelcomeConfig.findOneAndUpdate(
        { guildId: message.guild.id },
        { $set: update },
        { upsert: true, new: true }
      );
      logStaffAction(client, `👋 **Welcome card couleurs** mises à jour | Par : ${message.author.tag}`);
      return message.reply('✅ Couleurs de l\'affiche mises à jour. Utilise `!bienvenue tester` pour voir le résultat.');
    }

    // --- !bienvenue desactiver ---
    if (sub === 'desactiver') {
      await WelcomeConfig.findOneAndUpdate({ guildId: message.guild.id }, { enabled: false }, { upsert: true });
      logStaffAction(client, `👋 **Welcome désactivé** | Par : ${message.author.tag}`);
      return message.reply('⛔ Messages de bienvenue désactivés.');
    }

    // --- !bienvenue activer ---
    if (sub === 'activer') {
      await WelcomeConfig.findOneAndUpdate({ guildId: message.guild.id }, { enabled: true }, { upsert: true });
      logStaffAction(client, `👋 **Welcome activé** | Par : ${message.author.tag}`);
      return message.reply('✅ Messages de bienvenue activés.');
    }

    // --- !bienvenue (sans sous-commande) → statut ---
    const config = await WelcomeConfig.findOne({ guildId: message.guild.id });
    const embed = new EmbedBuilder()
      .setTitle('👋 Configuration des messages de bienvenue')
      .setColor(config?.enabled ? 0x57F287 : 0xED4245)
      .addFields(
        { name: '🔘 Statut',  value: config?.enabled ? '✅ Activé' : '⛔ Désactivé',                   inline: true },
        { name: '📍 Salon',   value: config?.channelId ? `<#${config.channelId}>` : 'Non configuré',    inline: true },
        { name: '💬 Message', value: config?.message || 'Défaut' },
        { name: '🎨 Affiche', value: `Titre : **${config?.cardTitle || 'WELCOME'}**\nCouleur : \`${config?.cardColor || '#5B2A86'}\` / \`${config?.cardAccentColor || '#F5C518'}\`` }
      )
      .setFooter({ text: 'Sous-commandes : definir · salon · tester · titre · soustitre · couleur · activer · desactiver' })
      .setTimestamp();
    return message.channel.send({ embeds: [embed] });
  });
};
