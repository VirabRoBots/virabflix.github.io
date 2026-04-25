const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const BOT_TOKEN = '8458711873:AAHBiPv2XWDZ3WuGaRCZvejat8bEIfwVZkk';
const MOVIES_FILE = 'movies.json';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let waiting = {};

function load() { return JSON.parse(fs.readFileSync(MOVIES_FILE)); }
function save(data) { fs.writeFileSync(MOVIES_FILE, JSON.stringify(data, null, 2)); }

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Section:', {
    reply_markup: { keyboard: [['Popular', 'Upcoming', 'Web Series']], resize_keyboard: true }
  });
  waiting[chatId] = { step: 'section' };
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (text === '/start') return;

  if (waiting[chatId]?.step === 'section') {
    let section = text === 'Popular' ? 'popular' : text === 'Upcoming' ? 'upcoming' : text === 'Web Series' ? 'webSeries' : null;
    if (!section) return bot.sendMessage(chatId, 'Use buttons');
    waiting[chatId] = { step: 'movie', section };
    bot.sendMessage(chatId, 'Send movie (10 lines):', { reply_markup: { remove_keyboard: true } });
    return;
  }

  if (waiting[chatId]?.step === 'movie') {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 8) return bot.sendMessage(chatId, 'Need 10 lines. Send again.');

    const movie = {
      title: lines[0], year: lines[1], poster: lines[2], rating: `⭐️ ${lines[3]} / 10`,
      duration: lines[4], director: lines[5], language: ["Kannada"], quality: "WEB-DL",
      genres: lines[6].split(',').map(g => `#${g.trim()}`), plot: lines[7],
      streamLink: lines[8] || "#", telegramLink: lines[9] || "https://t.me/Cinemaniacs_Hub"
    };

    const movies = load();
    const section = waiting[chatId].section;

    if (movies[section].some(m => m.title.toLowerCase() === movie.title.toLowerCase())) {
      bot.sendMessage(chatId, `❌ Already exists. Use /del "${movie.title}"`);
      delete waiting[chatId];
      return;
    }

    movies[section].unshift(movie);
    save(movies);
    bot.sendMessage(chatId, `✅ Added to ${section}`);
    delete waiting[chatId];
  }
});

bot.onText(/\/del (.+)/, (msg, match) => {
  const title = match[1];
  const movies = load();
  for (const section of ['popular', 'upcoming', 'webSeries']) {
    const index = movies[section].findIndex(m => m.title.toLowerCase() === title.toLowerCase());
    if (index !== -1) {
      movies[section].splice(index, 1);
      save(movies);
      bot.sendMessage(msg.chat.id, `✅ Deleted "${title}"`);
      return;
    }
  }
  bot.sendMessage(msg.chat.id, `❌ Not found`);
});

console.log('Bot running');
