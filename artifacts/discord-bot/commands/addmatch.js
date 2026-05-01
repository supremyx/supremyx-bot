// Commande !addmatch - Ajoute un résultat de match
// TODO: Remplace ce fichier par ton propre code

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!addmatch')) return;

    // Placeholder - remplace par ton code
    message.reply('Commande addmatch en attente de configuration.');
  });
};
