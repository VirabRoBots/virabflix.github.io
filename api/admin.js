const BOT_TOKEN = "8625032875:AAGy963USUhyALpKMQMTRqw0A45MnKD6lI0";
const BIN_ID = "69edd100856a6821897367c9";
const API_KEY = "$2a$10$TyOXeu0PPOnyzTfOreJzhOKiw3NyMQtnURo0koS2JFiOFMatKoDgq";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const body = req.body;
  const msg = body.channel_post || body.edited_channel_post || body.message;

  let db;
  try {
    const dataRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: { "X-Master-Key": API_KEY }
    });
    const json = await dataRes.json();
    db = json.record;
    if (!db.bannerSlides) db.bannerSlides = [];
    if (!db.popular) db.popular = [];
    if (!db.webseries) db.webseries = [];
    if (!db.upcoming) db.upcoming = [];
  } catch (error) {
    console.error("DB Fetch Error:", error);
    return res.status(200).send("OK");
  }

  const sections = ["popular", "webseries", "upcoming", "bannerSlides"];

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

  // Handle callback queries (button clicks)
  if (body.callback_query) {
    const callbackData = body.callback_query.data;
    const callbackChatId = body.callback_query.message.chat.id;
    const callbackMessageId = body.callback_query.message.message_id;
    const originalMessageId = body.callback_query.message.reply_to_message?.message_id;

    if (callbackData.startsWith("delete_")) {
      const titleToDelete = callbackData.replace("delete_", "");
      
      let deleted = false;
      let deletedMessageId = null;
      
      for (let sec of sections) {
        if (!db[sec]) continue;
        const foundItem = db[sec].find(m => normalize(m.title) === normalize(titleToDelete));
        if (foundItem) {
          deletedMessageId = foundItem.messageId;
          db[sec] = db[sec].filter(m => normalize(m.title) !== normalize(titleToDelete));
          deleted = true;
          break;
        }
      }

      if (deleted) {
        await updateDB(db);
        
        if (originalMessageId) {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: callbackChatId,
              message_id: originalMessageId
            })
          }).catch(err => console.error("Error deleting original message:", err));
        }
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callbackChatId,
            message_id: callbackMessageId
          })
        }).catch(err => console.error("Error deleting button message:", err));
      }
    }
    else if (callbackData.startsWith("banner_")) {
      const bannerIndex = parseInt(callbackData.replace("banner_", ""));
      const banner = db.bannerSlides[bannerIndex];
      
      if (banner && banner.telegramLink) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callbackChatId,
            text: `🎬 *${banner.title}*\n\n📅 Year: ${banner.year}\n⭐ Rating: ${banner.rating}\n⏱️ Duration: ${banner.duration}\n🎭 Director: ${banner.director}\n\n📜 *Plot:* ${banner.plot}\n\n🔗 [Watch Now](${banner.telegramLink})`,
            parse_mode: "Markdown",
            disable_web_page_preview: false
          })
        });
      }
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: body.callback_query.id
        })
      });
    }
    
    return res.status(200).send("OK");
  }

  if (!msg || !msg.text) {
    return res.status(200).send("OK");
  }

  const text = msg.text;
  const messageId = msg.message_id;
  const chatId = msg.chat.id;

  function parseMovieMessage(lines) {
    if (lines.length < 5) return null;
    
    let section = lines[0].toLowerCase().trim();
    
    if (!sections.includes(section)) {
      return null;
    }
    
    let title = lines[1];
    let year = lines[2];
    let poster = lines[3];
    let rating = lines[4];
    let duration = lines[5];
    let director = lines[6];
    
    let genreLines = [];
    let currentIndex = 7;
    while (currentIndex < lines.length) {
      let line = lines[currentIndex];
      if (line && !line.startsWith('#') && !line.startsWith('🌋') && !line.startsWith('🎭') && 
          !line.startsWith('📜') && !line.startsWith('🧟') && !line.startsWith('🎬') &&
          !line.startsWith('⭐') && line.length > 30) {
        break;
      }
      if (line && (line.toLowerCase() === 'hindi' || line.toLowerCase() === 'kannada' || 
          line.toLowerCase() === 'english' || line.toLowerCase() === 'tamil' ||
          line.toLowerCase() === 'telugu' || line.toLowerCase() === 'malayalam')) {
        break;
      }
      genreLines.push(line);
      currentIndex++;
    }
    
    const genreText = genreLines.join(' ');
    const genres = genreText.match(/#[^#]+/g)?.map(g => g.trim()) || [];
    
    let plot = lines[currentIndex] || '';
    let language = lines[currentIndex + 1] || '';
    let quality = lines[currentIndex + 2] || '';
    let streamLink = lines[currentIndex + 3] || '';
    let telegramLink = lines[currentIndex + 4] || '';
    
    if (plot.length < 20 && lines[currentIndex + 5]) {
      plot = plot + ' ' + lines[currentIndex + 5];
    }
    
    return {
      section,
      movie: {
        title,
        year,
        poster,
        rating,
        duration,
        director,
        genres,
        plot,
        language: language.split(",").map(l => l.trim()),
        quality,
        streamLink,
        telegramLink
      }
    };
  }

  // Handle banner command
  if (text.startsWith("/banner")) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 8) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ Invalid banner format. Use:\n/banner\n[Title]\n[Year]\n[Poster URL]\n[Rating]\n[Duration]\n[Director]\n[Plot]\n[Telegram Link]"
        })
      });
      return res.status(200).send("OK");
    }

    const banner = {
      messageId: messageId,
      title: lines[1],
      year: lines[2],
      poster: lines[3],
      rating: lines[4],
      duration: lines[5],
      director: lines[6],
      plot: lines[7],
      telegramLink: lines[8] || "",
      addedAt: Date.now()
    };

    if (!db.bannerSlides) db.bannerSlides = [];
    db.bannerSlides.push(banner);
    await updateDB(db);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ Banner "${banner.title}" has been added successfully!`
      })
    });

    return res.status(200).send("OK");
  }

  // Handle /showbanner command
  if (text.startsWith("/showbanner")) {
    if (!db.bannerSlides || db.bannerSlides.length === 0) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ No banners available."
        })
      });
      return res.status(200).send("OK");
    }

    // Create inline keyboard for banner navigation
    const keyboardButtons = [];
    for (let i = 0; i < db.bannerSlides.length; i++) {
      keyboardButtons.push([{
        text: `📺 ${db.bannerSlides[i].title}`,
        callback_data: `banner_${i}`
      }]);
    }

    // Show the first banner as preview
    const firstBanner = db.bannerSlides[0];
    const caption = `🎬 *BANNER CAROUSEL*\n\n📌 Total Banners: ${db.bannerSlides.length}\n\n🎯 *Current:* ${firstBanner.title}\n📅 ${firstBanner.year} | ⭐ ${firstBanner.rating}\n\n👇 *Click below to watch any banner* 👇`;

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: firstBanner.poster,
        caption: caption,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: keyboardButtons
        }
      })
    });

    return res.status(200).send("OK");
  }

  // Handle edited posts
  if (body.edited_channel_post) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 8) return res.status(200).send("OK");

    let section = lines[0].toLowerCase().trim();

    let item = db[section]?.find(m => m.messageId === messageId);
    if (!item) return res.status(200).send("OK");

    let parsed = parseMovieMessage(lines);
    if (!parsed) return res.status(200).send("OK");

    let newTitle = parsed.movie.title;
    let duplicate = findDuplicate(newTitle, messageId);
    if (duplicate) return res.status(200).send("OK");

    Object.assign(item, parsed.movie);
    await updateDB(db);
    return res.status(200).send("OK");
  }

  // Handle new posts
  if (!text.startsWith("/")) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 8) return res.status(200).send("OK");

    let parsed = parseMovieMessage(lines);
    if (!parsed) return res.status(200).send("OK");

    let title = parsed.movie.title;
    let duplicate = findDuplicate(title);
    if (duplicate) return res.status(200).send("OK");

    if (!db[parsed.section]) db[parsed.section] = [];

    let movie = {
      messageId: messageId,
      ...parsed.movie,
      addedAt: Date.now()
    };

    db[parsed.section].unshift(movie);
    await updateDB(db);
    
    const inlineKeyboard = {
      inline_keyboard: [[
        {
          text: "🗑️ Delete",
          callback_data: `delete_${title}`
        }
      ]]
    };

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        reply_to_message_id: messageId,
        text: "🗑️ Click to delete this content",
        reply_markup: inlineKeyboard
      })
    });
    
    return res.status(200).send("OK");
  }

  // Handle /del command
  if (text.startsWith("/del")) {
    let name = text.replace("/del", "").trim();
    if (!name) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ Please provide a title to delete.\nUsage: /del [Movie Title]"
        })
      });
      return res.status(200).send("OK");
    }

    let found = false;
    let foundMessageId = null;
    
    for (let sec of sections) {
      if (!db[sec]) continue;
      let itemToDelete = db[sec].find(m => normalize(m.title) === normalize(name));
      if (itemToDelete) {
        foundMessageId = itemToDelete.messageId;
        db[sec] = db[sec].filter(m => normalize(m.title) !== normalize(name));
        found = true;
        break;
      }
    }

    if (!found) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `❌ "${name}" not found in database.`
        })
      });
      return res.status(200).send("OK");
    }
    
    await updateDB(db);
    
    if (foundMessageId) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: foundMessageId
        })
      }).catch(err => console.error("Error deleting message:", err));
    }
    
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ "${name}" has been deleted successfully!`
      })
    });
    
    return res.status(200).send("OK");
  }

  res.status(200).send("OK");

  async function updateDB(data) {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Master-Key": API_KEY
        },
        body: JSON.stringify(data)
      });
      console.log("DB Update Status:", response.status);
    } catch(e) {
      console.error("DB Update Error:", e);
    }
  }
}
