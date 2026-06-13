# 🔬 PaperLens — Journal Paper Analyzer

A lightweight, **browser-based** tool that helps you analyze journal papers in seconds. Upload a PDF (or paste text) and instantly get structure detection, key terms, readability metrics, references, and — optionally — an AI summary powered by Claude.

No build step, no server. Just open `index.html`.

## ✨ Features

- **PDF & text input** — drag-and-drop a PDF or paste raw text. PDFs are parsed in-browser with [pdf.js](https://mozilla.github.io/pdf.js/).
- **Structure detection (IMRaD)** — finds Abstract, Introduction, Methods, Results, Discussion, Conclusion, and References, with word counts.
- **Key terms** — frequency-ranked keywords with stop-word filtering.
- **Readability metrics** — Flesch Reading Ease, Flesch–Kincaid grade level, and Gunning Fog index.
- **Reference extraction** — pulls and counts the reference list and in-text citations.
- **Highlight sentences** — surfaces the most informative sentences (contributions, findings, conclusions).
- **AI summary & Q&A (optional)** — generate a TL;DR, contributions, methods, findings, and limitations, and ask questions grounded in the paper. Works with the **Anthropic API** or any **OpenAI-compatible endpoint** (custom base URL), using your own key.
- **Export** — download a full `.md` analysis report.

## 🚀 Usage

1. Open `index.html` in any modern browser.
   - Or serve locally: `python3 -m http.server` then visit `http://localhost:8000`.
2. Drop a PDF / paste text, or click **Try a sample**.
3. Click **Analyze paper**.
4. (Optional) Open **AI Settings**, paste your Anthropic API key, and click **Generate with Claude**.

## 🤖 AI providers

Open **AI Settings** and choose a provider:

- **Anthropic (Claude):** base URL `https://api.anthropic.com`, key `sk-ant-...`, model e.g. `claude-sonnet-4-6`.
- **OpenAI-compatible:** any endpoint exposing `/chat/completions` (LiteLLM, vLLM, Ollama, gateways, etc.). Set the base URL (including `/v1`), your `Authorization: Bearer` key, and the model name.

> ⚠️ **http endpoints:** A browser will **block** requests to an `http://` API from a page served over `https://` ("mixed content"). If your endpoint is http-only, open this site over **http** (e.g. run it locally) for the AI features to work, **or** deploy the built-in proxy (below). The non-AI analysis works everywhere.

## 🔌 Using a private http endpoint via the built-in proxy (Vercel)

If your AI endpoint is `http://` on a non-standard port and you can't change it, deploy this repo to **Vercel** — it includes a serverless proxy (`api/chat/completions.js`) that calls your endpoint server-side, so the browser only talks to https.

1. Go to **vercel.com**, sign in with GitHub, **Add New → Project**, and import this repository.
2. In the project's **Settings → Environment Variables**, add:
   - `AI_TARGET_URL` = `http://211.20.245.95:21434/v1` (your endpoint, including `/v1`)
3. Deploy. You'll get a URL like `https://your-project.vercel.app`.
4. Open it → **AI Settings** → Provider **OpenAI-compatible** → **Base URL** = `/api` → paste your key → **Save**.

> This only works if your endpoint is reachable from the public internet. If it's restricted to a private/campus network, no external host (Vercel, Cloudflare, etc.) can reach it — use the Anthropic provider instead.

## 🔐 Privacy

Everything runs locally in your browser. Your paper text is **never** sent anywhere unless you explicitly use an AI feature, in which case the text is sent directly from your browser to the API you configured. Your API key is stored only in your browser's `localStorage` — it is never committed to this repo or sent anywhere else.

## ☁️ Deploy to Cloudflare Pages

This is a static site, so no build step is required.

1. Push this repo to GitHub (already done).
2. In the [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select this repository (`khanhthientkt-cell/power-ranger-`).
4. Configure the build:
   - **Production branch:** `claude/ecstatic-pascal-gmlpqf`
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
5. Click **Save and Deploy**. Every push to the production branch redeploys automatically.

Security headers (CSP, etc.) are configured in [`_headers`](./_headers).

## 🛠 Tech

Plain HTML, CSS, and vanilla JavaScript — zero dependencies to install. pdf.js is loaded from a CDN for PDF parsing.

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Markup and layout |
| `styles.css` | Styling (dark theme) |
| `app.js` | Extraction, analysis, rendering, AI integration |
