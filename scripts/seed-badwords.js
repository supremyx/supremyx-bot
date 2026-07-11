/**
 * Seed bad words list into MongoDB.
 * Run once: node scripts/seed-badwords.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const BadWord   = require('../database/models/BadWord');

const WORDS = [
  // ── Insultes françaises courantes ─────────────────────────────────────────
  'connard', 'connasse', 'con', 'conne',
  'salope', 'pute', 'putain', 'putasse',
  'merde', 'enculé', 'enculer', 'encule',
  'fdp', 'fils de pute', 'fils de p',
  'bâtard', 'batard', 'batar',
  'abruti', 'abrutie',
  'idiot', 'idiote', 'imbécile', 'imbecile',
  'crétin', 'crétine', 'cretin', 'cretine',
  'débile', 'debile',
  'nique', 'niquer', 'niqué',
  'ta gueule', 'ferme ta gueule', 'ftg',
  'va te faire foutre', 'vtff',
  'va te faire enculer', 'vtfe',
  'va mourir', 'va crever',
  'casse toi', 'casse-toi',
  'gros con', 'grosse pute', 'grosse salope',
  'tête de nœud', 'tete de noeud', 'nœud',
  'couille', 'couilles',
  'bite', 'teub', 'zob', 'pine', 'queue',
  'chatte', 'vagin', 'cul',
  'pd', 'pédé', 'pede',
  'tapette', 'fiotte', 'bouffon',
  'baltringue', 'bâtardise',
  'tocard', 'tocarde',
  'raclure', 'ordure', 'déchet', 'dechet',
  'vermine', 'parasite',
  'trouduc', 'trou du cul', 'troufignon',
  'branler', 'branleur', 'branleuse',
  'couillon', 'couillonne',
  'fumier', 'salopard', 'saloparde',
  'charogne', 'charognard',
  'gogol', 'gogy',
  'bougnoule', 'bougnoul',
  'ragondin',

  // ── Termes racistes / discriminatoires ────────────────────────────────────
  'nègre', 'negre', 'négresse', 'negresse',
  'nigger', 'nigga', 'nigg',
  'bamboula', 'bounty',
  'arabe de merde', 'sale arabe', 'sale noir',
  'sale juif', 'sale blanc',
  'bicot', 'bico', 'raton', 'crouille',
  'youpine', 'youpin',
  'feuj',
  'chinetoque', 'chintok', 'japoniche',
  'polak', 'polack',
  'boloss raciste',
  'white power', 'heil hitler', 'nazi',
  'ku klux klan', 'kkk',
  'antisémite', 'antisemite',
  'sieg heil',
  '88',  // code néonazi

  // ── Homophobie / transphobie ───────────────────────────────────────────────
  'homo de merde', 'sale pd', 'sale pédé',
  'lesbienne de merde', 'sale lesbo',
  'trans de merde', 'travelo', 'travesti',
  'enculé de pd',
  'gay de merde',

  // ── Menaces / harcèlement ─────────────────────────────────────────────────
  'je vais te tuer', 'je vais te crever', 'je vais te niquer',
  'je vais te défoncer',
  'mort à toi', 'crève',
  'suicide toi', 'suicidez vous', 'suicidez-vous',
  'vas mourir', 'tu mérites de mourir',
  'kill yourself', 'kys',
  'go die', 'go kill yourself',

  // ── Insultes anglaises courantes ───────────────────────────────────────────
  'fuck', 'fucker', 'fucking', 'fucked',
  'shit', 'bullshit',
  'bitch', 'motherfucker', 'mf',
  'asshole', 'ass',
  'bastard',
  'cunt', 'dick', 'cock',
  'whore', 'slut',
  'retard', 'retarded',
  'faggot', 'fag',
  'dyke',
  'wanker', 'prick',
  'twat', 'dipshit', 'dumbass',

  // ── Sexuel explicite ───────────────────────────────────────────────────────
  'sex', 'sexe', 'porn', 'porno', 'pornographie',
  'nude', 'nudes', 'naked', 'xxx',
  'hentai', 'loli', 'shota',
  'inceste', 'pedophile', 'pédophile',

  // ── Contenu dangereux / illégal ───────────────────────────────────────────
  'drogue', 'dealer', 'crack', 'cocaïne', 'cocaine', 'héroïne', 'heroine',
  'mdma', 'ecstasy', 'lsd',
  'arme à feu', 'acheter pistolet', 'acheter arme',
  'terrorisme', 'djihad', 'jihad',
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connecté');

  let added = 0;
  let skipped = 0;

  for (const raw of WORDS) {
    const word = raw.trim().toLowerCase();
    if (!word) continue;
    try {
      await BadWord.create({ word, addedBy: 'SEED_SCRIPT' });
      added++;
    } catch (e) {
      if (e.code === 11000) {
        skipped++; // déjà existant
      } else {
        console.warn(`⚠️  Erreur pour "${word}":`, e.message);
      }
    }
  }

  console.log(`\n📋 Résultat :`);
  console.log(`   ✅ ${added} mots ajoutés`);
  console.log(`   ⏭️  ${skipped} mots déjà présents (ignorés)`);
  console.log(`   📦 Total en base : ${await BadWord.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
