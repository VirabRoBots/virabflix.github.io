export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // 🔴 HARDCODED TOKENS (NOT SAFE)
  const BOT_TOKEN = "8458711873:AAHBiPv2XWDZ3WuGaRCZvejat8bEIfwVZkk";
  const GITHUB_TOKEN = "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";

  const OWNER = "VirabRoBots";
  const REPO = "virabflix.github.io";
  const FILE_PATH = "movies.json";

  try {
    const msg = req.body.message;
    if (!msg || !msg.text) return res.status(200).end();

    const chatId = msg.chat.id;
    const lines = msg.text.split('\n').filter(l => l.trim());

    if (lines.length < 11) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ Format:\npopular/upcoming/webseries + 10 lines"
        })
      });
      return res.status(200).end();
    }

    const sectionInput = lines[0].toLowerCase();

    let section = null;
    if (sectionInput === 'popular') section = 'popular';
    if (sectionInput === 'upcoming') section = 'upcoming';
    if (sectionInput === 'webseries') section = 'webSeries';

    if (!section) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "❌ Use: popular / upcoming / webseries"
        })
      });
      return res.status(200).end();
    }

    const movie = {
      title: lines[1],
      year: lines[2],
      poster: lines[3],
      rating: lines[4],
      duration: lines[5],
      director: lines[6],
      language: ["Kannada"],
      quality: "WEB-DL",
      genres: lines[7].split(',').map(g => `#${g.trim()}`),
      plot: lines[8],
      streamLink: lines[9] || "#",
      telegramLink: lines[10] || "#"
    };

    // 🔹 GET FILE FROM GITHUB
    const fileRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`
      }
    });

    const fileData = await fileRes.json();
    const content = JSON.parse(Buffer.from(fileData.content, 'base64').toString());

    // 🔹 ADD MOVIE
    content[section].unshift(movie);

    // 🔹 UPDATE FILE
    await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `Added ${movie.title} to ${section}`,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        sha: fileData.sha
      })
    });

    // 🔹 SUCCESS MESSAGE
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `✅ Added to ${section}`
      })
    });

    return res.status(200).end();

  } catch (err) {
    console.log(err);

    // 🔹 ERROR MESSAGE
    await fetch(`https://api.telegram.org/botYOUR_BOT_TOKEN_HERE/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: req.body?.message?.chat?.id,
        text: "❌ Error occurred"
      })
    });

    return res.status(200).end();
  }
}
