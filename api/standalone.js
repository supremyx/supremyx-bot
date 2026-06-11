require('dotenv').config();
const mongoose = require('mongoose');
const { startApiServer } = require('./server');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connecté (API standalone)'))
  .catch(err => console.error('❌ Erreur MongoDB:', err));

startApiServer();
