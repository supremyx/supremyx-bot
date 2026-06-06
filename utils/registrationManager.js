const { EmbedBuilder } = require('discord.js');
const TournRegConfig = require('../database/models/TournRegConfig');
const TournamentRegistration = require('../database/models/TournamentRegistration');

/**
 * Met à jour (ou crée) le tableau des inscriptions dans le salon des inscriptions.
 */
async function updateRegistrationBoard(client, guildId) {
  try {
    const config = await TournRegConfig.findOne({ guildId });
    if (!config || !config.registrationChannelId || !config.tournamentName) return;

    const channel = await client.channels.fetch(config.registrationChannelId).catch(() => null);
    if (!channel) return;

    const regs = await TournamentRegistration.find({
      guildId,
      tournamentName: config.tournamentName
    }).sort({ registeredAt: 1 });

    const accepted = regs.filter(r => r.status === 'accepted');
    const pending = regs.filter(r => r.status === 'pending');

    const statusIcon = (s) => s === 'accepted' ? '✅' : s === 'refused' ? '❌' : '⏳';

    const formatList = (list, showContact = false) => {
      if (!list.length) return '*Aucune équipe*';
      return list.map((r, i) =>
        `**${i + 1}.** ${r.teamName}${showContact ? ` — <@${r.contactId}>` : ''}`
      ).join('\n');
    };

    const maxDisplay = config.maxTeams > 0
      ? `${accepted.length} / ${config.maxTeams}`
      : `${accepted.length}`;

    const embed = new EmbedBuilder()
      .setTitle(`📋 Inscriptions — ${config.tournamentName}`)
      .setColor(config.isOpen ? 0x57F287 : 0xED4245)
      .setDescription(config.isOpen
        ? '🟢 **Inscriptions ouvertes** — Utilise `!inscrire <équipe> | <joueurs>` pour participer !'
        : '🔴 **Inscriptions fermées**'
      )
      .addFields(
        {
          name: `✅ Équipes acceptées (${maxDisplay})`,
          value: formatList(accepted),
          inline: false
        },
        pending.length > 0 ? {
          name: `⏳ En attente (${pending.length})`,
          value: formatList(pending),
          inline: false
        } : {
          name: '⏳ En attente',
          value: '*Aucune*',
          inline: false
        }
      )
      .setFooter({ text: `Dernière mise à jour` })
      .setTimestamp();

    // Tenter de modifier le message existant, sinon en créer un nouveau
    if (config.boardMessageId) {
      try {
        const existing = await channel.messages.fetch(config.boardMessageId);
        await existing.edit({ embeds: [embed] });
        return;
      } catch {
        // Message supprimé, on en crée un nouveau
      }
    }

    const msg = await channel.send({ embeds: [embed] });
    config.boardMessageId = msg.id;
    await config.save();

  } catch (err) {
    console.error('[registrationManager] Erreur updateRegistrationBoard:', err.message);
  }
}

module.exports = { updateRegistrationBoard };
