const BOT_TOKEN = "8458711873:AAHBiPv2XWDZ3WuGaRCZvejat8bEIfwVZkk";
const BIN_ID = "69edd100856a6821897367c9";
const API_KEY = "$2a$10$TyOXeu0PPOnyzTfOreJzhOKiw3NyMQtnURo0koS2JFiOFMatKoDgq";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = req.body;
  const msg = body.channel_post || body.edited_channel_post;

  if (!msg || !msg.text) {
    return res.status(200).send("OK");
  }

  const text = msg.text;
  const messageId = msg.message_id;

  let db;
  try {
    const dataRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    const json = await dataRes.json();
    db = json.record;
  } catch (error) {
    return res.status(200).send("OK");
  }

  const sections = ["popular", "webSeries", "upcoming", "bannerSlides"];

  function normalize(title) {
    return title.toLowerCase().trim();
  }

  function findDuplicate(title, excludeMessageId = null) {
    const t = normalize(title);
    for (let sec of sections) {
      if (!db[sec]) continue;
      let found = db[sec].find(m => normalize(m.title) === t);
      if (found && (excludeMessageId === null || found.messageId !== excludeMessageId)) {
        return { section: sec, item: found };
      }
    }
    return null;
  }

  if (body.edited_channel_post) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 13) return res.status(200).send("OK");

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";

    let item = db[section]?.find(m => m.messageId === messageId);
    if (!item) return res.status(200).send("OK");

    let newTitle = lines[1];
    let duplicate = findDuplicate(newTitle, messageId);
    if (duplicate) return res.status(200).send("OK");

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
    return res.status(200).send("OK");
  }

  if (!text.startsWith("/")) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 13) return res.status(200).send("OK");

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";

    if (!["popular", "webSeries", "upcoming"].includes(section)) {
      return res.status(200).send("OK");
    }

    let title = lines[1];
    let duplicate = findDuplicate(title);
    if (duplicate) return res.status(200).send("OK");

    if (!db[section]) db[section] = [];

    let movie = {
      messageId: messageId,
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

    db[section].unshift(movie);
    await updateDB(db);
    return res.status(200).send("OK");
  }

  if (text.startsWith("/del")) {
    let name = text.replace("/del", "").trim();
    if (!name) return res.status(200).send("OK");

    let found = false;
    for (let sec of sections) {
      if (!db[sec]) continue;
      let before = db[sec].length;
      db[sec] = db[sec].filter(m => normalize(m.title) !== normalize(name));
      if (db[sec].length !== before) found = true;
    }

    if (!found) return res.status(200).send("OK");
    await updateDB(db);
    return res.status(200).send("OK");
  }

  res.status(200).send("OK");

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
}
