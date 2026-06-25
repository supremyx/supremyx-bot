const { EmbedBuilder } = require('discord.js');
const RapportHebdoConfig = require('../database/models/RapportHebdoConfig');
const { sendRapportHebdo, buildRapportEmbed } = require('../utils/rapportHebdo');
const { logStaffAction } = require('../utils/staffLog');

module.exports = (client) => {
  client.on('messageCreate', async message => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;
      if (!message.content.startsWith('!rapporthebdo')) return;
      if (!message.member.permissions.has('Administrator'))
        return message.reply('⛔ Staff uniquement.');

      const content = message.content.trim();
      const args    = content.slice('!rapporthebdo'.length).trim().split(/\s+/);
      const sub     = args[0]?.toLowerCase();
      const guildId = message.guild.id;

      let cfg = await RapportHebdoConfig.findOne({ guildId });

      // ── !rapporthebdo salon #salon ────────────────────────────────────────
      if (sub === 'salon') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Mentionne un salon. Ex : `!rapporthebdo salon #annonces`');

        cfg = await RapportHebdoConfig.findOneAndUpdate(
          { guildId },
          { channelId: channel.id },
          { upsert: true, new: true }
        );

        await logStaffAction(client, `📊 **Rapport hebdo** salon configuré → <#${channel.id}> | Par : ${message.author.tag}`);
        return message.reply(`✅ Les rapports hebdomadaires seront envoyés dans <#${channel.id}>.\nActive-les avec \`!rapporthebdo activer\`.`);
      }

      // ── !rapporthebdo activer ─────────────────────────────────────────────
      if (sub === 'activer') {
        if (!cfg?.channelId) return message.reply('❌ Configure d\'abord un salon : `!rapporthebdo salon #salon`');
        await RapportHebdoConfig.findOneAndUpdate({ guildId }, { active: true }, { upsert: true });
        await logStaffAction(client, `📊 **Rapport hebdo** activé | Par : ${message.author.tag}`);
        return message.reply('✅ Rapport hebdomadaire **activé** — envoi automatique chaque dimanche à 20h00.');
      }

      // ── !rapporthebdo desactiver ──────────────────────────────────────────
      if (sub === 'desactiver') {
        await RapportHebdoConfig.findOneAndUpdate({ guildId }, { active: false }, { upsert: true });
        await logStaffAction(client, `📊 **Rapport hebdo** désactivé | Par : ${message.author.tag}`);
        return message.reply('⏸️ Rapport hebdomadaire **désactivé**.');
      }

      // ── !rapporthebdo tester ──────────────────────────────────────────────
      if (sub === 'tester') {
        const targetChannelId = cfg?.channelId || message.channel.id;
        const embed = await buildRapportEmbed(client, guildId);
        embed.setTitle('📊 [APERÇU] Rapport hebdomadaire SUPREMYX');
        embed.setDescription((embed.data.description || '') + '\n\n> ⚠️ Ceci est un envoi de test — pas le vrai rapport automatique.');
        await message.channel.send({ embeds: [embed] });
        return message.reply(`📤 Rapport de test envoyé dans <#${message.channel.id}>.`);
      }

      // ── !rapporthebdo statut ──────────────────────────────────────────────
      if (sub === 'statut' || !sub) {
        const embed = new EmbedBuilder()
          .setColor(cfg?.active ? 0x57F287 : 0xED4245)
          .setTitle('📊 Rapport Hebdomadaire — Configuration')
          .addFields(
            { name: '📡 Statut',        value: cfg?.active    ? '✅ Activé'          : '❌ Désactivé',    inline: true },
            { name: '📌 Salon',         value: cfg?.channelId ? `<#${cfg.channelId}>` : '_Non configuré_', inline: true },
            { name: '🕐 Dernier envoi', value: cfg?.lastSentAt
                ? `<t:${Math.floor(new Date(cfg.lastSentAt).getTime() / 1000)}:R>`
                : '_Jamais envoyé_',
              inline: true },
            { name: '⏰ Planification', value: 'Chaque **dimanche à 20h00**', inline: false },
          )
          .addFields({
            name: '📋 Commandes disponibles',
            value: [
              '`!rapporthebdo salon #salon` — Configurer le salon',
              '`!rapporthebdo activer` — Activer l\'envoi automatique',
              '`!rapporthebdo desactiver` — Désactiver',
              '`!rapporthebdo tester` — Envoyer un aperçu maintenant',
              '`!rapporthebdo statut` — Cette aide',
            ].join('\n'),
          })
          .setFooter({ text: 'SUPREMYX Esports · Rapport hebdo' })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

      return message.reply('❓ Sous-commande inconnue. Tape `!rapporthebdo statut` pour voir les options.');
    } catch (err) {
      console.error('[rapportHebdo cmd]', err);
      message.reply('❌ Une erreur est survenue.').catch(() => {});
    }
  });
};
