const { EmbedBuilder } = require('discord.js');
const Sondage    = require('../database/models/Sondage');
const SondageProg = require('../database/models/SondageProg');

const NUMBER_EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];

let _started = false;

async function launchSondageProg(client, prog) {
  try {
    const channel = client.channels.cache.get(prog.channelId);
    if (!channel) return;

    const endTime = new Date(Date.now() + prog.durationMs);
    const { parseDuration, formatDuration } = require('./parseDuration');

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${prog.question}`)
      .setColor(0x5865F2)
      .setDescription(prog.options.map((o, i) => `${NUMBER_EMOJIS[i]} **${o}**`).join('\n'))
      .addFields({ name: '⏳ Durée', value: formatDuration(prog.durationMs), inline: true })
      .setFooter({ text: `Sondage programmé par ${prog.createdBy} • Résultats à` })
      .setTimestamp(endTime);

    const sent = await channel.send({ embeds: [embed] });
    for (let i = 0; i < prog.options.length; i++) {
      await sent.react(NUMBER_EMOJIS[i]).catch(() => {});
    }

    const sondage = await Sondage.create({
      guildId:   prog.guildId,
      channelId: prog.channelId,
      messageId: sent.id,
      question:  prog.question,
      options:   prog.options,
      endTime,
      createdBy: prog.createdBy
    });

    prog.launched   = true;
    prog.messageId  = sent.id;
    await prog.save();

    const { closeSondage } = require('./sondageManager');
    setTimeout(() => closeSondage(client, sondage), prog.durationMs);
  } catch (err) {
    console.error('[SondageProg] Erreur lancement:', err.message);
  }
}

async function startSondageProgManager(client) {
  if (_started) return;
  _started = true;

  const tick = async () => {
    try {
      const now = new Date();
      const pending = await SondageProg.find({ launched: false, scheduledAt: { $lte: now } });
      for (const prog of pending) {
        await launchSondageProg(client, prog);
      }
    } catch {}
  };

  tick();
  setInterval(tick, 60_000);
  console.log('📅 Sondage programmé manager actif');
}

module.exports = { startSondageProgManager };
