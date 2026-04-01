export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { text, allTags, context, imageData } = req.body;

  // Build message content — include image block first if present
  const content = [];
  if (imageData) {
    const [header, data] = imageData.split(",");
    const mediaType = header.match(/data:([^;]+)/)?.[1] || "image/jpeg";
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data } });
  }

  const promptLine = text
    ? `Analyse this idea${imageData ? " (use the image to enrich the analysis)" : ""}. Return ONLY valid JSON, no markdown:`
    : "Analyse this image and interpret it as a new idea or concept. Return ONLY valid JSON, no markdown:";

  content.push({
    type: "text",
    text: `${promptLine}
{"title":"max 5 word title","tags":["tag1","tag2"],"insight":"one useful sentence","connections":[]}
Rules: title=distil core concept. tags=2-4, reuse existing [${(allTags || []).join(",")}] where relevant, lowercase hyphenated. connections=indices of related ideas (max 3). insight=sharp, useful.
${text ? `IDEA: "${text}"\n` : ""}EXISTING:\n${context || "None"}`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content }],
    }),
  });

  const data = await response.json();
  res.status(200).json(data);
}
