# 🦊 Count Quest — a math card game for little kids (ages 4–6)

**Count Quest** is a friendly, browser-based card game that teaches young children the
foundations of *quantitative thinking* — counting, recognising numbers, comparing
**more vs. fewer**, matching a numeral to a quantity, and simple adding — all through
a playful "draw a card, solve the puzzle, win a star" loop.

No reading required. **Foxy the fox reads every question out loud**, so pre-readers
can play on their own. No app store, no install, no build step — just open `index.html`.

> 🎯 Designed *with* and *for* little learners: huge tappable buttons, bright colours,
> gentle mistakes, and lots of celebration.

## ✨ What kids learn

| Puzzle type | Skill it builds |
|-------------|-----------------|
| **How many?** | Counting objects & connecting a quantity to a number |
| **Find this many** | Recognising written numerals and matching them to a group |
| **Which has more?** | Comparing quantities (greater than) |
| **Which has fewer?** | Comparing quantities (less than) |
| **All together** *(unlocks at level 4)* | Simple addition within 10 |

Difficulty scales gently with the child's level, so the puzzles always sit just above
what they've already mastered.

## 🎮 How to play

1. **Tap the card** 🎴 to draw a puzzle.
2. **Count the pictures** or pick the group with **more / fewer**.
3. **Tap the big answer** you think is right.
4. Get it right to **win a star** ⭐ and fill the progress bar.
5. Fill the bar to **LEVEL UP** 🎉 — confetti and a new badge!

Wrong answers are gentle: Foxy gives a friendly nudge and lets the child try again.

## 🚀 Run it

Just open `index.html` in any modern browser. Or serve it locally:

```bash
python3 -m http.server
# then visit http://localhost:8000
```

Works great on tablets and phones (the best device for little fingers 👆).

## 👨‍👩‍👧 For grown-ups

- **Sound** 🔊 and **Voice** 🗣️ can each be toggled on the start screen.
- Progress (stars + level) is **saved in the browser** automatically, so kids can
  pick up where they left off.
- Honours the system **reduced-motion** setting for motion-sensitive children.
- Everything runs **100% locally** — no accounts, no data collected, no internet
  needed after the first load.

## 🛠 Tech

Plain HTML, CSS, and vanilla JavaScript — **zero dependencies**. Sound effects are
synthesised with the Web Audio API and narration uses the browser's built-in speech
synthesis, so there are no media files to download.

## 📁 Files

| File | Purpose |
|------|---------|
| `index.html` | Game markup: start screen, game screen, celebration overlay |
| `styles.css` | Big, bright, kid-friendly styling |
| `app.js` | Game engine: puzzle generation, scoring, sound, voice, confetti |
| `archive/paperlens/` | The previous project that used to live here (kept for reference) |

## ☁️ Deploy (optional)

It's a static site, so it hosts anywhere — GitHub Pages, Cloudflare Pages, Netlify,
Vercel — with **no build command** and the output directory set to the repo root.
