const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
const { setupErrorHandler } = require('./utils/errorHandler');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

client.setMaxListeners(25);
setupErrorHandler(client);

client.once('ready', () => {
  console.log(`🔥 MoSeTo connecté en tant que ${client.user.tag}`);
});

require('./commands/help')(client);
require('./commands/ping')(client);
require('./commands/announce')(client);
require('./commands/register')(client);
require('./commands/unregister')(client);
require('./commands/addmatch')(client);
require('./commands/ranking')(client);
require('./commands/stats')(client);
require('./commands/search')(client);
require('./commands/compare')(client);
require('./commands/history')(client);
require('./commands/top')(client);
require('./commands/matchs')(client);
require('./commands/mvp')(client);
require('./commands/newtournoi')(client);
require('./commands/endtournoi')(client);
require('./commands/tournois')(client);
require('./commands/deletetournoi')(client);
require('./commands/resetmatch')(client);

client.login(process.env.TOKEN);
