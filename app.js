/* ============================================================
   Foxy's Tiny Lab — Count Quest
   A cute science game for kids aged 4–6 that turns big
   QUANTITATIVE RESEARCH ideas into tiny, simple experiments.

   Each "card" is a mini-experiment. The hidden curriculum:
     • Guess & Check ...... hypothesis → measure → conclude
     • How many? .......... counting / data collection
     • Sort & Count ....... categorical variables
     • Friend Survey ...... bar charts (data visualization) + mode
     • Most / Fewest ...... comparing groups
     • Pattern Detective .. patterns / trends
     • Fair Share ......... the average (mean) as fair sharing
     • Lucky Bag .......... chance / probability

   Foxy narrates everything in kid words so pre-readers can play
   alone. The whole point: make complex things feel simple. 💛
   ============================================================ */

(() => {
  "use strict";

  // ---------- picture sets ----------
  const THEMES = [
    ["🍎","🍊","🍓","🍌","🍇","🍉","🍑","🥝"],
    ["🐶","🐱","🐰","🐻","🐸","🐥","🦊","🐼"],
    ["🚗","🚌","🚂","✈️","🚀","⛵","🚲","🚒"],
    ["⭐","🌈","☀️","🌸","🦋","🌷","🐚","🍀"],
    ["🍪","🧁","🍭","🍩","🍬","🎂","🍦","🍫"],
    ["⚽","🏀","🎈","🪁","🧸","🎁","🎨","🪀"],
  ];
  const COLORS = [
    { e: "🔴", name: "red" }, { e: "🔵", name: "blue" },
    { e: "🟡", name: "yellow" }, { e: "🟢", name: "green" },
    { e: "🟣", name: "purple" }, { e: "🟠", name: "orange" },
  ];
  const STICKERS = ["🦊","🌟","🦄","🐢","🦖","🐙","🦜","🌻","🍉","🚀","🎈","🐳","🦋","🐝","🌈","🦩","🐧","🍓","🎀","🪐"];

  const PRAISE = ["Yay!","Great job!","You did it!","Woohoo!","Super!","Brilliant!","High five!","Amazing!","Wonderful!"];
  const NUDGE  = ["Try again!","Almost! Look closely.","Oops — let's try once more!","So close!"];
  const LEVEL_TITLES = ["Tiny Scientist","Lab Explorer","Data Detective","Chart Champion","Discovery Star","Junior Genius"];
  const STARS_PER_LEVEL = 5;

  // ---------- state ----------
  const SAVE_KEY = "foxyLab.save.v1";
  const state = { stars: 0, level: 1, progress: 0, sound: true, voice: true, stickers: [] };

  function load() { try { const r = localStorage.getItem(SAVE_KEY); if (r) Object.assign(state, JSON.parse(r)); } catch (_) {} }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {} }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    startScreen:$("startScreen"), gameScreen:$("gameScreen"),
    playBtn:$("playBtn"), howBtn:$("howBtn"), howModal:$("howModal"), closeHow:$("closeHow"),
    stickersBtn:$("stickersBtn"), stickerModal:$("stickerModal"), closeStickers:$("closeStickers"), stickerGrid:$("stickerGrid"),
    soundToggle:$("soundToggle"), voiceToggle:$("voiceToggle"), savedBadge:$("savedBadge"),
    homeBtn:$("homeBtn"), repeatBtn:$("repeatBtn"), modeBadge:$("modeBadge"),
    starCount:$("starCount"), levelNum:$("levelNum"), progressFill:$("progressFill"),
    speechText:$("speechText"), cardSlot:$("cardSlot"), drawCard:$("drawCard"), answers:$("answers"),
    celebrate:$("celebrate"), celebrateBadge:$("celebrateBadge"), celebrateTitle:$("celebrateTitle"),
    celebrateText:$("celebrateText"), celebrateBtn:$("celebrateBtn"), confetti:$("confetti"),
    celebrateSticker:$("celebrateSticker"), newSticker:$("newSticker"),
  };

  let current = null;      // current challenge
  let awaitingDraw = true;
  let locked = false;

  // ---------- sound (synthesised) ----------
  let actx = null;
  function ensureAudio() { if (!actx) { try { actx = new (window.AudioContext||window.webkitAudioContext)(); } catch (_) { actx=null; } } if (actx && actx.state==="suspended") actx.resume(); }
  function tone(freq, start, dur, type="sine", gain=0.16) {
    if (!state.sound || !actx) return;
    const t0 = actx.currentTime + start, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0+dur+0.02);
  }
  const sfx = {
    correct(){ ensureAudio(); [523.25,659.25,783.99].forEach((f,i)=>tone(f,i*0.09,0.18,"triangle")); },
    wrong(){ ensureAudio(); tone(311,0,0.18,"sawtooth",0.1); tone(233,0.12,0.22,"sawtooth",0.1); },
    draw(){ ensureAudio(); tone(440,0,0.08,"square",0.07); tone(660,0.06,0.1,"square",0.07); },
    pop(){ ensureAudio(); tone(880,0,0.06,"triangle",0.08); },
    levelUp(){ ensureAudio(); [523,659,784,1047].forEach((f,i)=>tone(f,i*0.12,0.28,"triangle",0.18)); },
  };

  // ---------- voice ----------
  function speak(text) {
    if (!state.voice || !("speechSynthesis" in window)) return;
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate=0.92; u.pitch=1.2; u.lang="en-US"; window.speechSynthesis.speak(u); } catch (_) {}
  }
  function fox(text, alsoSpeak=true) { el.speechText.textContent = text; if (alsoSpeak) speak(text); }

  // ---------- utils ----------
  const rand = (n) => Math.floor(Math.random()*n);
  const pick = (a) => a[rand(a.length)];
  function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; }
  function pickN(a,n){ return shuffle(a).slice(0,n); }
  function numberOptions(answer,count,max){
    const o=new Set([answer]); let g=0;
    while(o.size<count && g++<100){ const d=rand(3)+1; const c=Math.random()<0.5?answer-d:answer+d; if(c>=0&&c<=max&&c!==answer) o.add(c); }
    let n=0; while(o.size<count && n<=max){ o.add(n); n++; }
    return shuffle([...o]).slice(0,count);
  }
  function div(cls,text){ const d=document.createElement("div"); d.className=cls; if(text!=null) d.textContent=text; return d; }
  function span(cls,text){ const s=document.createElement("span"); s.className=cls; if(text!=null) s.textContent=text; return s; }
  function items(item,n,cls="count-item"){ const f=document.createDocumentFragment(); for(let i=0;i<n;i++){ const s=span(cls,item); s.style.animationDelay=(i*0.05)+"s"; f.appendChild(s);} return f; }

  // ---------- difficulty ----------
  function diff(){ const l=state.level; return { l, maxN: Math.min(4+l,12), opts: l>=3?4:3 }; }

  /* ============================================================
     EXPERIMENT (challenge) GENERATORS
     Each returns: { name, badge, question, tip, scene(card),
                     layout, options:[{build(node),correct,count?}],
                     reveal? }
     ============================================================ */

  // 1) How many? — counting / data
  function expCount(d){
    const item = pick(pick(THEMES));
    const n = rand(Math.min(6,d.maxN-1))+1;
    return {
      name:"Count it!", badge:"🔢 Counting",
      question:`How many ${item} ?`, tip:"Counting is how scientists collect data!",
      scene(card){ const g=div("count-grid"); g.appendChild(items(item,n,"count-item jelly")); card.append(div("card-question","How many?"), g); },
      layout:"grid",
      options: numberOptions(n,d.opts,Math.min(9,d.maxN)).map(v=>({ text:String(v), correct:v===n })),
    };
  }

  // 2) Most / Fewest — comparing groups
  function expCompare(d){
    const more = Math.random()<0.5;
    const item = pick(pick(THEMES));
    let a=rand(Math.min(7,d.maxN))+1, b=rand(Math.min(7,d.maxN))+1; while(a===b) b=rand(Math.min(7,d.maxN))+1;
    const correct = more?Math.max(a,b):Math.min(a,b);
    return {
      name: more?"More!":"Fewer!", badge: more?"🔼 Compare":"🔽 Compare",
      question: more?"Which has MORE?":"Which has FEWER?", tip:"Comparing groups — that's data too!",
      scene(card){ card.append(div("card-question", more?"Which has MORE? 🔼":"Which has FEWER? 🔽")); },
      layout:"row",
      options: [a,b].map(c=>({ box:true, count:c, correct:c===correct, item })),
    };
  }

  // 3) Guess & Check — hypothesis → measure → conclude
  function expGuess(d){
    const item = pick(pick(THEMES));
    let a=rand(Math.min(8,d.maxN))+2, b=rand(Math.min(8,d.maxN))+2; while(a===b) b=rand(Math.min(8,d.maxN))+2;
    const correct = Math.max(a,b);
    return {
      name:"Guess & Check", badge:"🔮 Guess → Find out",
      question:"Guess which jar has MORE!", tip:"Scientists guess first, then count to know for sure!",
      scene(card){ card.append(div("card-question","🔮 Which jar has MORE?"), div("card-sub","Guess… then we count!")); },
      layout:"row",
      jars:true,
      options: [a,b].map(c=>({ jar:true, count:c, correct:c===correct, item })),
      revealMsg(){ return `Let's count! ${a} and ${b}. Now we KNOW! 🔍`; },
    };
  }

  // 4) Sort & Count — categorical variables
  function expSort(d){
    const theme = pick(THEMES);
    const [target, other1, other2] = pickN(theme,3);
    const t = rand(4)+2;                 // 2..5 of target
    const o1 = rand(3)+1, o2 = rand(2)+1;
    const mix = shuffle([ ...Array(t).fill(target), ...Array(o1).fill(other1), ...Array(o2).fill(other2) ]);
    return {
      name:"Sort & Count", badge:"🗂️ Sort & count",
      question:`How many ${target} ?`, tip:"Sorting into groups helps us count each kind!",
      scene(card){ const g=div("count-grid"); mix.forEach((m,i)=>{ const s=span("count-item",m); s.style.animationDelay=(i*0.04)+"s"; g.appendChild(s); }); card.append(div("card-question",`Find the ${target} — how many?`), g); },
      layout:"grid",
      options: numberOptions(t,d.opts,8).map(v=>({ text:String(v), correct:v===t })),
    };
  }

  // 5) Friend Survey — bar chart (data viz) + mode
  function expSurvey(d){
    const theme = pick(THEMES);
    const cats = pickN(theme,3);
    const mostMode = Math.random()<0.6;  // most-common (mode) most of the time
    let counts;
    do { counts = cats.map(()=>rand(5)+1); } while (new Set(counts).size<3); // all distinct → clear winner
    const target = mostMode ? Math.max(...counts) : Math.min(...counts);
    return {
      name:"Friend Survey", badge:"📊 Chart",
      question: mostMode?"Which got the MOST votes? 🏆":"Which got the FEWEST votes?",
      tip:"This is a chart! Longer means more. Scientists read charts to see data fast!",
      scene(card){ card.append(div("card-question","🗳️ Our friends voted!"), div("card-sub", mostMode?"Tap the one with the MOST":"Tap the one with the FEWEST")); },
      layout:"col",
      options: cats.map((c,i)=>({ bar:true, item:c, count:counts[i], correct:counts[i]===target })),
    };
  }

  // 6) Pattern Detective — patterns / trends
  function expPattern(d){
    const theme = pick(THEMES);
    const kinds = [
      ()=>{ const [a,b]=pickN(theme,2); return { seq:[a,b,a,b,a], next:b, choices:[a,b,pick(theme)] }; },           // ABAB?
      ()=>{ const [a,b]=pickN(theme,2); return { seq:[a,a,b,a,a], next:b, choices:[a,b,pick(theme)] }; },           // AAB AA?
      ()=>{ const [a,b,c]=pickN(theme,3); return { seq:[a,b,c,a,b], next:c, choices:[a,b,c] }; },                   // ABCAB?
    ];
    const p = pick(kinds)();
    const choices = shuffle([...new Set([...p.choices, p.next])]).slice(0,3);
    if(!choices.includes(p.next)) choices[0]=p.next;
    return {
      name:"Pattern Detective", badge:"🔁 Pattern",
      question:"What comes next?", tip:"Finding patterns is how scientists spot trends!",
      scene(card){ const row=div("pattern-row"); p.seq.forEach((m,i)=>{ const s=span("count-item",m); s.style.animationDelay=(i*0.06)+"s"; row.appendChild(s); }); row.appendChild(span("pattern-q","❓")); card.append(div("card-question","🔁 What comes next?"), row); },
      layout:"row",
      options: shuffle(choices).map(c=>({ emojiBtn:c, correct:c===p.next })),
    };
  }

  // 7) Fair Share — the average (mean) as equal sharing
  function expShare(d){
    const m = rand(2)+2;          // 2..3 friends
    const k = rand(3)+1;          // 1..3 each
    const total = m*k;
    const friend = pick(["🐰","🐻","🐱","🐶","🐼"]);
    const treat = pick(["🍪","🍬","🍭","🧁","🍎"]);
    return {
      name:"Fair Share", badge:"🍪 Share equally",
      question:`Share ${total} ${treat} fairly between ${m} ${friend}. How many each?`,
      tip:"Sharing equally is just like finding the average!",
      scene(card){
        card.append(div("card-question",`Share fairly! 🤝`));
        const top=div("count-grid"); top.appendChild(items(treat,total,"count-item jelly"));
        const fr=div("count-grid"); fr.appendChild(items(friend,m,"count-item"));
        card.append(top, div("card-sub",`between these ${m} friends:`), fr);
      },
      layout:"grid",
      options: numberOptions(k,3,6).map(v=>({ text:String(v), correct:v===k })),
    };
  }

  // 8) Lucky Bag — chance / probability
  function expChance(d){
    const [c1,c2] = pickN(COLORS,2);
    let maj=rand(4)+3, min=rand(2)+1; if(min>=maj) min=maj-1; // maj clearly bigger
    const bigger = c1; const smaller = c2;
    const contents = shuffle([ ...Array(maj).fill(bigger.e), ...Array(min).fill(smaller.e) ]);
    return {
      name:"Lucky Bag", badge:"🎲 Chance",
      question:`If Foxy picks without looking, which color is MORE likely?`,
      tip:"More of a color means it's more likely! That's chance.",
      scene(card){
        const stage=div("bag-stage"); stage.appendChild(span("bag-emoji","🎒"));
        const cc=div("bag-contents"); contents.forEach((m,i)=>{ const s=span("count-item",m); s.style.animationDelay=(i*0.04)+"s"; cc.appendChild(s); }); stage.appendChild(cc);
        card.append(div("card-question","🎲 Which is MORE likely?"), stage);
      },
      layout:"row",
      options: shuffle([{col:bigger,correct:true},{col:smaller,correct:false}]).map(o=>({ colorBox:o.col, correct:o.correct })),
    };
  }

  // pick an experiment based on level (unlock gradually)
  function dealExperiment(){
    const d = diff();
    const bag = ["count","compare","guess","sort"];
    if (d.l>=2) bag.push("survey");
    if (d.l>=3) bag.push("pattern","survey");
    if (d.l>=4) bag.push("share","chance");
    if (d.l>=5) bag.push("chance","pattern");
    switch (pick(bag)) {
      case "compare": return expCompare(d);
      case "guess":   return expGuess(d);
      case "sort":    return expSort(d);
      case "survey":  return expSurvey(d);
      case "pattern": return expPattern(d);
      case "share":   return expShare(d);
      case "chance":  return expChance(d);
      default:        return expCount(d);
    }
  }

  /* ============================================================
     RENDERING + ANSWERING
     ============================================================ */
  function showExperiment(ch){
    current = ch; awaitingDraw = false; locked = false; ch._revealed = false;
    el.modeBadge.textContent = "🧪 " + ch.name;

    const card = document.createElement("div");
    card.className = "quest-card";
    ch.scene(card);
    el.cardSlot.replaceChildren(card);

    el.answers.className = "answers " + (ch.layout || "grid");
    el.answers.replaceChildren();
    ch._nodes = [];

    ch.options.forEach((opt) => {
      const node = buildOption(opt);
      ch._nodes.push({ opt, node });
      const handler = () => choose(opt, node, ch);
      node.addEventListener("click", handler);
      node.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); handler(); }});
      el.answers.appendChild(node);
    });

    fox(ch.question);
    sfx.draw();
  }

  function buildOption(opt){
    // plain number/text button
    if (opt.text != null){ const b=document.createElement("button"); b.className="answer-btn"; b.textContent=opt.text; return b; }
    // single big emoji button (pattern)
    if (opt.emojiBtn){ const b=document.createElement("button"); b.className="answer-btn"; b.style.fontSize="clamp(40px,11vw,60px)"; b.textContent=opt.emojiBtn; return b; }
    // color choice box (chance)
    if (opt.colorBox){ const box=mkBox(); box.appendChild(span("count-item",opt.colorBox.e)); box.appendChild(div("card-sub",opt.colorBox.name)); return box; }
    // jar (guess) — hidden count
    if (opt.jar){ const box=mkBox(); box.appendChild(span("jar","🫙")); const c=div("jar-count hidden-q","?"); box._count=c; box.appendChild(c); return box; }
    // picture group box (compare/match)
    if (opt.box){ const box=mkBox(); const pi=div("pick-items"); pi.appendChild(items(opt.item,opt.count)); box.appendChild(pi); return box; }
    // bar chart row (survey)
    if (opt.bar){ const row=div("bar-row"); row.tabIndex=0; row.setAttribute("role","button"); row.appendChild(span("bar-label",opt.item)); const fill=div("bar-fill"); for(let i=0;i<opt.count;i++){ const c=span("bar-cell",opt.item); c.style.animationDelay=(i*0.05)+"s"; fill.appendChild(c);} row.appendChild(fill); return row; }
    return mkBox();
  }
  function mkBox(){ const b=div("pick-box"); b.tabIndex=0; b.setAttribute("role","button"); return b; }

  function choose(opt, node, ch){
    if (locked) return;

    // Guess & Check: first tap reveals the counts (the "measurement"), teaching verify-by-data
    if (ch.jars && !ch._revealed){
      ch._revealed = true;
      ch._nodes.forEach(({opt:o,node:n})=>{ if(n._count){ n._count.classList.remove("hidden-q"); n._count.textContent=String(o.count); sfx.pop(); }});
      if (ch.revealMsg) fox(ch.revealMsg());
    }

    if (opt.correct){
      locked = true;
      node.classList.add("right");
      ch._nodes.forEach(({node:n})=>{ if(n!==node){ n.classList.add("dim"); } });
      onCorrect(ch);
    } else {
      node.classList.add("wrong");
      sfx.wrong();
      fox(pick(NUDGE));
      setTimeout(()=>node.classList.remove("wrong"), 450);
    }
  }

  function onCorrect(ch){
    sfx.correct();
    state.stars += 1; state.progress += 1;
    fox(pick(PRAISE) + " ⭐ " + (ch.tip||""));
    updateHud();

    const leveled = state.progress >= STARS_PER_LEVEL;
    let newSticker = null;
    if (leveled){ state.level += 1; state.progress = 0; newSticker = grantSticker(); }
    save();

    setTimeout(()=>{ if (leveled) celebrate(newSticker); else resetToDraw("Tap the card for a new experiment! 🎴", false); }, 1300);
  }

  function grantSticker(){
    const left = STICKERS.filter(s=>!state.stickers.includes(s));
    const s = left.length ? pick(left) : pick(STICKERS);
    if (!state.stickers.includes(s)) state.stickers.push(s);
    return s;
  }

  // ---------- HUD ----------
  function updateHud(){
    el.starCount.textContent = state.stars;
    el.levelNum.textContent = state.level;
    el.progressFill.style.width = Math.round((state.progress/STARS_PER_LEVEL)*100) + "%";
  }

  // ---------- draw flow ----------
  function resetToDraw(msg, speakIt){
    awaitingDraw = true; current = null; locked = false;
    el.modeBadge.textContent = "🧪 New experiment?";
    el.answers.className = "answers"; el.answers.replaceChildren();
    const back = document.createElement("button");
    back.className = "quest-card card-back"; back.setAttribute("aria-label","Draw an experiment card");
    back.appendChild(span("card-back-art","🎴")); back.appendChild(span("card-back-text","Tap to explore"));
    back.addEventListener("click", drawNow);
    el.cardSlot.replaceChildren(back);
    if (msg) fox(msg, !!speakIt);
  }
  function drawNow(){ if(!awaitingDraw) return; ensureAudio(); showExperiment(dealExperiment()); }

  // ---------- celebration ----------
  function celebrate(newSticker){
    const title = LEVEL_TITLES[(state.level-2+LEVEL_TITLES.length)%LEVEL_TITLES.length];
    el.celebrateBadge.textContent = pick(["🏆","🥇","🌟","🎖️","👑","💎","🔬"]);
    el.celebrateTitle.textContent = "Level " + state.level + "!";
    el.celebrateText.textContent = "You're a " + title + "! 🎉";
    if (newSticker){ el.celebrateSticker.classList.remove("hidden"); el.newSticker.textContent = newSticker; }
    else el.celebrateSticker.classList.add("hidden");
    el.celebrate.classList.remove("hidden"); el.celebrate.setAttribute("aria-hidden","false");
    sfx.levelUp(); speak("Level up! You're a " + title + "! You earned a new sticker!");
    runConfetti();
  }
  function closeCelebrate(){ stopConfetti(); el.celebrate.classList.add("hidden"); el.celebrate.setAttribute("aria-hidden","true"); resetToDraw("New level! Tap the card to keep exploring! 🎴", true); }

  // ---------- confetti ----------
  let raf=null, pieces=[];
  function runConfetti(){
    const cv=el.confetti, ctx=cv.getContext("2d");
    cv.width=window.innerWidth; cv.height=window.innerHeight;
    const cols=["#ffd166","#ff7eb6","#7dd3fc","#86efac","#a78bfa","#fef08a"];
    pieces=Array.from({length:130},()=>({x:Math.random()*cv.width,y:-20-Math.random()*cv.height,r:5+Math.random()*8,c:pick(cols),vy:2+Math.random()*3,vx:-1.5+Math.random()*3,rot:Math.random()*Math.PI,vr:-0.15+Math.random()*0.3}));
    const draw=()=>{ ctx.clearRect(0,0,cv.width,cv.height); pieces.forEach(p=>{ p.y+=p.vy; p.x+=p.vx; p.rot+=p.vr; if(p.y>cv.height+20) p.y=-20; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.6); ctx.restore(); }); raf=requestAnimationFrame(draw); };
    draw();
  }
  function stopConfetti(){ if(raf) cancelAnimationFrame(raf); raf=null; const ctx=el.confetti.getContext("2d"); ctx&&ctx.clearRect(0,0,el.confetti.width,el.confetti.height); }

  // ---------- navigation ----------
  function startGame(){ ensureAudio(); el.startScreen.classList.add("hidden"); el.gameScreen.classList.remove("hidden"); updateHud(); resetToDraw("Tap the card to start your first experiment! 🎴", true); }
  function goHome(){ window.speechSynthesis && window.speechSynthesis.cancel(); el.gameScreen.classList.add("hidden"); el.startScreen.classList.remove("hidden"); refreshStartBadge(); }
  function refreshStartBadge(){ if(state.stars>0){ el.savedBadge.classList.remove("hidden"); el.savedBadge.textContent=`⭐ ${state.stars} stars • Level ${state.level} • ${state.stickers.length} stickers`; } else el.savedBadge.classList.add("hidden"); }

  // ---------- sticker book ----------
  function openStickers(){
    el.stickerGrid.replaceChildren();
    STICKERS.forEach(s=>{ const got=state.stickers.includes(s); const c=div("sticker-cell "+(got?"got":"empty"), got?s:"❔"); el.stickerGrid.appendChild(c); });
    el.stickerModal.classList.remove("hidden");
  }

  // ---------- settings ----------
  function refreshToggles(){
    el.soundToggle.textContent = state.sound?"🔊 Sound":"🔇 Sound"; el.soundToggle.setAttribute("aria-pressed",String(state.sound));
    el.voiceToggle.textContent = state.voice?"🗣️ Voice":"🤐 Voice"; el.voiceToggle.setAttribute("aria-pressed",String(state.voice));
  }

  // ---------- init ----------
  function init(){
    load(); refreshToggles(); refreshStartBadge();

    el.playBtn.addEventListener("click", startGame);
    el.homeBtn.addEventListener("click", goHome);
    el.repeatBtn.addEventListener("click", ()=>{ if(current) speak(current.question + " " + (current.tip||"")); else speak("Tap the card to start an experiment!"); });
    el.drawCard && el.drawCard.addEventListener("click", drawNow);

    el.howBtn.addEventListener("click", ()=>el.howModal.classList.remove("hidden"));
    el.closeHow.addEventListener("click", ()=>el.howModal.classList.add("hidden"));
    el.howModal.addEventListener("click", e=>{ if(e.target===el.howModal) el.howModal.classList.add("hidden"); });

    el.stickersBtn.addEventListener("click", openStickers);
    el.closeStickers.addEventListener("click", ()=>el.stickerModal.classList.add("hidden"));
    el.stickerModal.addEventListener("click", e=>{ if(e.target===el.stickerModal) el.stickerModal.classList.add("hidden"); });

    el.soundToggle.addEventListener("click", ()=>{ state.sound=!state.sound; save(); refreshToggles(); if(state.sound){ ensureAudio(); sfx.draw(); }});
    el.voiceToggle.addEventListener("click", ()=>{ state.voice=!state.voice; save(); refreshToggles(); if(state.voice) speak("Hi! I'm Foxy the little scientist. Let's discover together!"); });

    el.celebrateBtn.addEventListener("click", closeCelebrate);
    el.celebrate.addEventListener("click", e=>{ if(e.target===el.celebrate) closeCelebrate(); });

    window.addEventListener("resize", ()=>{ if(raf){ el.confetti.width=window.innerWidth; el.confetti.height=window.innerHeight; }});
    if ("speechSynthesis" in window) window.speechSynthesis.getVoices();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
