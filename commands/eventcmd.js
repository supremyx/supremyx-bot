const GuildEvent = require('../database/models/GuildEvent');
const { EmbedBuilder } = require('discord.js');
const { logStaffAction } = require('../utils/staffLog');

async function nextEventNumber(guildId) {
  const last = await GuildEvent.findOne({ guildId }).sort({ eventNumber: -1 });
  return last ? last.eventNumber + 1 : 1;
}

function buildEventEmbed(ev, guild) {
  const embed = new EmbedBuilder()
    .setTitle(`📅 Événement #${ev.eventNumber} — ${ev.title}`)
    .setColor(ev.cancelled ? 0x808080 : 0x5865F2)
    .setTimestamp();

  if (ev.description) embed.setDescription(ev.description);
  embed.addFields(
    { name: '📆 Date', value: ev.date || 'À définir', inline: true },
    { name: '✅ Inscrits', value: `${ev.joined.length}`, inline: true },
    { name: '❌ Déclinés', value: `${ev.declined.length}`, inline: true }
  );

  if (ev.cancelled) embed.addFields({ name: '🚫 Statut', value: '**Annulé**' });
  embed.setFooter({ text: `React ✅ pour participer • ❌ pour décliner • ID : ${ev.eventNumber}` });
  return embed;
}

module.exports = (client) => {
  // RSVP reaction listener
  async function handleReaction(reaction, user, added) {
    if (user.bot) return;
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch { return; }

    const ev = await GuildEvent.findOne({ messageId: reaction.message.id });
    if (!ev || ev.cancelled) return;

    const emoji = reaction.emoji.name;
    if (emoji !== '✅' && emoji !== '❌') return;

    // Use atomic MongoDB operators to avoid race conditions
    const pull = { joined: user.id, declined: user.id };
    const push = added
      ? (emoji === '✅' ? { joined: user.id } : { declined: user.id })
      : {};

    await GuildEvent.updateOne(
      { _id: ev._id },
      { $pull: pull, ...(Object.keys(push).length ? {} : {}) }
    );
    if (added) {
      await GuildEvent.updateOne({ _id: ev._id }, { $addToSet: push });
    }

    // Reload for embed update
    const updated = await GuildEvent.findById(ev._id);
    if (!updated) return;

    // Update embed
    const guild = reaction.message.guild;
    const embed = buildEventEmbed(updated, guild);
    await reaction.message.edit({ embeds: [embed] }).catch(() => {});
  }

  client.on('messageReactionAdd', (r, u) => handleReaction(r, u, true));
  client.on('messageReactionRemove', (r, u) => handleReaction(r, u, false));

  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!event')) return;
    if (!message.guild) return;

    const isStaff = message.member.permissions.has('Administrator');
    const args = content.split(' ');
    const sub = args[1]?.toLowerCase();

    // --- !event creer <titre> | <description> | <date> ---
    if (sub === 'creer' || sub === 'nouveau') {
      if (!isStaff) return message.reply('Staff uniquement');
      const rest = content.slice(args[0].length + args[1].length + 2).trim();
      const parts = rest.split('|').map(p => p.trim());
      const title = parts[0];
      const description = parts[1] || '';
      const date = parts[2] || '';

      if (!title) return message.reply('Usage : `!event creer <titre> | [description] | [date]`\nEx : `!event creer Scrim vendredi | Scrim custom interne | 10/05 20h00`');

      const num = await nextEventNumber(message.guild.id);
      const ev = await GuildEvent.create({
        guildId: message.guild.id,
        eventNumber: num,
        title, description, date,
        channelId: message.channel.id,
        createdBy: message.author.tag
      });

      const embed = buildEventEmbed(ev, message.guild);
      const sent = await message.channel.send({ embeds: [embed] });
      await sent.react('✅').catch(() => {});
      await sent.react('❌').catch(() => {});

      ev.messageId = sent.id;
      await ev.save();

      logStaffAction(client, `📅 **Événement créé** : #${num} — ${title} | Par : ${message.author.tag}`);
      return message.reply(`✅ Événement **#${num}** créé.`);
    }

    // --- !event liste ---
    if (!sub || sub === 'liste') {
      const events = await GuildEvent.find({ guildId: message.guild.id, cancelled: false }).sort({ eventNumber: -1 }).limit(10);
      if (!events.length) return message.reply('Aucun événement actif. Crée-en un avec `!event creer`.');
      const embed = new EmbedBuilder()
        .setTitle('📅 Événements à venir')
        .setColor(0x5865F2)
        .setTimestamp();
      for (const ev of events) {
        embed.addFields({ name: `#${ev.eventNumber} — ${ev.title}`, value: `📆 ${ev.date || 'Date non définie'} • ✅ ${ev.joined.length} • ❌ ${ev.declined.length}` });
      }
      return message.channel.send({ embeds: [embed] });
    }

    // --- !event annuler <id> ---
    if (sub === 'annuler') {
      if (!isStaff) return message.reply('Staff uniquement');
      const num = parseInt(args[2]);
      if (isNaN(num)) return message.reply('Usage : `!event annuler <id>`');
      const ev = await GuildEvent.findOne({ guildId: message.guild.id, eventNumber: num });
      if (!ev) return message.reply('❌ Événement introuvable.');
      ev.cancelled = true;
      await ev.save();
      // Update embed
      const chan = message.guild.channels.cache.get(ev.channelId);
      if (chan && ev.messageId) {
        const msg = await chan.messages.fetch(ev.messageId).catch(() => null);
        if (msg) await msg.edit({ embeds: [buildEventEmbed(ev, message.guild)] }).catch(() => {});
      }
      logStaffAction(client, `📅 **Événement annulé** : #${num} — ${ev.title} | Par : ${message.author.tag}`);
      return message.reply(`✅ Événement **#${num}** annulé.`);
    }

    // --- !event participants <id> ---
    if (sub === 'participants' || sub === 'inscrits') {
      const num = parseInt(args[2]);
      if (isNaN(num)) return message.reply('Usage : `!event participants <id>`');
      const ev = await GuildEvent.findOne({ guildId: message.guild.id, eventNumber: num });
      if (!ev) return message.reply('❌ Événement introuvable.');
      const joinedMentions = ev.joined.map(id => `<@${id}>`).join(', ') || '*Personne*';
      const declinedMentions = ev.declined.map(id => `<@${id}>`).join(', ') || '*Personne*';
      const embed = new EmbedBuilder()
        .setTitle(`📅 Participants — #${ev.eventNumber} ${ev.title}`)
        .setColor(0x5865F2)
        .addFields(
          { name: `✅ Inscrits (${ev.joined.length})`, value: joinedMentions },
          { name: `❌ Déclinés (${ev.declined.length})`, value: declinedMentions }
        ).setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    message.reply(
      '**Commandes `!event` :**\n' +
      '`!event creer <titre> | [desc] | [date]` — Créer un événement *(staff)*\n' +
      '`!event liste` — Voir les événements en cours\n' +
      '`!event participants <id>` — Voir qui participe\n' +
      '`!event annuler <id>` — Annuler un événement *(staff)*'
    );
  });
};
