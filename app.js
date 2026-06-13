/* ============================================================
   Count Quest — math card game for kids aged 4–6
   Vanilla JS, no dependencies. Teaches: counting, number
   recognition, more/fewer, matching, and simple adding.

   Pedagogy notes (for grown-ups reading the code):
   - No reading is required. The fox mascot speaks every prompt
     aloud via the browser's speech synthesis.
   - Difficulty scales gently with the player's level so the
     child always works just above what they've mastered.
   - Mistakes are gentle: a wrong tap nudges, never punishes,
     and the right answer is then highlighted to teach.
   ============================================================ */

(() => {
  "use strict";

  // ----------------------------------------------------------
  // Picture sets — friendly, recognisable emoji for little kids
  // ----------------------------------------------------------
  const THEMES = [
    ["🍎", "🍊", "🍓", "🍌", "🍇", "🍉"],   // fruit
    ["🐶", "🐱", "🐰", "🐻", "🐸", "🐥"],   // animals
    ["🚗", "🚌", "🚂", "✈️", "🚀", "⛵"],   // vehicles
    ["⭐", "🌟", "🌈", "☀️", "🌸", "🦋"],   // nature
    ["🍪", "🧁", "🍭", "🍩", "🍬", "🎂"],   // treats
    ["⚽", "🏀", "🎈", "🪁", "🧸", "🎁"],   // toys
  ];

  const PRAISE = ["Yay!", "Great job!", "You got it!", "Woohoo!", "Super!", "Brilliant!", "High five!", "Amazing!"];
  const NUDGE  = ["Try again!", "Almost! Count slowly.", "Oops, try once more!", "So close — let's count together!"];
  const LEVEL_TITLES = ["Counting Star", "Number Hero", "Math Explorer", "Quantity Champ", "Super Counter", "Math Wizard"];
  const STARS_PER_LEVEL = 5;

  // ----------------------------------------------------------
  // Game state (persisted to localStorage)
  // ----------------------------------------------------------
  const SAVE_KEY = "countQuest.save.v1";
  const state = {
    stars: 0,        // total stars ever earned
    level: 1,        // current level (1+)
    progress: 0,     // stars earned toward the current level
    sound: true,     // sound effects on/off
    voice: true,     // spoken prompts on/off
  };

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (_) { /* ignore corrupt saves */ }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  // ----------------------------------------------------------
  // DOM helpers
  // ----------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    startScreen: $("startScreen"), gameScreen: $("gameScreen"),
    playBtn: $("playBtn"), howBtn: $("howBtn"), howModal: $("howModal"), closeHow: $("closeHow"),
    soundToggle: $("soundToggle"), voiceToggle: $("voiceToggle"), savedBadge: $("savedBadge"),
    homeBtn: $("homeBtn"), repeatBtn: $("repeatBtn"),
    starCount: $("starCount"), levelNum: $("levelNum"), progressFill: $("progressFill"),
    speechText: $("speechText"), cardSlot: $("cardSlot"), drawCard: $("drawCard"),
    answers: $("answers"),
    celebrate: $("celebrate"), celebrateBadge: $("celebrateBadge"),
    celebrateTitle: $("celebrateTitle"), celebrateText: $("celebrateText"),
    celebrateBtn: $("celebrateBtn"), confetti: $("confetti"),
  };

  let currentChallenge = null;   // the puzzle on the table
  let awaitingDraw = true;       // true when the card-back is showing

  // ----------------------------------------------------------
  // Sound effects (synthesised — no audio files needed)
  // ----------------------------------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  function tone(freq, start, dur, type = "sine", gain = 0.18) {
    if (!state.sound || !audioCtx) return;
    const t0 = audioCtx.currentTime + start;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  const sfx = {
    correct() { ensureAudio(); [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.18, "triangle")); },
    wrong()   { ensureAudio(); tone(311.13, 0, 0.18, "sawtooth", 0.12); tone(233.08, 0.12, 0.22, "sawtooth", 0.12); },
    draw()    { ensureAudio(); tone(440, 0, 0.08, "square", 0.08); tone(660, 0.06, 0.1, "square", 0.08); },
    levelUp() { ensureAudio(); [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.28, "triangle", 0.2)); },
  };

  // ----------------------------------------------------------
  // Voice (speech synthesis) — reads prompts to pre-readers
  // ----------------------------------------------------------
  function speak(text) {
    if (!state.voice || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.92;     // a touch slower for little ears
      u.pitch = 1.15;    // friendly, higher pitch
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  // Say something both in the speech bubble and out loud
  function fox(text, alsoSpeak = true) {
    el.speechText.textContent = text;
    if (alsoSpeak) speak(text);
  }

  // ----------------------------------------------------------
  // Utility
  // ----------------------------------------------------------
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Build a small set of unique number options around the answer
  function numberOptions(answer, count, max) {
    const opts = new Set([answer]);
    let guard = 0;
    while (opts.size < count && guard++ < 100) {
      const delta = rand(3) + 1;
      const cand = Math.random() < 0.5 ? answer - delta : answer + delta;
      if (cand >= 0 && cand <= max && cand !== answer) opts.add(cand);
    }
    // top up if the spread was too tight
    let n = 0;
    while (opts.size < count && n <= max) { opts.add(n); n++; }
    return shuffle([...opts]).slice(0, count);
  }

  // ----------------------------------------------------------
  // Difficulty: derived gently from level
  // ----------------------------------------------------------
  function difficulty() {
    const lvl = state.level;
    return {
      maxCount: Math.min(3 + lvl, 10),                 // biggest quantity shown
      options: lvl >= 3 ? 4 : 3,                        // number of answer choices
      allowAdd: lvl >= 4,                               // simple addition unlocks
      level: lvl,
    };
  }

  // ----------------------------------------------------------
  // Challenge generators — each returns a challenge object:
  //   { kind, prompt, render(cardEl), answers:[...], correct, answerLabel }
  // ----------------------------------------------------------
  function makeCountChallenge(d) {
    const theme = pick(THEMES);
    const item = pick(theme);
    const n = rand(Math.max(2, d.maxCount - 1)) + 1; // 1..maxCount
    const opts = numberOptions(n, d.options, d.maxCount);
    return {
      kind: "count",
      prompt: `How many ${emojiWord(item)} do you see?`,
      render(card) {
        const q = div("card-question", "How many? 🔢");
        const grid = div("count-grid");
        for (let i = 0; i < n; i++) {
          const s = document.createElement("span");
          s.className = "count-item";
          s.textContent = item;
          s.style.animationDelay = (i * 0.06) + "s";
          grid.appendChild(s);
        }
        card.append(grid, q);
      },
      answers: opts.map(String),
      correct: String(n),
    };
  }

  function makeMatchChallenge(d) {
    const theme = pick(THEMES);
    const item = pick(theme);
    const n = rand(Math.max(2, d.maxCount - 1)) + 1;
    const opts = numberOptions(n, d.options, d.maxCount);
    return {
      kind: "match",
      prompt: `Which group has exactly ${n} ${emojiWord(item)}?`,
      // Render the numeral big, answers are GROUPS of objects
      render(card) {
        card.append(div("card-question", "Find this many:"), div("big-numeral", String(n)));
      },
      groups: true,
      groupItem: item,
      groupCounts: opts.map(Number),
      correct: n,
    };
  }

  function makeCompareChallenge(d, wantMore) {
    const theme = pick(THEMES);
    const item = pick(theme);
    let a = rand(d.maxCount) + 1, b = rand(d.maxCount) + 1;
    while (a === b) b = rand(d.maxCount) + 1;          // never a tie
    return {
      kind: wantMore ? "more" : "fewer",
      prompt: wantMore
        ? `Which group has MORE ${emojiWord(item)}?`
        : `Which group has FEWER ${emojiWord(item)}?`,
      render(card) {
        card.append(div("card-question", wantMore ? "Which has MORE? 🔼" : "Which has FEWER? 🔽"));
      },
      groups: true,
      groupItem: item,
      groupCounts: [a, b],
      correct: wantMore ? Math.max(a, b) : Math.min(a, b),
    };
  }

  function makeAddChallenge(d) {
    const theme = pick(THEMES);
    const item = pick(theme);
    const a = rand(4) + 1;                              // 1..4
    const b = rand(Math.min(4, d.maxCount - a)) + 1;   // keep total small
    const total = a + b;
    const opts = numberOptions(total, d.options, Math.min(10, d.maxCount + 2));
    return {
      kind: "add",
      prompt: `${a} ${emojiWord(item)} and ${b} more. How many all together?`,
      render(card) {
        card.append(div("card-question", "How many all together? ➕"));
        const row = document.createElement("div");
        row.className = "group-row";
        row.style.pointerEvents = "none";
        row.append(emojiBox(item, a), plus(), emojiBox(item, b));
        card.append(row);
      },
      answers: opts.map(String),
      correct: String(total),
    };
  }

  // Choose which kind of challenge to deal, based on level
  function dealChallenge() {
    const d = difficulty();
    const bag = ["count", "count", "match", "more", "fewer"];
    if (d.allowAdd) bag.push("add", "add");
    const kind = pick(bag);
    switch (kind) {
      case "match":  return makeMatchChallenge(d);
      case "more":   return makeCompareChallenge(d, true);
      case "fewer":  return makeCompareChallenge(d, false);
      case "add":    return makeAddChallenge(d);
      default:       return makeCountChallenge(d);
    }
  }

  // ----------------------------------------------------------
  // Small DOM builders
  // ----------------------------------------------------------
  function div(cls, text) {
    const d = document.createElement("div");
    d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }
  function plus() {
    const s = document.createElement("span");
    s.className = "plus-sign";
    s.textContent = "+";
    return s;
  }
  function emojiBox(item, count) {
    const box = div("group-box");
    for (let i = 0; i < count; i++) {
      const s = document.createElement("span");
      s.className = "count-item";
      s.textContent = item;
      s.style.animationDelay = (i * 0.05) + "s";
      box.appendChild(s);
    }
    return box;
  }
  // Rough singular→spoken word for the voice prompt (keeps it natural-ish)
  function emojiWord(_item) { return "pictures"; }

  // ----------------------------------------------------------
  // Rendering a dealt challenge
  // ----------------------------------------------------------
  function showChallenge(ch) {
    currentChallenge = ch;
    awaitingDraw = false;

    // Build the card
    const card = document.createElement("div");
    card.className = "quest-card";
    ch.render(card);
    el.cardSlot.replaceChildren(card);

    // Build answers
    el.answers.replaceChildren();
    if (ch.groups) {
      renderGroupAnswers(ch);
    } else {
      renderButtonAnswers(ch);
    }

    fox(ch.prompt);
    sfx.draw();
  }

  function renderButtonAnswers(ch) {
    ch.answers.forEach((label) => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => handleAnswer(btn, label === ch.correct, ch));
      el.answers.appendChild(btn);
    });
  }

  function renderGroupAnswers(ch) {
    // For match/more/fewer, the answers ARE the groups of objects.
    const row = document.createElement("div");
    row.className = "group-row";
    const counts = ch.groupCounts;
    counts.forEach((c) => {
      const box = emojiBox(ch.groupItem, c);
      box.setAttribute("role", "button");
      box.tabIndex = 0;
      const isRight = c === ch.correct;
      const handler = () => handleGroupAnswer(box, isRight, ch);
      box.addEventListener("click", handler);
      box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") handler(); });
      row.appendChild(box);
    });
    // Group puzzles live inside the answers area as one row
    el.answers.style.gridTemplateColumns = "1fr";
    el.answers.appendChild(row);
  }

  // ----------------------------------------------------------
  // Answering
  // ----------------------------------------------------------
  let locked = false;

  function handleAnswer(btn, isRight, ch) {
    if (locked) return;
    if (isRight) {
      locked = true;
      btn.classList.add("right");
      [...el.answers.children].forEach((b) => { if (b !== btn) b.classList.add("dim"); b.disabled = true; });
      onCorrect();
    } else {
      btn.classList.add("wrong");
      sfx.wrong();
      fox(pick(NUDGE));
      setTimeout(() => btn.classList.remove("wrong"), 450);
    }
  }

  function handleGroupAnswer(box, isRight, ch) {
    if (locked) return;
    if (isRight) {
      locked = true;
      box.classList.add("right");
      onCorrect();
    } else {
      box.classList.add("wrong");
      sfx.wrong();
      fox(pick(NUDGE));
      setTimeout(() => box.classList.remove("wrong"), 450);
    }
  }

  function onCorrect() {
    sfx.correct();
    state.stars += 1;
    state.progress += 1;
    fox(pick(PRAISE) + " ⭐");
    updateHud();

    const leveledUp = state.progress >= STARS_PER_LEVEL;
    if (leveledUp) {
      state.level += 1;
      state.progress = 0;
    }
    save();

    setTimeout(() => {
      locked = false;
      if (leveledUp) {
        celebrate();
      } else {
        resetToDraw("Tap the card for the next puzzle! 🎴", false);
      }
    }, 1100);
  }

  // ----------------------------------------------------------
  // HUD + progress
  // ----------------------------------------------------------
  function updateHud() {
    el.starCount.textContent = state.stars;
    el.levelNum.textContent = state.level;
    const pct = Math.round((state.progress / STARS_PER_LEVEL) * 100);
    el.progressFill.style.width = pct + "%";
  }

  // ----------------------------------------------------------
  // Draw flow
  // ----------------------------------------------------------
  function resetToDraw(message, speakIt) {
    awaitingDraw = true;
    currentChallenge = null;
    el.answers.replaceChildren();
    el.answers.style.gridTemplateColumns = "";
    const back = document.createElement("button");
    back.className = "quest-card card-back";
    back.setAttribute("aria-label", "Draw a card");
    back.innerHTML = '<span class="card-back-art">🎴</span><span class="card-back-text">Tap to draw</span>';
    back.addEventListener("click", drawNow);
    el.cardSlot.replaceChildren(back);
    if (message) fox(message, !!speakIt);
  }

  function drawNow() {
    if (!awaitingDraw) return;
    ensureAudio();
    showChallenge(dealChallenge());
  }

  // ----------------------------------------------------------
  // Celebration / level up
  // ----------------------------------------------------------
  function celebrate() {
    const title = LEVEL_TITLES[(state.level - 2 + LEVEL_TITLES.length) % LEVEL_TITLES.length];
    const badges = ["🏆", "🥇", "🌟", "🎖️", "👑", "💎"];
    el.celebrateBadge.textContent = pick(badges);
    el.celebrateTitle.textContent = "Level " + state.level + "!";
    el.celebrateText.textContent = "You're a " + title + "! 🎉";
    el.celebrate.classList.remove("hidden");
    el.celebrate.setAttribute("aria-hidden", "false");
    sfx.levelUp();
    speak("Level up! You're a " + title + "!");
    runConfetti();
  }

  function closeCelebrate() {
    stopConfetti();
    el.celebrate.classList.add("hidden");
    el.celebrate.setAttribute("aria-hidden", "true");
    resetToDraw("New level! Tap the card to keep playing! 🎴", true);
  }

  // ----------------------------------------------------------
  // Confetti (canvas)
  // ----------------------------------------------------------
  let confettiRAF = null, confettiPieces = [];
  function runConfetti() {
    const canvas = el.confetti;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    const colors = ["#ffd166", "#ff8fab", "#74c0fc", "#69db7c", "#b197fc", "#ffe066"];
    confettiPieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height,
      r: 5 + Math.random() * 8,
      c: pick(colors),
      vy: 2 + Math.random() * 3,
      vx: -1.5 + Math.random() * 3,
      rot: Math.random() * Math.PI,
      vr: -0.15 + Math.random() * 0.3,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      confettiPieces.forEach((p) => {
        p.y += p.vy; p.x += p.vx; p.rot += p.vr;
        if (p.y > canvas.height + 20) p.y = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      });
      confettiRAF = requestAnimationFrame(draw);
    };
    draw();
  }
  function stopConfetti() {
    if (confettiRAF) cancelAnimationFrame(confettiRAF);
    confettiRAF = null;
    const ctx = el.confetti.getContext("2d");
    ctx && ctx.clearRect(0, 0, el.confetti.width, el.confetti.height);
  }

  // ----------------------------------------------------------
  // Screen navigation
  // ----------------------------------------------------------
  function startGame() {
    ensureAudio();
    el.startScreen.classList.add("hidden");
    el.gameScreen.classList.remove("hidden");
    updateHud();
    resetToDraw("Tap the card to draw your first puzzle! 🎴", true);
  }
  function goHome() {
    window.speechSynthesis && window.speechSynthesis.cancel();
    el.gameScreen.classList.add("hidden");
    el.startScreen.classList.remove("hidden");
    refreshStartBadge();
  }
  function refreshStartBadge() {
    if (state.stars > 0) {
      el.savedBadge.classList.remove("hidden");
      el.savedBadge.textContent = `⭐ ${state.stars} stars • Level ${state.level} — welcome back!`;
    } else {
      el.savedBadge.classList.add("hidden");
    }
  }

  // ----------------------------------------------------------
  // Settings toggles
  // ----------------------------------------------------------
  function refreshToggles() {
    el.soundToggle.textContent = state.sound ? "🔊 Sound: On" : "🔇 Sound: Off";
    el.soundToggle.setAttribute("aria-pressed", String(state.sound));
    el.voiceToggle.textContent = state.voice ? "🗣️ Voice: On" : "🤐 Voice: Off";
    el.voiceToggle.setAttribute("aria-pressed", String(state.voice));
  }

  // ----------------------------------------------------------
  // Wire up events
  // ----------------------------------------------------------
  function init() {
    load();
    refreshToggles();
    refreshStartBadge();

    el.playBtn.addEventListener("click", startGame);
    el.homeBtn.addEventListener("click", goHome);
    el.repeatBtn.addEventListener("click", () => {
      if (currentChallenge) speak(currentChallenge.prompt);
      else speak("Tap the card to draw a puzzle!");
    });

    // The initial draw card (start screen -> first render uses resetToDraw,
    // but the static one in HTML also needs to work if tapped early)
    el.drawCard && el.drawCard.addEventListener("click", drawNow);

    el.howBtn.addEventListener("click", () => el.howModal.classList.remove("hidden"));
    el.closeHow.addEventListener("click", () => el.howModal.classList.add("hidden"));
    el.howModal.addEventListener("click", (e) => { if (e.target === el.howModal) el.howModal.classList.add("hidden"); });

    el.soundToggle.addEventListener("click", () => { state.sound = !state.sound; save(); refreshToggles(); if (state.sound) { ensureAudio(); sfx.draw(); } });
    el.voiceToggle.addEventListener("click", () => { state.voice = !state.voice; save(); refreshToggles(); if (state.voice) speak("Hi! I'm Foxy. Let's count together!"); });

    el.celebrateBtn.addEventListener("click", closeCelebrate);
    el.celebrate.addEventListener("click", (e) => { if (e.target === el.celebrate) closeCelebrate(); });

    window.addEventListener("resize", () => {
      if (confettiRAF) { el.confetti.width = window.innerWidth; el.confetti.height = window.innerHeight; }
    });

    // Warm up speech voices (some browsers load them async)
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
