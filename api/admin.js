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

  if (body.callback_query) {
    const callbackData = body.callback_query.data;
    const callbackChatId = body.callback_query.message.chat.id;
    const callbackMessageId = body.callback_query.message.message_id;
    const originalMessageId = body.callback_query.message.reply_to_message?.message_id;

    if (callbackData.startsWith("delete_")) {
      const titleToDelete = callbackData.replace("delete_", "");
      
      let deleted = false;
      for (let sec of sections) {
        if (!db[sec]) continue;
        const foundItem = db[sec].find(m => normalize(m.title) === normalize(titleToDelete));
        if (foundItem) {
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
    
    return res.status(200).send("OK");
  }

  if (!msg || !msg.text) {
    return res.status(200).send("OK");
  }

  const text = msg.text;
