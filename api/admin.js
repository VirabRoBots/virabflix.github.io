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
  // ➕ ADD (FULL VERSION with language & quality)
  // =========================
  if (text.startsWith("/add")) {
    // Split by newline - IMPORTANT: Telegram uses \n
    let lines = text.split("\n");
    // Remove the first line which is "/add"
    lines.shift();
    // Filter out empty lines
    lines = lines.filter(line => line.trim().length > 0);
    
    // Debug: Send back what we received
    await send(chatId, `📝 Received ${lines.length} lines:\n${lines.slice(0,5).join('\n')}...`);
    
    if (lines.length < 13) {
      await send(chatId, `❌ Need 13 lines! Got ${lines.length}\n\nFormat:\n1. section\n2. title\n3. year\n4. poster\n5. rating\n6. duration\n7. director\n8. genres\n9. plot\n10. language\n11. quality\n12. streamLink\n13. telegramLink`);
      return res.status(200).send("OK");
    }

    let section = lines[0].toLowerCase().trim();
    
    // Validate section
    if (!["popular", "webseries", "upcoming"].includes(section)) {
      await send(chatId, "❌ Invalid section! Use: popular, webseries, or upcoming");
      return res.status(200).send("OK");
    }
    
    // Normalize section name
    if (section === "webseries") section = "webSeries";
    
    let title = lines[1].trim();
    
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
      year: lines[2].trim(),
      poster: lines[3].trim(),
      rating: lines[4].trim(),
      duration: lines[5].trim(),
      director: lines[6].trim(),
      genres: lines[7].split(",").map(g => g.trim()),
      plot: lines[8].trim(),
      language: lines[9].trim().split(",").map(l => l.trim()), // Can be multiple: "Kannada,Telugu"
      quality: lines[10].trim(),
      streamLink: lines[11].trim(),
      telegramLink: lines[12].trim()
    };

    db[section].push(movie);

    try {
      await updateDB(db);
      await send(chatId, `✅ Added successfully!\n\nSection: ${section}\nTitle: ${title}\nYear: ${movie.year}\nLanguage: ${movie.language.join(", ")}`);
    } catch (error) {
      await send(chatId, "❌ Failed to update database");
    }
    
    return res.status(200).send("OK");
  }

  // =========================
  // ✏️ EDIT
  // =========================
  if (text.startsWith("/edit")) {
    let lines = text.split("\n");
    lines.shift(); // Remove "/edit"
    lines = lines.filter(line => line.trim().length > 0);
    
    if (lines.length < 3) {
      await send(chatId, `❌ Invalid format! Need:\n1. section\n2. old title\n3. field:value changes\n\nExample:\n/edit\npopular\nNee Forever\nyear:2025\nrating:9.0`);
      return res.status(200).send("OK");
    }

    let section = lines[0].toLowerCase().trim();
    if (section === "webseries") section = "webSeries";
    
    if (!["popular", "webSeries", "upcoming"].includes(section)) {
      await send(chatId, "❌ Invalid section! Use: popular, webseries, or upcoming");
      return res.status(200).send("OK");
    }
    
    let oldTitle = lines[1].trim();
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
      let colonIndex = change.indexOf(":");
      if (colonIndex === -1) continue;
      
      let field = change.substring(0, colonIndex).trim().toLowerCase();
      let value = change.substring(colonIndex + 1).trim();
      
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
        case "language":
          db[section][movieIndex].language = value.split(",").map(l => l.trim());
          updatedFields.push("language");
          break;
        case "quality":
          db[section][movieIndex].quality = value;
          updatedFields.push("quality");
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
          await send(chatId, `⚠️ Unknown field: ${field}`);
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
      await send(chatId, `❌ Movie "${name}" not found`);
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
