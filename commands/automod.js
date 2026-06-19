const BadWord = require('../database/models/BadWord');
const AutomodConfig = require('../database/models/AutomodConfig');
const { EmbedBuilder } = require('discord.js');
const { invalidateCache } = require('../utils/automod');
const { logStaffAction } = require('../utils/staffLog');

// Default French bad words list included on first setup
const DEFAULT_WORDS = [
  'connard', 'connasse', 'salope', 'pute', 'enculé', 'batard',
  'bâtard', 'merde', 'fdp', 'fils de pute', 'nique', 'niquer',
  'ta gueule', 'ferme ta gueule', 'con', 'conne', 'abruti',
  'idiot', 'imbécile', 'va te faire', 'ntm', 'tg', 'pd',
  'nazi', 'bite', 'couille', 'chier', 'emmerde', 'fourre'
];

async function getOrCreateConfig() {
  let config = await AutomodConfig.findOne();
  if (!config) config = await AutomodConfig.create({ enabled: true });
  return config;
}

module.exports = (client) => {
  client.on('messageCreate', async message => {
    const content = message.content.trim();
    if (!content.startsWith('!mot') && !content.startsWith('!automod')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    const sub = args[1]?.toLowerCase();

    // --- !automod on/off ---
    if (cmd === '!automod') {
      const config = await getOrCreateConfig();
      if (sub === 'activer') {
        config.enabled = true;
        await config.save();
        logStaffAction(client, `✅ **Automod activé** | Par : ${message.author.tag}`);
        return message.reply('✅ Détection de mots interdits **activée**.');
      }
      if (sub === 'désactiver' || sub === 'desactiver') {
        config.enabled = false;
        await config.save();
        logStaffAction(client, `⛔ **Automod désactivé** | Par : ${message.author.tag}`);
        return message.reply('⛔ Détection de mots interdits **désactivée**.');
      }
      // !automod statut — statut détaillé
      if (sub === 'statut') {
        const wordCount = await BadWord.countDocuments();
        const embed = new EmbedBuilder()
          .setColor(config.enabled ? 0x57F287 : 0xED4245)
          .setTitle('🛡️ Statut Automod')
          .addFields(
            { name: 'État', value: config.enabled ? '✅ **Activé**' : '⛔ **Désactivé**', inline: true },
            { name: 'Mots interdits', value: `**${wordCount}** entrée(s)`, inline: true },
            { name: 'Commandes', value: '`!automod activer` / `!automod désactiver`\n`!automod test <message>` — tester un message\n`!mots` — voir la liste', inline: false },
          )
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      // !automod test <message> — tester si un message serait filtré
      if (sub === 'test') {
        const testMsg = args.slice(2).join(' ').toLowerCase().trim();
        if (!testMsg) return message.reply('Usage : `!automod test <message à tester>`');

        const words = await BadWord.find().lean();
        const triggered = words.filter(w => testMsg.includes(w.word.toLowerCase()));

        if (triggered.length) {
          return message.reply(`🚫 Ce message **serait filtré** — ${triggered.length} mot(s) interdit(s) détecté(s) : ${triggered.map(w => `\`${w.word}\``).join(', ')}`);
        }
        return message.reply('✅ Ce message **ne serait pas filtré** — aucun mot interdit détecté.');
      }

      // Status simple
      return message.reply(`Automod est actuellement **${config.enabled ? 'activé ✅' : 'désactivé ⛔'}**.\nUtilise \`!automod activer\` ou \`!automod désactiver\`.\nStatut détaillé : \`!automod statut\``);
    }

    // --- !mots --- list all words
    if (cmd === '!mots') {
      const words = await BadWord.find().sort({ word: 1 });
      if (!words.length)
        return message.reply('Aucun mot interdit défini. Utilise `!mot ajouter <mot>` pour en ajouter.');

      const embed = new EmbedBuilder()
        .setTitle(`🚫 Mots interdits — ${words.length} entrée(s)`)
        .setColor(0xED4245)
        .setDescription(words.map(w => `\`${w.word}\``).join(', '))
        .setFooter({ text: 'Utilise !mot ajouter / !mot retirer pour gérer la liste' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !mot ajouter <mot> ---
    if (cmd === '!mot' && sub === 'ajouter') {
      const word = args.slice(2).join(' ').toLowerCase().trim();
      if (!word) return message.reply('Usage : `!mot ajouter <mot>`');

      const exists = await BadWord.findOne({ word });
      if (exists) return message.reply(`\`${word}\` est déjà dans la liste.`);

      await BadWord.create({ word, addedBy: message.author.tag });
      invalidateCache();

      logStaffAction(client, `➕ **Mot interdit ajouté** — \`${word}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ \`${word}\` ajouté à la liste des mots interdits.`);
    }

    // --- !mot retirer <mot> ---
    if (cmd === '!mot' && (sub === 'retirer' || sub === 'supprimer')) {
      const word = args.slice(2).join(' ').toLowerCase().trim();
      if (!word) return message.reply('Usage : `!mot retirer <mot>`');

      const deleted = await BadWord.findOneAndDelete({ word });
      if (!deleted) return message.reply(`❌ \`${word}\` n'est pas dans la liste.`);

      invalidateCache();
      logStaffAction(client, `🗑️ **Mot interdit supprimé** — \`${word}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ \`${word}\` retiré de la liste.`);
    }

    // --- !mot defaut — load default list ---
    if (cmd === '!mot' && sub === 'defaut') {
      let added = 0;
      for (const w of DEFAULT_WORDS) {
        const exists = await BadWord.findOne({ word: w });
        if (!exists) {
          await BadWord.create({ word: w, addedBy: message.author.tag });
          added++;
        }
      }
      invalidateCache();
      logStaffAction(client, `⚙️ **Liste par défaut chargée** — ${added} mot(s) ajouté(s) | Par : ${message.author.tag}`);
      return message.reply(`✅ **${added}** mot(s) ajouté(s) depuis la liste par défaut (${DEFAULT_WORDS.length} mots au total).`);
    }

    // --- !mot vider — wipe list ---
    if (cmd === '!mot' && sub === 'vider') {
      const filter = m => m.author.id === message.author.id && m.content === 'CONFIRMER';
      await message.reply('⚠️ Cela effacera **tous** les mots interdits. Réponds `CONFIRMER` dans les 20 secondes.');
      try {
        await message.channel.awaitMessages({ filter, max: 1, time: 20000, errors: ['time'] });
        const result = await BadWord.deleteMany({});
        invalidateCache();
        logStaffAction(client, `🗑️ **Liste mots interdits vidée** — ${result.deletedCount} supprimé(s) | Par : ${message.author.tag}`);
        return message.channel.send(`✅ **${result.deletedCount}** mot(s) supprimé(s).`);
      } catch {
        return message.channel.send('❌ Annulé.');
      }
    }

    message.reply(
      '**Commandes automod :**\n' +
      '`!automod` — Voir le statut\n' +
      '`!automod activer / désactiver` — Activer / désactiver\n' +
      '`!mots` — Voir la liste des mots interdits\n' +
      '`!mot ajouter <mot>` — Ajouter un mot\n' +
      '`!mot retirer <mot>` — Supprimer un mot\n' +
      '`!mot defaut` — Charger la liste par défaut\n' +
      '`!mot vider` — Vider toute la liste'
    );
  });
};
