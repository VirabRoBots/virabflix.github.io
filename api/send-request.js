export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  const { name, year, note } = req.body;

  if (!name) {
    return res.status(400).json({ success: false });
  }

  const message =
`🎬 Movie Request

Name: ${name}
Year: ${year || "N/A"}
Note: ${note || "None"}`;

  try {
    await fetch("https://api.telegram.org/bot8625032875:AAGy963USUhyALpKMQMTRqw0A45MnKD6lI0/sendMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: "-1003498341571",
        text: message
      })
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ success: false });
  }
      }
