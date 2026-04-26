const BOT_TOKEN = "8458711873:AAHBiPv2XWDZ3WuGaRCZvejat8bEIfwVZkk";
const BIN_ID = "69edd100856a6821897367c9";
const API_KEY = "$2a$10$TyOXeu0PPOnyzTfOreJzhOKiw3NyMQtnURo0koS2JFiOFMatKoDgq";

// space separated admins
const ADMINS = "6887303054".split(" ");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = req.body;
  const msg = body.message;

  if (!msg || !msg.text) {
    return res.status(200).send("OK");
  }

  const chatId = msg.chat.id.toString();
  const text = msg.text;

  // ❌ Not admin
  if (!ADMINS.includes(chatId)) {
    return res.status(200).send("OK");
  }

  // 📥 Fetch current data
  let db;
  try {
    const dataRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    const json = await dataRes.json();
    db = json.record;
  } catch (error) {
    await send(chatId, "❌ Failed to fetch database");
    return res.status(200).send("OK");
  }

  // =========================
  // ➕ ADD
  // =========================
  if (text.startsWith("/add")) {
    // Split by newline and filter empty lines
    let lines = text.replace("/add", "").trim().split("\n").filter(line => line.trim());
    
    if (lines.length < 11) {
      await send(chatId, `❌ Invalid format! Need 11 lines:\n1. section\n2. title\n3. year\n4. poster\n5. rating\n6. duration\n7. director\n8. genres\n9. plot\n10. streamLink\n11. telegramLink\n\nReceived ${lines.length} lines`);
      return res.status(200).send("OK");
    }

    let section = lines[0].toLowerCase();
    
    // Validate section
    if (!["popular", "webseries", "upcoming"].includes(section)) {
      await send(chatId, "❌ Invalid section! Use: popular, webseries, or upcoming");
      return res.status(200).send("OK");
    }
    
    // Normalize section name
    if (section === "webseries") section = "webSeries";
    
    let title = lines[1];
    
    // Check if section exists in db
    if (!db[section]) {
      db[section] = [];
    }

    // Check exists
    let exists = db[section]?.find(m => m.title === title);
    if (exists) {
      await send(chatId, `⚠️ Already added: "${title}" in ${section}`);
      return res.status(200).send("OK");
    }

    let movie = {
      title: title,
      year: lines[2] || "N/A",
      poster: lines[3] || "https://via.placeholder.com/120x180?text=No+Poster",
      rating: lines[4] || "N/A",
      duration: lines[5] || "N/A",
      director: lines[6] || "N/A",
      genres: lines[7] ? lines[7].split(",").map(g => g.trim()) : [],
      plot: lines[8] || "No description",
      streamLink: lines[9] || "#",
      telegramLink: lines[10] || "#"
    };

    db[section].push(movie);

    try {
      await updateDB(db);
      await send(chatId, `✅ Added successfully!\n\nSection: ${section}\nTitle: ${title}\nYear: ${movie.year}`);
    } catch (error) {
      await send(chatId, "❌ Failed to update database");
    }
    
    return res.status(200).send("OK");
  }

  // =========================
  // ✏️ EDIT
  // =========================
  if (text.startsWith("/edit")) {
    let lines = text.replace("/edit", "").trim().split("\n").filter(line => line.trim());
    
    if (lines.length < 3) {
      await send(chatId, `❌ Invalid format! Need:\n1. section\n2. old title\n3. field:value changes\n\nExample:\n/edit\npopular\nKalki 2898 AD\nyear:2025\nrating:9.0\nstreamLink:https://newlink.com`);
      return res.status(200).send("OK");
    }

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";
    
    if (!["popular", "webSeries", "upcoming"].includes(section)) {
      await send(chatId, "❌ Invalid section! Use: popular, webseries, or upcoming");
      return res.status(200).send("OK");
    }
    
    let oldTitle = lines[1];
    let changes = lines.slice(2);
    
    // Find the movie
    let movieIndex = db[section]?.findIndex(m => m.title === oldTitle);
    
    if (movieIndex === -1 || !db[section][movieIndex]) {
      await send(chatId, `❌ Movie "${oldTitle}" not found in ${section}`);
      return res.status(200).send("OK");
    }
    
    // Apply changes
    let updatedFields = [];
    for (let change of changes) {
      let [field, ...valueParts] = change.split(":");
      let value = valueParts.join(":").trim();
      field = field.trim().toLowerCase();
      
      switch(field) {
        case "title":
          db[section][movieIndex].title = value;
          updatedFields.push("title");
          break;
        case "year":
          db[section][movieIndex].year = value;
          updatedFields.push("year");
          break;
        case "poster":
          db[section][movieIndex].poster = value;
          updatedFields.push("poster");
          break;
        case "rating":
          db[section][movieIndex].rating = value;
          updatedFields.push("rating");
          break;
        case "duration":
          db[section][movieIndex].duration = value;
          updatedFields.push("duration");
          break;
        case "director":
          db[section][movieIndex].director = value;
          updatedFields.push("director");
          break;
        case "genres":
          db[section][movieIndex].genres = value.split(",").map(g => g.trim());
          updatedFields.push("genres");
          break;
        case "plot":
          db[section][movieIndex].plot = value;
          updatedFields.push("plot");
          break;
        case "streamlink":
          db[section][movieIndex].streamLink = value;
          updatedFields.push("streamLink");
          break;
        case "telegramlink":
          db[section][movieIndex].telegramLink = value;
          updatedFields.push("telegramLink");
          break;
        default:
          await send(chatId, `⚠️ Unknown field: ${field}\nAvailable: title, year, poster, rating, duration, director, genres, plot, streamlink, telegramlink`);
      }
    }
    
    if (updatedFields.length === 0) {
      await send(chatId, "❌ No valid fields to update");
      return res.status(200).send("OK");
    }
    
    try {
      await updateDB(db);
      await send(chatId, `✅ Updated "${oldTitle}"\nChanged: ${updatedFields.join(", ")}`);
    } catch (error) {
      await send(chatId, "❌ Failed to update database");
    }
    
    return res.status(200).send("OK");
  }

  // =========================
  // ❌ DELETE
  // =========================
  if (text.startsWith("/del")) {
    let name = text.replace("/del", "").trim();
    
    if (!name) {
      await send(chatId, "❌ Usage: /del [movie title]");
      return res.status(200).send("OK");
    }

    let found = false;
    let deletedFrom = [];

    for (let key of ["popular", "webSeries", "upcoming"]) {
      if (db[key]) {
        let before = db[key].length;
        db[key] = db[key].filter(m => m.title !== name);
        if (db[key].length !== before) {
          found = true;
          deletedFrom.push(key);
        }
      }
    }

    if (!found) {
      await send(chatId, `❌ Movie "${name}" not found in any section`);
      return res.status(200).send("OK");
    }

    try {
      await updateDB(db);
      await send(chatId, `🗑 Deleted "${name}" from: ${deletedFrom.join(", ")}`);
    } catch (error) {
      await send(chatId, "❌ Failed to update database");
    }
    
    return res.status(200).send("OK");
  }

  res.status(200).send("OK");

  // ===== helpers =====

  async function updateDB(data) {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

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
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }
}
