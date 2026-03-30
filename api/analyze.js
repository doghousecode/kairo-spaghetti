export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { text, allTags, context } = req.body;

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
      messages: [{
        role: "user",
        content: `Analyse this idea. Return ONLY valid JSON, no markdown:
{"title":"max 5 word title","tags":["tag1","tag2"],"insight":"one useful sentence","connections":[]}
Rules: title=distil core concept. tags=2-4, reuse existing [${(allTags || []).join(",")}] where relevant, lowercase hyphenated. connections=indices of related ideas (max 3). insight=sharp, useful.
IDEA: "${text}"
EXISTING:\n${context || "None"}`,
      }],
    }),
  });

  const data = await response.json();
  res.status(200).json(data);
}
