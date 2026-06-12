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
- **AI summary (optional)** — generate a TL;DR, key contributions, methods, findings, and limitations using the Claude API with your own key.
- **Export** — download a full `.md` analysis report.

## 🚀 Usage

1. Open `index.html` in any modern browser.
   - Or serve locally: `python3 -m http.server` then visit `http://localhost:8000`.
2. Drop a PDF / paste text, or click **Try a sample**.
3. Click **Analyze paper**.
4. (Optional) Open **AI Settings**, paste your Anthropic API key, and click **Generate with Claude**.

## 🔐 Privacy

Everything runs locally in your browser. Your paper text is **never** sent anywhere unless you explicitly click **Generate with Claude**, in which case the text is sent directly to the Anthropic API. Your API key is stored only in your browser's `localStorage`.

> Note: Direct browser calls to the Anthropic API require CORS to be permitted; some networks or environments may block this. The local analysis works fully offline.

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
