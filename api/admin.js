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
  } catch (error) {
    return res.status(200).send("OK");
  }

  const sections = ["popular", "webSeries", "upcoming", "bannerSlides"];

  function normalize(title) {
    return title.toLowerCase().trim();
  }

  function processEmojis(text) {
    return text;
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
      let deletedItem = null;
      for (let sec of sections) {
        if (!db[sec]) continue;
        const foundItem = db[sec].find(m => normalize(m.title) === normalize(titleToDelete));
        if (foundItem) {
          deletedItem = foundItem;
          db[sec] = db[sec].filter(m => normalize(m.title) !== normalize(titleToDelete));
          deleted = true;
          break;
        }
      }

      if (deleted) {
        await updateDB(db);
        
        // Delete the original message
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
        
        // Delete the button message as well
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
    
    return res.status(200).send("OK");
  }

  if (!msg || !msg.text) {
    return res.status(200).send("OK");
  }

  const text = msg.text;
  const messageId = msg.message_id;
  const chatId = msg.chat.id;

  // Handle edited posts
  if (body.edited_channel_post) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 13) return res.status(200).send("OK");

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";

    let item = db[section]?.find(m => m.messageId === messageId);
    if (!item) return res.status(200).send("OK");

    let newTitle = processEmojis(lines[1]);
    let duplicate = findDuplicate(newTitle, messageId);
    if (duplicate) return res.status(200).send("OK");

    Object.assign(item, {
      title: newTitle,
      year: lines[2],
      poster: lines[3],
      rating: processEmojis(lines[4]),
      duration: lines[5],
      director: lines[6],
      genres: lines[7].split(/#+/).filter(g => g.trim()).map(g => '#' + g.trim()),
      plot: lines[8],
      language: lines[9].split(",").map(l => l.trim()),
      quality: lines[10],
      streamLink: lines[11],
      telegramLink: lines[12]
    });

    await updateDB(db);
    return res.status(200).send("OK");
  }

  // Handle new posts
  if (!text.startsWith("/")) {
    let lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 13) return res.status(200).send("OK");

    let section = lines[0].toLowerCase();
    if (section === "webseries") section = "webSeries";

    if (!["popular", "webSeries", "upcoming"].includes(section)) {
      return res.status(200).send("OK");
    }

    let title = processEmojis(lines[1]);
    let duplicate = findDuplicate(title);
    if (duplicate) return res.status(200).send("OK");

    if (!db[section]) db[section] = [];

    let movie = {
      messageId: messageId,
      title: title,
      year: lines[2],
      poster: lines[3],
      rating: processEmojis(lines[4]),
      duration: lines[5],
      director: lines[6],
      genres: lines[7].match(/#[^#]+/g).map(g => g.trim()),
      plot: lines[8],
      language: lines[9].split(",").map(l => l.trim()),
      quality: lines[10],
      streamLink: lines[11],
      telegramLink: lines[12],
      addedAt: Date.now()
    };

    db[section].unshift(movie);
    await updateDB(db);
    
    // Add delete button as a reply to the original message
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
    if (!name) return res.status(200).send("OK");

    let found = false;
    let foundMessageId = null;
    let foundChatId = chatId;
    
    for (let sec of sections) {
      if (!db[sec]) continue;
      let before = db[sec].length;
      let itemToDelete = db[sec].find(m => normalize(m.title) === normalize(name));
      if (itemToDelete) {
        foundMessageId = itemToDelete.messageId;
        db[sec] = db[sec].filter(m => normalize(m.title) !== normalize(name));
        if (db[sec].length !== before) found = true;
        break;
      }
    }

    if (!found) return res.status(200).send("OK");
    
    await updateDB(db);
    
    // Try to delete the original message
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
    
    // Send confirmation
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
