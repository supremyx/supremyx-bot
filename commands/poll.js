const { EmbedBuilder } = require('discord.js');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = (client) => {
  client.on('messageCreate', async message => {
    if (!message.content.startsWith('!vote')) return;
    if (!message.guild) return;
    if (message.author.bot) return;
    if (!message.member) return;

    if (!message.member.permissions.has('Administrator'))
      return message.reply('Staff uniquement');

    const content = message.content.slice('!vote'.length).trim();

    if (!content) {
      return message.reply(
        '**Usage :**\n' +
        '`!vote <question> | <option1> | <option2> | ...`\n\n' +
        '**Exemples :**\n' +
        '`!vote Qui va gagner ? | TeamA | TeamB | TeamC`\n' +
        '`!vote Match ce soir ? | Oui | Non`'
      );
    }

    const parts = content.split('|').map(p => p.trim()).filter(Boolean);

    if (parts.length < 2) {
      return message.reply('❌ Il faut au moins une question et une option.\nFormat : `!vote Question | Option1 | Option2`');
    }

    const question = parts[0];
    const options = parts.slice(1);

    if (options.length > 10) {
      return message.reply('❌ Maximum 10 options par sondage.');
    }

    const optionsText = options
      .map((opt, i) => `${NUMBER_EMOJIS[i]} ${opt}`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${question}`)
      .setDescription(optionsText)
      .setColor(0x5865F2)
      .setFooter({ text: `Sondage lancé par ${message.author.tag} • Votez avec les réactions` })
      .setTimestamp();

    // Delete the command message to keep the channel clean
    message.delete().catch(() => {});

    const pollMsg = await message.channel.send({ embeds: [embed] });

    for (let i = 0; i < options.length; i++) {
      await pollMsg.react(NUMBER_EMOJIS[i]);
    }
  });
};
