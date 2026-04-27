const BOT_TOKEN = "8458711873:AAHBiPv2XWDZ3WuGaRCZvejat8bEIfwVZkk";
const BIN_ID = "69edd100856a6821897367c9";
const API_KEY = "$2a$10$TyOXeu0PPOnyzTfOreJzhOKiw3NyMQtnURo0koS2JFiOFMatKoDgq";

const ADMINS = ["6887303054"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = req.body;
  const msg = body.message || body.edited_message;

  if (!msg || !msg.text) {
    return res.status(200).send("OK");
  }

  const chatId = msg.chat.id.toString();
  const text = msg.text;

  if (!ADMINS.includes(chatId)) {
    return res.status(200).send("OK");
  }

  // =========================
  // 📥 FETCH DB
  // =========================
  let db;
  try {
    const dataRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    const json = await dataRes.json();
    db = json.record;
  } catch (error) {
    await send(chatId, "❌ DB fetch failed");
    return res.status(200).send("OK");
  }

  // =========================
  // 🧠 HELPERS
  // =========================
  const sections = ["popular", "webSeries", "upcoming", "bannerSlides"];

  function normalize(title) {
    return title.toLowerCase().trim();
  }

  function findDuplicate(title) {
    const t = normalize(title);

    for (let sec of sections) {
      if (!db[sec]) continue;

      let found = db[sec].find(m => normalize(m.title) === t);
      if (found) return { section: sec, item: found };
    }
    return null;
  }

  // =========================
  // ✏️ EDIT (message edited)
  // =========================
  if (body.edited_message) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 13) return res.send("OK");

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";

    let item = db[section]?.find(m => m.messageId === msg.message_id);
    if (!item) return res.send("OK");

    let newTitle = lines[1];

    let duplicate = findDuplicate(newTitle);
    if (duplicate && duplicate.item.messageId !== msg.message_id) {
      await send(chatId, `⚠️ Duplicate in ${duplicate.section}`);
      return res.send("OK");
    }

    Object.assign(item, {
      title: lines[1],
      year: lines[2],
      poster: lines[3],
      rating: lines[4],
      duration: lines[5],
      director: lines[6],
      genres: lines[7].split(",").map(g => g.trim()),
      plot: lines[8],
      language: lines[9].split(",").map(l => l.trim()),
      quality: lines[10],
      streamLink: lines[11],
      telegramLink: lines[12]
    });

    await updateDB(db);
    return res.send("OK");
  }

  // =========================
  // ➕ AUTO ADD
  // =========================
  if (!text.startsWith("/")) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    if (lines.length < 13) return res.send("OK");

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";

    if (!["popular", "webSeries", "upcoming"].includes(section)) {
      return res.send("OK");
    }

    let title = lines[1];

    let duplicate = findDuplicate(title);
    if (duplicate) {
      await send(chatId, `⚠️ Duplicate already in ${duplicate.section}`);
      return res.send("OK");
    }

    if (!db[section]) db[section] = [];

    let movie = {
      messageId: msg.message_id,
      title: title,
      year: lines[2],
      poster: lines[3],
      rating: lines[4],
      duration: lines[5],
      director: lines[6],
      genres: lines[7].split(",").map(g => g.trim()),
      plot: lines[8],
      language: lines[9].split(",").map(l => l.trim()),
      quality: lines[10],
      streamLink: lines[11],
      telegramLink: lines[12],
      addedAt: Date.now()
    };

    // 🔥 Reverse order (NEW FIRST)
    db[section].unshift(movie);

    await updateDB(db);
    return res.send("OK");
  }

  // =========================
  // ❌ DELETE (manual)
  // =========================
  if (text.startsWith("/del")) {
    let name = text.replace("/del", "").trim();

    if (!name) {
      await send(chatId, "❌ Usage: /del name");
      return res.send("OK");
    }

    let found = false;

    for (let sec of sections) {
      if (!db[sec]) continue;

      let before = db[sec].length;
      db[sec] = db[sec].filter(
        m => normalize(m.title) !== normalize(name)
      );

      if (db[sec].length !== before) found = true;
    }

    if (!found) {
      await send(chatId, "❌ Not found");
      return res.send("OK");
    }

    await updateDB(db);
    await send(chatId, "🗑 Deleted");
    return res.send("OK");
  }

  res.status(200).send("OK");

  // =========================
  // 🔄 UPDATE DB
  // =========================
  async function updateDB(data) {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error("DB update failed");
    return response.json();
  }

  // =========================
  // 📤 SEND MESSAGE
  // =========================
  async function send(chat, text) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text: text
        })
      });
    } catch (e) {
      console.error("Send error:", e);
    }
  }
}
