const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

client.once('ready', () => {
  console.log(`🔥 MoSeTo connecté en tant que ${client.user.tag}`);
});

require('./commands/help')(client);
require('./commands/register')(client);
require('./commands/unregister')(client);
require('./commands/addmatch')(client);
require('./commands/ranking')(client);
require('./commands/stats')(client);
require('./commands/history')(client);
require('./commands/top')(client);
require('./commands/matchs')(client);
require('./commands/resetmatch')(client);

client.login(process.env.TOKEN);
