// Commande !register - Enregistre un joueur
// TODO: Remplace ce fichier par ton propre code

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!register')) return;

    // Placeholder - remplace par ton code
    message.reply('Commande register en attente de configuration.');
  });
};
