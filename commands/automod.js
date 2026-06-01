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
    if (!content.startsWith('!word') && !content.startsWith('!automod')) return;
    if (!message.guild) return;

    const isStaff = message.member.permissions.has('Administrator');
    if (!isStaff) return message.reply('Staff uniquement');

    const args = content.split(' ');
    const cmd = args[0].toLowerCase();
    const sub = args[1]?.toLowerCase();

    // --- !automod on/off ---
    if (cmd === '!automod') {
      const config = await getOrCreateConfig();
      if (sub === 'on') {
        config.enabled = true;
        await config.save();
        logStaffAction(client, `✅ **Automod activé** | Par : ${message.author.tag}`);
        return message.reply('✅ Détection de mots interdits **activée**.');
      }
      if (sub === 'off') {
        config.enabled = false;
        await config.save();
        logStaffAction(client, `⛔ **Automod désactivé** | Par : ${message.author.tag}`);
        return message.reply('⛔ Détection de mots interdits **désactivée**.');
      }
      // Status
      return message.reply(`Automod est actuellement **${config.enabled ? 'activé ✅' : 'désactivé ⛔'}**.\nUtilise \`!automod on\` ou \`!automod off\`.`);
    }

    // --- !words --- list all words
    if (cmd === '!words') {
      const words = await BadWord.find().sort({ word: 1 });
      if (!words.length)
        return message.reply('Aucun mot interdit défini. Utilise `!word add <mot>` pour en ajouter.');

      const embed = new EmbedBuilder()
        .setTitle(`🚫 Mots interdits — ${words.length} entrée(s)`)
        .setColor(0xED4245)
        .setDescription(words.map(w => `\`${w.word}\``).join(', '))
        .setFooter({ text: 'Utilise !word add / !word del pour gérer la liste' })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // --- !word add <mot> ---
    if (cmd === '!word' && sub === 'add') {
      const word = args.slice(2).join(' ').toLowerCase().trim();
      if (!word) return message.reply('Usage : `!word add <mot>`');

      const exists = await BadWord.findOne({ word });
      if (exists) return message.reply(`\`${word}\` est déjà dans la liste.`);

      await BadWord.create({ word, addedBy: message.author.tag });
      invalidateCache();

      logStaffAction(client, `➕ **Mot interdit ajouté** — \`${word}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ \`${word}\` ajouté à la liste des mots interdits.`);
    }

    // --- !word del <mot> ---
    if (cmd === '!word' && (sub === 'del' || sub === 'remove')) {
      const word = args.slice(2).join(' ').toLowerCase().trim();
      if (!word) return message.reply('Usage : `!word del <mot>`');

      const deleted = await BadWord.findOneAndDelete({ word });
      if (!deleted) return message.reply(`❌ \`${word}\` n'est pas dans la liste.`);

      invalidateCache();
      logStaffAction(client, `🗑️ **Mot interdit supprimé** — \`${word}\` | Par : ${message.author.tag}`);
      return message.reply(`✅ \`${word}\` retiré de la liste.`);
    }

    // --- !word setup — load default list ---
    if (cmd === '!word' && sub === 'setup') {
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

    // --- !word clear — wipe list ---
    if (cmd === '!word' && sub === 'clear') {
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
      '`!automod on / off` — Activer / désactiver\n' +
      '`!words` — Voir la liste des mots interdits\n' +
      '`!word add <mot>` — Ajouter un mot\n' +
      '`!word del <mot>` — Supprimer un mot\n' +
      '`!word setup` — Charger la liste par défaut\n' +
      '`!word clear` — Vider toute la liste'
    );
  });
};
