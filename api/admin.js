const BOT_TOKEN = "8625032875:AAGy963USUhyALpKMQMTRqw0A45MnKD6lI0";
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
  const chatId = msg.chat.id;

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

  // Function to process emojis in text
  function processEmojis(text) {
    // This preserves emojis as they are in Telegram messages
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

  // Function to send delete button below a message
  async function addDeleteButton(chatId, messageId, title) {
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
        text: "⬆️ Click button above to delete this item",
        reply_markup: inlineKeyboard
      })
    });
  }

  // Handle callback queries (button clicks)
  if (body.callback_query) {
    const callbackData = body.callback_query.data;
    const callbackChatId = body.callback_query.message.chat.id;
    const callbackMessageId = body.callback_query.message.message_id;

    if (callbackData.startsWith("delete_")) {
      const titleToDelete = callbackData.replace("delete_", "");
      
      let deleted = false;
      for (let sec of sections) {
        if (!db[sec]) continue;
        const before = db[sec].length;
        db[sec] = db[sec].filter(m => normalize(m.title) !== normalize(titleToDelete));
        if (db[sec].length !== before) deleted = true;
      }

      if (deleted) {
        await updateDB(db);
        
        // Edit the button message to show it was deleted
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callbackChatId,
            message_id: callbackMessageId,
            text: `✅ "${titleToDelete}" has been deleted successfully!`
          })
        });
        
        // Optional: Delete the original content message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: callbackChatId,
            message_id: callbackMessageId - 1 // Assuming button is reply to original message
          })
        }).catch(() => {});
      }
    }
    
    return res.status(200).send("OK");
  }

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
      rating: processEmojis(lines[4]), // Support emojis in rating (stars)
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
      rating: processEmojis(lines[4]), // Support emojis like ⭐, ★, etc.
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
    
    // Add delete button below the message
    await addDeleteButton(chatId, messageId, title);
    
    return res.status(200).send("OK");
  }

  // Remove /del command handling completely
  
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
