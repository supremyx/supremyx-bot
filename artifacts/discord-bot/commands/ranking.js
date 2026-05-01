// Commande !ranking - Affiche le classement
// TODO: Remplace ce fichier par ton propre code

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!ranking')) return;

    // Placeholder - remplace par ton code
    message.reply('Commande ranking en attente de configuration.');
  });
};
