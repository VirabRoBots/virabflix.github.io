const BOT_TOKEN = "8458711873:AAHBiPv2XWDZ3WuGaRCZvejat8bEIfwVZkk";
const BIN_ID = "69edd100856a6821897367c9";
const API_KEY = "$2a$10$TyOXeu0PPOnyzTfOreJzhOKiw3NyMQtnURo0koS2JFiOFMatKoDgq";

// space separated admins
const ADMINS = "123456789 987654321".split(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.send("OK");

  const body = req.body;
  const msg = body.message;

  if (!msg || !msg.text) return res.send("OK");

  const chatId = msg.chat.id.toString();
  const text = msg.text;

  // ❌ Not admin
  if (!ADMINS.includes(chatId)) return res.send("OK");

  // 📥 Fetch current data
  const dataRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: { "X-Master-Key": API_KEY }
  });

  const json = await dataRes.json();
  let db = json.record;

  // =========================
  // ➕ ADD
  // =========================
  if (text.startsWith("/add")) {

    let lines = text.replace("/add", "").trim().split("\n");

    let section = lines[0]; // popular / webSeries / upcoming
    let title = lines[1];

    // check exists
    let exists = db[section]?.find(m => m.title === title);
    if (exists) {
      return send(chatId, "⚠️ Already added");
    }

    let movie = {
      title: lines[1],
      year: lines[2],
      poster: lines[3],
      rating: lines[4],
      duration: lines[5],
      director: lines[6],
      genres: lines[7].split(","),
      plot: lines[8],
      streamLink: lines[9],
      telegramLink: lines[10]
    };

    db[section].push(movie);

    await updateDB(db);

    return send(chatId, "✅ Added successfully");
  }

  // =========================
  // ❌ DELETE
  // =========================
  if (text.startsWith("/del")) {

    let name = text.replace("/del", "").trim();

    let found = false;

    for (let key of ["popular", "webSeries", "upcoming"]) {
      let before = db[key].length;
      db[key] = db[key].filter(m => m.title !== name);
      if (db[key].length !== before) found = true;
    }

    if (!found) return send(chatId, "❌ Not found");

    await updateDB(db);

    return send(chatId, "🗑 Deleted");
  }

  res.send("OK");

  // ===== helpers =====

  async function updateDB(data) {
    await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY
      },
      body: JSON.stringify(data)
    });
  }

  async function send(chat, text) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text: text
      })
    });
  }
}
