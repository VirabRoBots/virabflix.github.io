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
  // ➕ ADD (with BANNER support)
  // =========================
  if (text.startsWith("/add")) {
    let lines = text.split("\n");
    lines.shift(); // Remove "/add"
    lines = lines.filter(line => line.trim().length > 0);
    
    if (lines.length < 2) {
      await send(chatId, "❌ Invalid format");
      return res.status(200).send("OK");
    }

    let section = lines[0].toLowerCase().trim();
    
    // ========== BANNER SECTION ==========
    if (section === "banner") {
      if (lines.length < 5) {
        await send(chatId, "❌ Banner needs: title, year, poster, type\nFormat:\n/add\nbanner\n[title]\n[year]\n[poster URL]\n[type]");
        return res.status(200).send("OK");
      }
      
      if (!db.bannerSlides) db.bannerSlides = [];
      
      let banner = {
        title: lines[1].trim(),
        year: lines[2].trim(),
        poster: lines[3].trim(),
        type: lines[4].trim() || "Movie"
      };
      
      // Check exists
      let exists = db.bannerSlides.find(b => b.title === banner.title);
      if (exists) {
        await send(chatId, `⚠️ Banner "${banner.title}" already exists`);
        return res.status(200).send("OK");
      }
      
      db.bannerSlides.push(banner);
      
      try {
        await updateDB(db);
        await send(chatId, `✅ Banner added!\nTitle: ${banner.title}\nYear: ${banner.year}`);
      } catch (error) {
        await send(chatId, "❌ Failed to update database");
      }
      return res.status(200).send("OK");
    }
    
    // ========== REGULAR MOVIES ==========
    if (lines.length < 13) {
      await send(chatId, `❌ Need 13 lines! Got ${lines.length}\n\nFormat:\n1. section\n2. title\n3. year\n4. poster\n5. rating\n6. duration\n7. director\n8. genres\n9. plot\n10. language\n11. quality\n12. streamLink\n13. telegramLink`);
      return res.status(200).send("OK");
    }

    if (!["popular", "webseries", "upcoming"].includes(section)) {
      await send(chatId, "❌ Invalid section! Use: popular, webseries, upcoming, or banner");
      return res.status(200).send("OK");
    }
    
    if (section === "webseries") section = "webSeries";
    
    let title = lines[1].trim();
    
    if (!db[section]) db[section] = [];

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
      language: lines[9].trim().split(",").map(l => l.trim()),
      quality: lines[10].trim(),
      streamLink: lines[11].trim(),
      telegramLink: lines[12].trim()
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
    let lines = text.split("\n");
    lines.shift();
    lines = lines.filter(line => line.trim().length > 0);
    
    if (lines.length < 3) {
      await send(chatId, "❌ Format:\n/edit\nsection\ntitle\nfield:value");
      return res.status(200).send("OK");
    }

    let section = lines[0].toLowerCase().trim();
    if (section === "webseries") section = "webSeries";
    
    if (!["popular", "webSeries", "upcoming", "bannerSlides"].includes(section)) {
      await send(chatId, "❌ Invalid section!");
      return res.status(200).send("OK");
    }
    
    let oldTitle = lines[1].trim();
    let changes = lines.slice(2);
    
    let movieIndex = db[section]?.findIndex(m => m.title === oldTitle);
    
    if (movieIndex === -1 || !db[section][movieIndex]) {
      await send(chatId, `❌ "${oldTitle}" not found in ${section}`);
      return res.status(200).send("OK");
    }
    
    let updatedFields = [];
    for (let change of changes) {
      let colonIndex = change.indexOf(":");
      if (colonIndex === -1) continue;
      
      let field = change.substring(0, colonIndex).trim().toLowerCase();
      let value = change.substring(colonIndex + 1).trim();
      
      if (db[section][movieIndex].hasOwnProperty(field)) {
        if (field === "genres" || field === "language") {
          db[section][movieIndex][field] = value.split(",").map(v => v.trim());
        } else {
          db[section][movieIndex][field] = value;
        }
        updatedFields.push(field);
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

    for (let key of ["popular", "webSeries", "upcoming", "bannerSlides"]) {
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
      await send(chatId, `❌ "${name}" not found`);
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
