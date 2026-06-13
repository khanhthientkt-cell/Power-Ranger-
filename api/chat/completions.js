// Serverless proxy (Vercel) for PaperLens AI features.
//
// Why this exists:
//   A website served over https cannot call an http:// API directly
//   (browsers block "mixed content"), and Cloudflare cannot proxy
//   non-standard ports. This function runs on the server side, so it
//   CAN call your http endpoint, and the browser only ever talks to
//   this same-origin https function.
//
// Configure ONE environment variable in your Vercel project settings:
//   AI_TARGET_URL = http://211.20.245.95:21434/v1
//
// The API key is NOT stored here — it is sent from the browser in the
// Authorization header and simply forwarded on. Nothing secret lives in
// this repository.

export default async function handler(req, res) {
  // Allow the browser (any origin) to call this proxy.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const target = process.env.AI_TARGET_URL;
  if (!target) {
    return res.status(500).json({
      error: "Server not configured. Set the AI_TARGET_URL environment variable in your Vercel project (e.g. http://211.20.245.95:21434/v1).",
    });
  }

  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    const auth = req.headers.authorization;
    const upstream = await fetch(target.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: auth } : {}),
      },
      body,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: "Proxy could not reach the AI endpoint. It may not be accessible from the public internet (e.g. it is restricted to a private/campus network). Details: " + err.message,
    });
  }
}
