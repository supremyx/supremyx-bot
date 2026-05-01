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

require('./commands/register')(client);
require('./commands/addmatch')(client);
require('./commands/ranking')(client);

client.login(process.env.TOKEN);
