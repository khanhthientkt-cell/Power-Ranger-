/* ============================================================
   Foxy's Tiny Lab — a cute world where kids 4–6 learn
   quantitative-research thinking through:
     🎬 Meet Foxy (animated intro)
     🧪 Experiments (self-paced card game)
     📖 Story Time (legends that teach research methods)
     👩‍🏫 Ask Teacher Foxy (offline Q&A + optional AI)
     🎟️ Sticker book
   Foxy reads everything aloud. Nothing rushes by — answers and
   explanations wait for a tap. Goal: make big ideas feel tiny. 💛
   ============================================================ */

(() => {
  "use strict";

  /* ---------------- picture sets ---------------- */
  const THEMES = [
    ["🍎","🍊","🍓","🍌","🍇","🍉","🍑","🥝"],
    ["🐶","🐱","🐰","🐻","🐸","🐥","🦊","🐼"],
    ["🚗","🚌","🚂","✈️","🚀","⛵","🚲","🚒"],
    ["⭐","🌈","☀️","🌸","🦋","🌷","🐚","🍀"],
    ["🍪","🧁","🍭","🍩","🍬","🎂","🍦","🍫"],
    ["⚽","🏀","🎈","🪁","🧸","🎁","🎨","🪀"],
  ];
  const COLORS = [
    {e:"🔴",name:"red"},{e:"🔵",name:"blue"},{e:"🟡",name:"yellow"},
    {e:"🟢",name:"green"},{e:"🟣",name:"purple"},{e:"🟠",name:"orange"},
  ];
  const STICKERS = ["🦊","🌟","🦄","🐢","🦖","🐙","🦜","🌻","🍉","🚀","🎈","🐳","🦋","🐝","🌈","🦩","🐧","🍓","🎀","🪐"];
  const PRAISE = ["Yay!","Great job!","You did it!","Woohoo!","Super!","Brilliant!","High five!","Amazing!"];
  const NUDGE  = ["Try again!","Almost! Look closely.","Oops — try once more!","So close!"];
  const LEVEL_TITLES = ["Tiny Scientist","Lab Explorer","Data Detective","Chart Champion","Discovery Star","Junior Genius"];
  const STARS_PER_LEVEL = 5;

  /* ---------------- state ---------------- */
  const SAVE_KEY = "foxyLab.save.v1";
  const AI_KEY = "foxyLab.ai.v1";
  const state = { stars:0, level:1, progress:0, sound:true, voice:true, stickers:[], islandIndex:0, crew:[] };

  /* ---------------- Grand Voyage islands + crew (original characters) ---------------- */
  const ISLANDS = [
    { id:"cove",     name:"Counting Cove",   icon:"🏝️", tag:"Counting",   pool:["count","seq"],
      crew:{emoji:"🐧", name:"Pip the Penguin",  bio:"Pip counts every fish in the sea! He teaches us to collect data by counting."} },
    { id:"cliffs",   name:"Compare Cliffs",  icon:"⛰️", tag:"More & Less", pool:["compare","bignum"],
      crew:{emoji:"🐰", name:"Bouncy the Bunny", bio:"Bouncy always hops to the bigger pile! She teaches us to compare amounts."} },
    { id:"harbor",   name:"Chart Harbor",    icon:"⚓", tag:"Charts",      pool:["survey","chartval"],
      crew:{emoji:"🐢", name:"Tilly the Turtle", bio:"Tilly draws tall charts in the sand! She teaches us to read data fast."} },
    { id:"reef",     name:"Pattern Reef",    icon:"🐚", tag:"Patterns",    pool:["pattern","riddle"],
      crew:{emoji:"🦜", name:"Echo the Parrot",  bio:"Echo repeats patterns all day! He teaches us to spot what comes next."} },
    { id:"atoll",    name:"Average Atoll",   icon:"🍪", tag:"Fair Share",  pool:["share"],
      crew:{emoji:"🦭", name:"Wally the Walrus", bio:"Wally shares snacks equally with everyone! He teaches us the average."} },
    { id:"bay",      name:"Chance Bay",      icon:"🎲", tag:"Chance",      pool:["chance","guess"],
      crew:{emoji:"🐱", name:"Lucky the Cat",    bio:"Lucky guesses, then checks to be sure! She teaches us about chance."} },
    { id:"sands",    name:"Sorting Sands",   icon:"🏖️", tag:"Sorting",     pool:["sort","odd"],
      crew:{emoji:"🦀", name:"Sandy the Crab",   bio:"Sandy sorts shells into neat piles! She teaches us to classify."} },
    { id:"treasure", name:"Treasure Island", icon:"🏆", tag:"Everything!", pool:["count","compare","survey","pattern","chance","sort"],
      crew:{emoji:"🗺️", name:"The Great Treasure", bio:"You sailed the whole sea! You are a true Research Captain! 🎉"} },
  ];
  let adventure = { active:false, island:null, goal:4, progress:0 };
  let ai = { provider:"anthropic", base:"", key:"", model:"" };

  function load(){ try{const r=localStorage.getItem(SAVE_KEY); if(r) Object.assign(state,JSON.parse(r));}catch(_){} try{const a=localStorage.getItem(AI_KEY); if(a) Object.assign(ai,JSON.parse(a));}catch(_){} }
  function save(){ try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch(_){} }
  function saveAI(){ try{localStorage.setItem(AI_KEY,JSON.stringify(ai));}catch(_){} }

  /* ---------------- DOM ---------------- */
  const $ = (id)=>document.getElementById(id);
  const el = {};
  ["homeScreen","introScreen","storyListScreen","storyScreen","teacherScreen","gameScreen","voyageScreen",
   "voyageMap","voyageCrewBtn","homeCrewBtn","crewModal","closeCrew","crewGrid",
   "recruit","recruitEmoji","recruitName","recruitBio","recruitJoin","recruitBtn","recruitConfetti",
   "soundToggle","voiceToggle","grownupBtn","savedBadge","homeStickersBtn","homeHowBtn",
   "introArt","introText","introDots","introSkip","introNext","introReplay",
   "storyList","storyTitle","storyScene","storyText","storyTakeaway","storyDots","storyPrev","storyNext","storyRepeat","bokeh","starStat",
   "teacherAnswer","aiBadge","askInput","askBtn","questionChips","teacherRepeat",
   "modeBadge","starCount","levelNum","progressFill","speechText","cardSlot","drawCard","answers","repeatBtn",
   "howModal","closeHow","stickerModal","closeStickers","stickerGrid",
   "aiModal","aiProvider","aiBase","aiBaseRow","aiKey","aiModel","aiSave","aiClear","aiClose",
   "celebrate","celebrateBadge","celebrateTitle","celebrateText","celebrateBtn","confetti","celebrateSticker","newSticker",
  ].forEach(id=>el[id]=$(id));

  /* ---------------- sound ---------------- */
  let actx=null;
  function ensureAudio(){ if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(_){actx=null;}} if(actx&&actx.state==="suspended")actx.resume(); }
  function tone(f,s,d,type="sine",g=0.16){ if(!state.sound||!actx)return; const t0=actx.currentTime+s,o=actx.createOscillator(),gn=actx.createGain(); o.type=type;o.frequency.setValueAtTime(f,t0); gn.gain.setValueAtTime(0.0001,t0);gn.gain.exponentialRampToValueAtTime(g,t0+0.02);gn.gain.exponentialRampToValueAtTime(0.0001,t0+d); o.connect(gn).connect(actx.destination);o.start(t0);o.stop(t0+d+0.02); }
  const sfx={
    correct(){ensureAudio();[523.25,659.25,783.99].forEach((f,i)=>tone(f,i*0.09,0.18,"triangle"));},
    wrong(){ensureAudio();tone(311,0,0.18,"sawtooth",0.1);tone(233,0.12,0.22,"sawtooth",0.1);},
    draw(){ensureAudio();tone(440,0,0.08,"square",0.07);tone(660,0.06,0.1,"square",0.07);},
    pop(){ensureAudio();tone(880,0,0.06,"triangle",0.08);},
    page(){ensureAudio();tone(660,0,0.06,"sine",0.06);},
    levelUp(){ensureAudio();[523,659,784,1047].forEach((f,i)=>tone(f,i*0.12,0.28,"triangle",0.18));},
  };

  /* ---------------- voice ---------------- */
  function speak(text){ if(!state.voice||!("speechSynthesis"in window))return; try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=0.92;u.pitch=1.2;u.lang="en-US";window.speechSynthesis.speak(u);}catch(_){} }
  function stopSpeak(){ if("speechSynthesis"in window){try{window.speechSynthesis.cancel();}catch(_){}}}
  function fox(t,say=true){ el.speechText.textContent=t; if(say)speak(t); }

  /* ---------------- utils ---------------- */
  const rand=(n)=>Math.floor(Math.random()*n);
  const pick=(a)=>a[rand(a.length)];
  function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
  function pickN(a,n){return shuffle(a).slice(0,n);}
  function numberOptions(answer,count,max){const o=new Set([answer]);let g=0;while(o.size<count&&g++<100){const d=rand(3)+1;const c=Math.random()<0.5?answer-d:answer+d;if(c>=0&&c<=max&&c!==answer)o.add(c);}let n=0;while(o.size<count&&n<=max){o.add(n);n++;}return shuffle([...o]).slice(0,count);}
  function div(cls,t){const d=document.createElement("div");d.className=cls;if(t!=null)d.textContent=t;return d;}
  function span(cls,t){const s=document.createElement("span");s.className=cls;if(t!=null)s.textContent=t;return s;}
  function items(item,n,cls="count-item"){const f=document.createDocumentFragment();for(let i=0;i<n;i++){const s=span(cls,item);s.style.animationDelay=(i*0.05)+"s";f.appendChild(s);}return f;}

  /* ---------------- anime SVG fox character (full body + moods) ---------------- */
  const FOX_SVG = `
  <svg viewBox="0 0 120 134" xmlns="http://www.w3.org/2000/svg">
    <g class="tail"><path d="M30 106 C 6 106 2 80 16 72 C 18 88 30 94 41 98 Z" fill="#ff924c"/><path d="M28 104 C 18 104 12 96 14 88 C 20 94 30 98 38 100 Z" fill="#fff6ef"/></g>
    <g class="body">
      <path d="M42 84 C 33 94 31 120 38 129 L82 129 C 89 120 87 94 78 84 Z" fill="#ffffff" stroke="#e7ddf3" stroke-width="2"/>
      <path d="M60 86 L52 100 L60 105 L68 100 Z" fill="#dfeefc"/>
      <line x1="60" y1="105" x2="60" y2="127" stroke="#e7ddf3" stroke-width="2"/>
      <rect x="44" y="111" width="12" height="11" rx="2" fill="none" stroke="#e7ddf3" stroke-width="2"/>
      <rect x="48.5" y="108" width="3" height="9" rx="1.5" fill="#9b6bff"/>
      <ellipse class="arm-l" cx="34" cy="104" rx="8" ry="11" fill="#ff924c"/>
      <ellipse class="arm-r" cx="86" cy="104" rx="8" ry="11" fill="#ff924c"/>
    </g>
    <g class="head">
      <g class="ear-l"><polygon points="22,40 30,8 52,32" fill="#ff924c"/><polygon points="30,32 33,18 44,30" fill="#ffd0b5"/></g>
      <g class="ear-r"><polygon points="98,40 90,8 68,32" fill="#ff924c"/><polygon points="90,32 87,18 76,30" fill="#ffd0b5"/></g>
      <ellipse cx="60" cy="54" rx="38" ry="36" fill="#ff924c"/>
      <path d="M60 32 C 40 32 30 50 33 66 C 36 82 50 88 60 88 C 70 88 84 82 87 66 C 90 50 80 32 60 32 Z" fill="#fff6ef"/>
      <ellipse class="blush" cx="36" cy="66" rx="8" ry="4.6" fill="#ffaecb" opacity=".75"/>
      <ellipse class="blush" cx="84" cy="66" rx="8" ry="4.6" fill="#ffaecb" opacity=".75"/>
      <g class="v eyes-open">
        <g class="eye"><ellipse cx="47" cy="56" rx="7.5" ry="10" fill="#3a2e3e"/><circle cx="50" cy="52" r="3" fill="#fff"/><circle cx="45" cy="59" r="1.5" fill="#fff" opacity=".8"/></g>
        <g class="eye"><ellipse cx="73" cy="56" rx="7.5" ry="10" fill="#3a2e3e"/><circle cx="76" cy="52" r="3" fill="#fff"/><circle cx="71" cy="59" r="1.5" fill="#fff" opacity=".8"/></g>
      </g>
      <g class="v eyes-happy">
        <path d="M40 58 Q47 50 54 58" fill="none" stroke="#3a2e3e" stroke-width="3.2" stroke-linecap="round"/>
        <path d="M66 58 Q73 50 80 58" fill="none" stroke="#3a2e3e" stroke-width="3.2" stroke-linecap="round"/>
      </g>
      <g class="v eyes-wow">
        <g class="eye"><ellipse cx="47" cy="55" rx="9" ry="12" fill="#fff" stroke="#3a2e3e" stroke-width="2"/><circle cx="47" cy="56" r="5" fill="#3a2e3e"/><circle cx="49" cy="53" r="1.6" fill="#fff"/></g>
        <g class="eye"><ellipse cx="73" cy="55" rx="9" ry="12" fill="#fff" stroke="#3a2e3e" stroke-width="2"/><circle cx="73" cy="56" r="5" fill="#3a2e3e"/><circle cx="75" cy="53" r="1.6" fill="#fff"/></g>
      </g>
      <path d="M55 68 L65 68 L60 74 Z" fill="#3a2e3e"/>
      <g class="v mouth-smile">
        <path d="M60 74 C 55 80 49 79 48 75" fill="none" stroke="#3a2e3e" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M60 74 C 65 80 71 79 72 75" fill="none" stroke="#3a2e3e" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <g class="v mouth-open">
        <path d="M50 74 Q60 90 70 74 Z" fill="#3a2e3e"/>
        <path d="M54 80 Q60 87 66 80 Z" fill="#ff7eb6"/>
      </g>
      <g class="v mouth-o"><ellipse cx="60" cy="79" rx="5" ry="6" fill="#3a2e3e"/></g>
    </g>
  </svg>`;
  function injectFoxies(){ document.querySelectorAll("[data-foxy]").forEach(n=>{ if(!n.dataset.done){ n.innerHTML=FOX_SVG; n.dataset.done="1"; } }); }
  function foxCheer(){ document.querySelectorAll(".foxy").forEach(n=>{ n.classList.remove("cheer"); void n.offsetWidth; n.classList.add("cheer"); }); }
  function setFox(mood){ document.querySelectorAll(".foxy").forEach(n=>{ n.classList.remove("mood-happy","mood-think","mood-wow","mood-cheer"); if(mood) n.classList.add("mood-"+mood); }); }

  /* ---------------- floating particles ---------------- */
  function initBokeh(){
    if(!el.bokeh) return;
    const n=10, frag=document.createDocumentFragment();
    for(let i=0;i<n;i++){ const s=document.createElement("span"); const sz=18+rand(46);
      s.style.width=s.style.height=sz+"px"; s.style.left=rand(100)+"%";
      s.style.animationDuration=(10+rand(14))+"s"; s.style.animationDelay=(-rand(20))+"s";
      frag.appendChild(s); }
    el.bokeh.appendChild(frag);
  }

  /* ---------------- star burst effect ---------------- */
  function starBurst(node){
    let cx=window.innerWidth/2, cy=window.innerHeight/2;
    try{ const r=node.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; }catch(_){}
    const emo=["⭐","✨","🌟","💫"];
    for(let i=0;i<10;i++){ const s=document.createElement("div"); s.className="burst"; s.textContent=pick(emo);
      s.style.left=cx+"px"; s.style.top=cy+"px";
      const ang=Math.random()*Math.PI*2, dist=60+rand(90);
      s.style.setProperty("--dx",(Math.cos(ang)*dist)+"px"); s.style.setProperty("--dy",(Math.sin(ang)*dist)+"px");
      document.body.appendChild(s); setTimeout(()=>s.remove(),850); }
  }

  /* ============================================================
     SCREEN ROUTER
     ============================================================ */
  const SCREENS=["homeScreen","introScreen","storyListScreen","storyScreen","teacherScreen","gameScreen","voyageScreen"];
  function showScreen(id){
    stopSpeak();
    if(id!=="gameScreen") adventure.active=false;   // leaving a chapter ends adventure mode
    SCREENS.forEach(s=>el[s].classList.toggle("hidden", s!==id));
    const scr=el[id]; scr.classList.remove("anim"); void scr.offsetWidth; scr.classList.add("anim");
    if(id==="homeScreen") refreshHome();
    if(id==="introScreen") startIntro();
    if(id==="storyListScreen") buildStoryList();
    if(id==="teacherScreen") openTeacher();
    if(id==="voyageScreen") buildVoyage();
    if(id==="gameScreen") enterGame();
  }

  /* ============================================================
     INTRO ("Meet Foxy")
     ============================================================ */
  const INTRO=[
    {art:"", text:"Hi! I'm Foxy, a tiny scientist! 🦊"},
    {art:"🔬✨🧪", text:"Welcome to my Tiny Lab!"},
    {art:"❓ 🔮 🔍", text:"Scientists ASK, GUESS, then FIND OUT!"},
    {art:"🧮 📊 🎲", text:"We count, make charts, and discover patterns!"},
    {art:"⭐ 🎟️", text:"Win stars and collect stickers. Let's explore!"},
  ];
  let introI=0;
  function startIntro(){ introI=0; renderIntro(); }
  function renderIntro(){
    const s=INTRO[introI];
    if(s.art){ el.introArt.classList.remove("hidden"); el.introArt.textContent=s.art; }
    else el.introArt.classList.add("hidden");
    el.introText.textContent=s.text;
    el.introDots.replaceChildren(...INTRO.map((_,i)=>div("dot"+(i===introI?" on":""))));
    el.introNext.textContent = introI===INTRO.length-1 ? "Let's go! 🎉" : "Next ▶";
    foxCheer(); speak(s.text); sfx.page();
  }
  function introNext(){ if(introI<INTRO.length-1){ introI++; renderIntro(); } else { showScreen("gameScreen"); } }

  /* ============================================================
     STORY TIME — research legends
     ============================================================ */
  const STORIES=[
    { id:"count", title:"The Counting Stars", emoji:"⭐", tag:"Data",
      pages:[
        {actors:["🦊","🌙"], text:"Long ago, little Foxy looked up at the night sky."},
        {actors:["✨","⭐","✨","🌟"], text:"\"How many stars are there?\" he wondered."},
        {actors:["🦊","👉","⭐"], text:"So he pointed at each one and counted: one, two, three…"},
        {actors:["📋","⭐"], text:"Counting things one by one is how we collect DATA!"},
      ], takeaway:"Counting = collecting data 🧮" },

    { id:"guess", title:"The Two Jars", emoji:"🫙", tag:"Hypothesis",
      pages:[
        {actors:["🫙","🫙"], text:"Two jars sat on the table. Which had more candy?"},
        {actors:["🦊","🤔"], text:"Foxy made a GUESS first: \"The big jar!\""},
        {actors:["🦊","🔢"], text:"Then he counted to check… the small jar had more!"},
        {actors:["💡"], text:"A guess you test by checking is a HYPOTHESIS!"},
      ], takeaway:"Guess, then check 🔮" },

    { id:"survey", title:"The Village Vote", emoji:"🗳️", tag:"Charts",
      pages:[
        {actors:["🐰","🐻","🐱"], text:"The animals could not agree on the best fruit."},
        {actors:["🍎","🍌","🍇"], text:"So each one put a stone next to their favorite."},
        {actors:["📊"], text:"They stacked the stones. The tallest pile won!"},
        {actors:["🏆","🍎"], text:"Stacking counts to compare them makes a CHART!"},
      ], takeaway:"Charts show data fast 📊" },

    { id:"average", title:"The Fair Feast", emoji:"🍪", tag:"Average",
      pages:[
        {actors:["🐻","🐰","🐱","🍪"], text:"Three friends found a big plate of cookies."},
        {actors:["🐰","🤨"], text:"\"It's not fair if one gets more!\" said Bunny."},
        {actors:["🍪","🤝","🍪"], text:"So they shared equally — the same for everyone."},
        {actors:["⚖️"], text:"Sharing equally is like finding the AVERAGE!"},
      ], takeaway:"Average = a fair share 🍪" },

    { id:"pattern", title:"The Pattern Path", emoji:"🌈", tag:"Trends",
      pages:[
        {actors:["🦊","🛤️"], text:"Foxy found a path made of magic stones."},
        {actors:["🔴","🔵","🔴","🔵"], text:"Red, blue, red, blue… it kept repeating!"},
        {actors:["🦊","💡"], text:"\"I see the pattern! Blue comes next!\""},
        {actors:["🔮"], text:"Spotting patterns helps us guess what's next — a TREND!"},
      ], takeaway:"Patterns show trends 🔁" },

    { id:"chance", title:"The Lucky Berry Bag", emoji:"🎒", tag:"Chance",
      pages:[
        {actors:["🎒","🫐"], text:"Foxy had a bag with many red berries and a few blue."},
        {actors:["🦊","🤔"], text:"\"Which will I grab without looking?\""},
        {actors:["🔴","🔴","🔴","🔵"], text:"More red berries means red is more LIKELY!"},
        {actors:["🎲"], text:"How likely something is — that's CHANCE!"},
      ], takeaway:"More of it = more likely 🎲" },

    { id:"measure", title:"The Tall Tower", emoji:"📏", tag:"Measure",
      pages:[
        {actors:["🦊","🧱"], text:"Foxy and friends built towers out of blocks."},
        {actors:["🧱","🧱","🧱"], text:"\"Whose tower is the tallest?\" they asked."},
        {actors:["📏"], text:"They used a ruler to measure each one carefully."},
        {actors:["🏆","📏"], text:"Measuring lets us compare sizes fairly!"},
      ], takeaway:"Measuring compares sizes 📏" },

    { id:"sort", title:"The Sorting Tree", emoji:"🌳", tag:"Sorting",
      pages:[
        {actors:["🌳","🍂"], text:"Leaves of many colors fell from the big tree."},
        {actors:["🟥","🟨","🟩"], text:"Foxy put red with red, yellow with yellow…"},
        {actors:["🗂️"], text:"Now each color had its own neat little pile."},
        {actors:["🦊","✅"], text:"Sorting into groups helps us understand our data!"},
      ], takeaway:"Sorting groups things 🗂️" },

    { id:"biggest", title:"The Biggest Pumpkin", emoji:"🎃", tag:"Compare",
      pages:[
        {actors:["🎃","🎃","🎃"], text:"At the fair, three pumpkins sat in a row."},
        {actors:["🦊","🔍"], text:"\"Which one is the BIGGEST?\" wondered Foxy."},
        {actors:["🎃","🏆"], text:"He looked carefully and found the giant one!"},
        {actors:["📊"], text:"Finding the biggest is a kind of comparing!"},
      ], takeaway:"Finding the biggest is comparing 🔍" },
  ];
  let story=null, storyPage=0;

  function buildStoryList(){
    el.storyList.replaceChildren(...STORIES.map(s=>{
      const c=div("story-card"); c.tabIndex=0; c.setAttribute("role","button");
      c.append(span("sc-emoji",s.emoji), div("sc-title",s.title), div("sc-tag","✨ "+s.tag));
      const open=()=>openStory(s);
      c.addEventListener("click",open);
      c.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
      return c;
    }));
  }
  function openStory(s){ story=s; storyPage=0; el.storyTitle.textContent=s.emoji+" "+s.title; SCREENS.forEach(x=>el[x].classList.toggle("hidden",x!=="storyScreen")); const scr=el.storyScreen; scr.classList.remove("anim"); void scr.offsetWidth; scr.classList.add("anim"); renderStory(); }
  function renderActors(list){
    el.storyScene.replaceChildren(...list.map((emo,i)=>{ const a=span("actor",emo); a.style.animationDelay=(i*0.12)+"s, "+(0.55+i*0.12)+"s"; return a; }));
  }
  function animateText(t){ el.storyText.classList.remove("show"); void el.storyText.offsetWidth; el.storyText.textContent=t; el.storyText.classList.add("show"); }
  function renderStory(){
    const last = storyPage>=story.pages.length;
    if(!last){
      const p=story.pages[storyPage];
      renderActors(p.actors); animateText(p.text);
      el.storyTakeaway.classList.add("hidden");
      el.storyNext.textContent = storyPage===story.pages.length-1 ? "Finish 🎉" : "Next ▶";
      speak(p.text);
    } else {
      renderActors([story.emoji,"🌟"]); animateText("The End! 🌟");
      el.storyTakeaway.textContent="What we learned: "+story.takeaway;
      el.storyTakeaway.classList.remove("hidden");
      el.storyNext.textContent="More stories 📚";
      speak("The end! What we learned: "+story.takeaway);
    }
    el.storyPrev.style.visibility = storyPage>0 ? "visible":"hidden";
    const total=story.pages.length+1;
    el.storyDots.replaceChildren(...Array.from({length:total},(_,i)=>div("dot"+(i===storyPage?" on":""))));
    sfx.page();
  }
  function storyNext(){ if(storyPage<story.pages.length){ storyPage++; renderStory(); } else { showScreen("storyListScreen"); } }
  function storyPrev(){ if(storyPage>0){ storyPage--; renderStory(); } }

  /* ============================================================
     ASK TEACHER FOXY — offline Q&A (+ optional AI)
     ============================================================ */
  const QA=[
    {q:"What is research?", a:"Research is asking a question and looking carefully to find the answer — like being a detective! 🔍", k:["research","study","science"]},
    {q:"What is data?", a:"Data is little facts we collect, like how many apples there are. Counting gives us data! 🧮", k:["data","facts","information"]},
    {q:"What is a guess?", a:"A guess is what you think might be true before you check. A smart guess we test is called a hypothesis! 🔮", k:["guess","hypothesis","predict","prediction"]},
    {q:"What is a chart?", a:"A chart is a picture of data. Taller bars mean more. Charts help us see things fast! 📊", k:["chart","graph","bar"]},
    {q:"What is an average?", a:"An average is a fair share — when everyone gets the same amount. 🍪", k:["average","mean","fair share","share"]},
    {q:"What is chance?", a:"Chance is how likely something is to happen. More of something means a bigger chance! 🎲", k:["chance","probability","likely","luck"]},
    {q:"What is a pattern?", a:"A pattern is something that repeats, like red-blue-red-blue. Patterns help us guess what comes next! 🔁", k:["pattern","trend","repeat","sequence"]},
    {q:"Why do we count?", a:"We count to know how many. Counting turns things into data we can compare! 🔢", k:["count","counting","how many","number"]},
    {q:"What does a scientist do?", a:"A scientist asks questions, guesses, tries things, and discovers answers. You can be one too! 🔬", k:["scientist","science","experiment"]},
    {q:"What is more and less?", a:"More means a bigger amount, less means a smaller amount. We compare to find out! ⚖️", k:["more","less","fewer","compare","bigger","smaller"]},
    {q:"What is a survey?", a:"A survey is asking lots of friends the same question and counting the answers! 🗳️", k:["survey","vote","poll","ask friends"]},
  ];

  function openTeacher(){
    el.aiBadge.classList.toggle("hidden", !ai.key);
    el.questionChips.replaceChildren(...QA.map(item=>{
      const c=div("chip", item.q); c.tabIndex=0; c.setAttribute("role","button");
      const go=()=>answerCurated(item);
      c.addEventListener("click",go);
      c.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
      return c;
    }));
  }
  function setTeacherAnswer(text, loading=false){ el.teacherAnswer.textContent=text; el.teacherAnswer.classList.toggle("loading",loading); setFox(loading?"think":"happy"); if(!loading){ speak(text); foxCheer(); } }
  function answerCurated(item){ setTeacherAnswer(item.a); sfx.pop(); }

  function bestMatch(qRaw){
    const q=qRaw.toLowerCase();
    let best=null, bestScore=0;
    QA.forEach(item=>{
      let score=0; item.k.forEach(k=>{ if(q.includes(k)) score+=k.length; });
      if(score>bestScore){bestScore=score;best=item;}
    });
    return bestScore>0?best:null;
  }

  async function askQuestion(){
    const q=(el.askInput.value||"").trim();
    if(!q){ setTeacherAnswer("Type a question, or tap one of my question bubbles below! 🦊"); return; }
    if(ai.key){ await askAI(q); return; }
    const m=bestMatch(q);
    if(m) answerCurated(m);
    else setTeacherAnswer("Ooh, great question! Try tapping one of my question bubbles below — or a grown-up can add an AI key in the Grown-ups menu so I can answer anything! 🦊");
    el.askInput.value="";
  }

  async function askAI(q){
    setTeacherAnswer("Foxy is thinking… 🤔", true);
    const sys="You are Foxy, a sweet, patient fox teacher. You explain research and math ideas to a young child aged 4 to 6. Always answer in 2 to 3 very short, simple, cheerful sentences using easy words and at most one emoji. Never use scary or complex words. If the question is not about learning, gently bring it back to fun learning.";
    try{
      let text;
      if(ai.provider==="anthropic"){
        const base=(ai.base||"https://api.anthropic.com").replace(/\/$/,"");
        const r=await fetch(base+"/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":ai.key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:ai.model||"claude-haiku-4-5-20251001",max_tokens:200,system:sys,messages:[{role:"user",content:q}]})});
        if(!r.ok) throw new Error("HTTP "+r.status);
        const j=await r.json(); text=(j.content&&j.content[0]&&j.content[0].text)||"";
      } else {
        const base=(ai.base||"").replace(/\/$/,"");
        const r=await fetch(base+"/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+ai.key},body:JSON.stringify({model:ai.model||"gpt-4o-mini",max_tokens:200,messages:[{role:"system",content:sys},{role:"user",content:q}]})});
        if(!r.ok) throw new Error("HTTP "+r.status);
        const j=await r.json(); text=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||"";
      }
      setTeacherAnswer(text.trim()||"Hmm, let's try that again! 🦊");
    }catch(e){
      const m=bestMatch(q);
      setTeacherAnswer(m?m.a:("Oops, I couldn't reach my AI brain ("+e.message+"). A grown-up can check the key in the Grown-ups menu. 🦊"));
    }
    el.askInput.value="";
  }

  /* ============================================================
     EXPERIMENT GENERATORS  (each: name, question, tip, scene,
     layout, options:[{...correct}], jars?)
     ============================================================ */
  function diff(){const l=state.level;return{l,maxN:Math.min(4+l,12),opts:l>=3?4:3};}

  function expCount(d){
    const item=pick(pick(THEMES)); const n=rand(Math.min(6,d.maxN-1))+1;
    return { name:"Count it!", question:`How many ${item} do you see?`, tip:"Counting one by one is how scientists collect data!",
      scene(c){const g=div("count-grid");g.appendChild(items(item,n,"count-item jelly"));c.append(div("card-question","How many?"),g);},
      layout:"grid", options:numberOptions(n,d.opts,Math.min(9,d.maxN)).map(v=>({text:String(v),correct:v===n})) };
  }
  function expCompare(d){
    const more=Math.random()<0.5; const item=pick(pick(THEMES));
    let a=rand(Math.min(7,d.maxN))+1,b=rand(Math.min(7,d.maxN))+1;while(a===b)b=rand(Math.min(7,d.maxN))+1;
    const correct=more?Math.max(a,b):Math.min(a,b);
    return { name:more?"More!":"Fewer!", question:more?"Which group has MORE?":"Which group has FEWER?", tip:"Comparing groups is how we see what's bigger or smaller!",
      scene(c){c.append(div("card-question",more?"Which has MORE? 🔼":"Which has FEWER? 🔽"));},
      layout:"row", options:[a,b].map(x=>({box:true,count:x,correct:x===correct,item})) };
  }
  function expGuess(d){
    const item=pick(pick(THEMES));
    let a=rand(Math.min(8,d.maxN))+2,b=rand(Math.min(8,d.maxN))+2;while(a===b)b=rand(Math.min(8,d.maxN))+2;
    const correct=Math.max(a,b);
    return { name:"Guess & Check", question:"Guess which jar has MORE, then we count!", tip:"Scientists guess first, then count to know for sure. That's a hypothesis!",
      scene(c){c.append(div("card-question","🔮 Which jar has MORE?"),div("card-sub","Guess… then we count!"));},
      layout:"row", jars:true, options:[a,b].map(x=>({jar:true,count:x,correct:x===correct,item})),
      revealMsg:()=>`Let's count! ${a} and ${b}. Now we KNOW! 🔍` };
  }
  function expSort(d){
    const theme=pick(THEMES); const [target,o1,o2]=pickN(theme,3);
    const t=rand(4)+2,c1=rand(3)+1,c2=rand(2)+1;
    const mix=shuffle([...Array(t).fill(target),...Array(c1).fill(o1),...Array(c2).fill(o2)]);
    return { name:"Sort & Count", question:`How many ${target} are there?`, tip:"Sorting into groups helps us count each kind!",
      scene(c){const g=div("count-grid");mix.forEach((m,i)=>{const s=span("count-item",m);s.style.animationDelay=(i*0.04)+"s";g.appendChild(s);});c.append(div("card-question",`Find the ${target} — how many?`),g);},
      layout:"grid", options:numberOptions(t,d.opts,8).map(v=>({text:String(v),correct:v===t})) };
  }
  function expSurvey(d){
    const theme=pick(THEMES); const cats=pickN(theme,3); const mostMode=Math.random()<0.6;
    let counts; do{counts=cats.map(()=>rand(5)+1);}while(new Set(counts).size<3);
    const target=mostMode?Math.max(...counts):Math.min(...counts);
    return { name:"Friend Survey", question:mostMode?"Which got the MOST votes?":"Which got the FEWEST votes?", tip:"This is a chart! Longer means more. Scientists read charts to see data fast!",
      scene(c){c.append(div("card-question","🗳️ Our friends voted!"),div("card-sub",mostMode?"Tap the one with the MOST":"Tap the one with the FEWEST"));},
      layout:"col", options:cats.map((cc,i)=>({bar:true,item:cc,count:counts[i],correct:counts[i]===target})) };
  }
  function expPattern(d){
    const theme=pick(THEMES);
    const kinds=[
      ()=>{const[a,b]=pickN(theme,2);return{seq:[a,b,a,b,a],next:b,ch:[a,b,pick(theme)]};},
      ()=>{const[a,b]=pickN(theme,2);return{seq:[a,a,b,a,a],next:b,ch:[a,b,pick(theme)]};},
      ()=>{const[a,b,c]=pickN(theme,3);return{seq:[a,b,c,a,b],next:c,ch:[a,b,c]};},
    ];
    const p=pick(kinds)(); let ch=[...new Set([...p.ch,p.next])].slice(0,3); if(!ch.includes(p.next))ch[0]=p.next;
    return { name:"Pattern Detective", question:"What comes next?", tip:"Finding patterns is how scientists spot trends!",
      scene(c){const row=div("pattern-row");p.seq.forEach((m,i)=>{const s=span("count-item",m);s.style.animationDelay=(i*0.06)+"s";row.appendChild(s);});row.appendChild(span("pattern-q","❓"));c.append(div("card-question","🔁 What comes next?"),row);},
      layout:"row", options:shuffle(ch).map(x=>({emojiBtn:x,correct:x===p.next})) };
  }
  function expShare(d){
    const m=rand(2)+2,k=rand(3)+1,total=m*k;
    const friend=pick(["🐰","🐻","🐱","🐶","🐼"]),treat=pick(["🍪","🍬","🍭","🧁","🍎"]);
    return { name:"Fair Share", question:`Share ${total} ${treat} fairly between ${m} friends. How many each?`, tip:"Sharing equally is just like finding the average!",
      scene(c){c.append(div("card-question","Share fairly! 🤝"));const top=div("count-grid");top.appendChild(items(treat,total,"count-item jelly"));const fr=div("count-grid");fr.appendChild(items(friend,m));c.append(top,div("card-sub",`between these ${m} friends:`),fr);},
      layout:"grid", options:numberOptions(k,3,6).map(v=>({text:String(v),correct:v===k})) };
  }
  function expChance(d){
    const [c1,c2]=pickN(COLORS,2); let maj=rand(4)+3,min=rand(2)+1; if(min>=maj)min=maj-1;
    const contents=shuffle([...Array(maj).fill(c1.e),...Array(min).fill(c2.e)]);
    return { name:"Lucky Bag", question:"If Foxy picks without looking, which color is MORE likely?", tip:"More of a color means it's more likely! That's chance.",
      scene(c){const st=div("bag-stage");st.appendChild(span("bag-emoji","🎒"));const cc=div("bag-contents");contents.forEach((m,i)=>{const s=span("count-item",m);s.style.animationDelay=(i*0.04)+"s";cc.appendChild(s);});st.appendChild(cc);c.append(div("card-question","🎲 Which is MORE likely?"),st);},
      layout:"row", options:shuffle([{col:c1,correct:true},{col:c2,correct:false}]).map(o=>({colorBox:o.col,correct:o.correct})) };
  }
  const RIDDLES=[
    {text:"I am red and round and grow on a tree. Count me! Which am I?", a:"🍎", o:["🚗","⭐","🐱"]},
    {text:"I show data with tall bars so you can see fast. Which am I?", a:"📊", o:["🍌","⚽","🎈"]},
    {text:"You shake me and pick a berry without looking. Which am I?", a:"🎒", o:["📊","🌈","🍪"]},
    {text:"I twinkle in the night sky. Count us way up high!", a:"⭐", o:["🐶","🚌","🍇"]},
    {text:"We go red, blue, red, blue — a repeating kind of fun!", a:"🔁", o:["🍦","🐸","🚀"]},
    {text:"I am a tool that helps you guess what comes next. Which am I?", a:"🔮", o:["🧁","🐢","🚲"]},
    {text:"I am a long stick that helps you measure how tall things are.", a:"📏", o:["🍩","🐙","🎈"]},
    {text:"I am yellow and I live in the sky in the daytime. Count my rays!", a:"☀️", o:["🐸","🚗","🍇"]},
    {text:"I have four wheels and say beep beep. Count us in the street!", a:"🚗", o:["🍎","⭐","🐱"]},
    {text:"I float up high on a string at parties. How many of me?", a:"🎈", o:["📚","🐢","🥕"]},
    {text:"I help you weigh things to see which side is heavier.", a:"⚖️", o:["🍌","🚀","🐶"]},
    {text:"I am a tiny buzzing helper who visits flowers. Count the bunch!", a:"🐝", o:["🚌","🍩","⭐"]},
  ];

  // numeral comparison — number sense
  function expBigNumber(d){
    const big=Math.random()<0.5; let a=rand(d.maxN)+1,b=rand(d.maxN)+1; while(a===b)b=rand(d.maxN)+1;
    const correct=big?Math.max(a,b):Math.min(a,b);
    return { name:big?"Bigger Number":"Smaller Number", question:big?"Which number is BIGGER?":"Which number is SMALLER?", tip:"Knowing which number is bigger helps us compare data!",
      scene(c){c.append(div("card-question",big?"Which is BIGGER? 🔢":"Which is SMALLER? 🔢"));},
      layout:"row", options:[a,b].map(x=>({text:String(x),correct:x===correct})) };
  }
  // counting sequence — number order
  function expSeqNumber(d){
    const s=rand(Math.max(1,d.maxN-3))+1; const seq=[s,s+1,s+2]; const next=s+3;
    return { name:"Next Number", question:"What number comes next?", tip:"Numbers go in order — that's counting up!",
      scene(c){const row=div("pattern-row");seq.forEach((m,i)=>{const t=span("numeral",String(m));t.style.animationDelay=(i*0.08)+"s";row.appendChild(t);});row.appendChild(span("pattern-q","❓"));c.append(div("card-question","🔢 What comes next?"),row);},
      layout:"grid", options:numberOptions(next,d.opts,d.maxN+2).map(v=>({text:String(v),correct:v===next})) };
  }
  // odd one out — classifying
  function expOddOne(d){
    const theme=pick(THEMES); const [same,odd]=pickN(theme,2);
    const opts=shuffle([{emojiBtn:odd,correct:true},{emojiBtn:same,correct:false},{emojiBtn:same,correct:false},{emojiBtn:same,correct:false}]);
    return { name:"Odd One Out", question:"Which one is DIFFERENT?", tip:"Spotting what's different helps us sort and classify!",
      scene(c){c.append(div("card-question","🔍 Which one is DIFFERENT?"),div("card-sub","Find the one that doesn't match!"));},
      layout:"grid", options:opts };
  }
  // read an exact value off a chart — data visualization
  function expChartValue(d){
    const theme=pick(THEMES); const cats=pickN(theme,3); const counts=cats.map(()=>rand(5)+1);
    const ti=rand(3); const target=cats[ti], tcount=counts[ti];
    return { name:"Read the Chart", question:`How many votes did ${target} get?`, tip:"Reading the exact number off a chart is a real scientist skill!",
      scene(c){c.append(div("card-question",`📊 How many for ${target}?`));const wrap=div("answers col");wrap.style.maxWidth="none";wrap.style.width="100%";cats.forEach((cc,i)=>{const row=div("bar-row");row.style.cursor="default";row.appendChild(span("bar-label",cc));const fill=div("bar-fill");for(let k=0;k<counts[i];k++){const bc=span("bar-cell",cc);bc.style.animationDelay=(k*0.05)+"s";fill.appendChild(bc);}row.appendChild(fill);wrap.appendChild(row);});c.append(wrap);},
      layout:"grid", options:numberOptions(tcount,d.opts,6).map(v=>({text:String(v),correct:v===tcount})) };
  }
  function expRiddle(d){
    const r=pick(RIDDLES); const opts=shuffle([r.a,...pickN(r.o,Math.max(2,d.opts-1))]);
    return { name:"Riddle Time", question:r.text, tip:"Riddles make us think carefully — just like solving a research puzzle!",
      scene(c){c.append(div("card-question","🧩 Riddle!"),div("card-sub",r.text));},
      layout:"row", options:opts.map(x=>({emojiBtn:x,correct:x===r.a})) };
  }

  function makeExp(key,d){
    switch(key){
      case "compare":return expCompare(d); case "guess":return expGuess(d); case "sort":return expSort(d);
      case "survey":return expSurvey(d); case "pattern":return expPattern(d); case "share":return expShare(d);
      case "chance":return expChance(d); case "riddle":return expRiddle(d);
      case "odd":return expOddOne(d); case "bignum":return expBigNumber(d); case "seq":return expSeqNumber(d);
      case "chartval":return expChartValue(d); default:return expCount(d);
    }
  }
  function dealExperiment(){
    const d=diff();
    if(adventure.active) return makeExp(pick(adventure.island.pool), d);
    const bag=["count","compare","guess","sort","riddle","odd","bignum"];
    if(d.l>=2)bag.push("survey","seq");
    if(d.l>=3)bag.push("pattern","survey","chartval");
    if(d.l>=4)bag.push("share","chance","chartval");
    if(d.l>=5)bag.push("chance","pattern","riddle","odd");
    return makeExp(pick(bag), d);
  }

  /* ============================================================
     EXPERIMENT FLOW (with self-paced Discovery step)
     ============================================================ */
  let current=null, awaitingDraw=true, locked=false;

  function enterGame(){
    if(adventure.active){ updateChapterHud(); resetToDraw("Ahoy! Tap the card to explore "+adventure.island.name+"! ⛵", true); }
    else { updateHud(); resetToDraw("Tap the card to start an experiment! 🎴", true); }
  }
  function updateChapterHud(){
    el.starCount.textContent=state.stars;
    el.levelNum.textContent=adventure.island.icon;
    el.progressFill.style.width=Math.round((adventure.progress/adventure.goal)*100)+"%";
    el.modeBadge.textContent="🏴‍☠️ "+adventure.island.name+" — 🪙 "+adventure.progress+"/"+adventure.goal;
  }

  function showExperiment(ch){
    current=ch; awaitingDraw=false; locked=false; ch._revealed=false;
    el.modeBadge.textContent="🧪 "+ch.name;
    const card=document.createElement("div"); card.className="quest-card"; ch.scene(card); el.cardSlot.replaceChildren(card);
    el.answers.className="answers "+(ch.layout||"grid"); el.answers.replaceChildren(); ch._nodes=[];
    ch.options.forEach(opt=>{ const node=buildOption(opt); ch._nodes.push({opt,node}); const h=()=>choose(opt,node,ch); node.addEventListener("click",h); node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();h();}}); el.answers.appendChild(node); });
    fox(ch.question); sfx.draw(); setFox("think");
  }
  function buildOption(opt){
    if(opt.text!=null){const b=document.createElement("button");b.className="answer-btn";b.textContent=opt.text;return b;}
    if(opt.emojiBtn){const b=document.createElement("button");b.className="answer-btn";b.style.fontSize="clamp(40px,11vw,60px)";b.textContent=opt.emojiBtn;return b;}
    if(opt.colorBox){const box=mkBox();box.appendChild(span("count-item",opt.colorBox.e));box.appendChild(div("card-sub",opt.colorBox.name));return box;}
    if(opt.jar){const box=mkBox();box.appendChild(span("jar","🫙"));const cc=div("jar-count hidden-q","?");box._count=cc;box.appendChild(cc);return box;}
    if(opt.box){const box=mkBox();const pi=div("pick-items");pi.appendChild(items(opt.item,opt.count));box.appendChild(pi);return box;}
    if(opt.bar){const row=div("bar-row");row.tabIndex=0;row.setAttribute("role","button");row.appendChild(span("bar-label",opt.item));const fill=div("bar-fill");for(let i=0;i<opt.count;i++){const cc=span("bar-cell",opt.item);cc.style.animationDelay=(i*0.05)+"s";fill.appendChild(cc);}row.appendChild(fill);return row;}
    return mkBox();
  }
  function mkBox(){const b=div("pick-box");b.tabIndex=0;b.setAttribute("role","button");return b;}

  function choose(opt,node,ch){
    if(locked)return;
    if(ch.jars&&!ch._revealed){ ch._revealed=true; ch._nodes.forEach(({opt:o,node:n})=>{if(n._count){n._count.classList.remove("hidden-q");n._count.textContent=String(o.count);sfx.pop();}}); if(ch.revealMsg)fox(ch.revealMsg()); }
    if(opt.correct){ locked=true; node.classList.add("right"); starBurst(node); setFox("cheer"); foxCheer(); ch._nodes.forEach(({node:n})=>{if(n!==node)n.classList.add("dim");}); onCorrect(ch); }
    else { node.classList.add("wrong"); sfx.wrong(); fox(pick(NUDGE)); setFox("wow"); setTimeout(()=>{node.classList.remove("wrong"); if(!locked)setFox("think");},600); }
  }

  function onCorrect(ch){
    sfx.correct(); state.stars+=1;
    if(adventure.active){
      adventure.progress+=1; updateChapterHud(); save();
      const done=adventure.progress>=adventure.goal;
      showDiscovery(ch, done?"Find the treasure! 🎉":"Sail on ▶", done?finishChapter:()=>resetToDraw("Tap the card for the next challenge! 🗺️", false));
    } else {
      state.progress+=1;
      const leveled=state.progress>=STARS_PER_LEVEL; let newSticker=null;
      if(leveled){ state.level+=1; state.progress=0; newSticker=grantSticker(); }
      updateHud(); save();
      showDiscovery(ch, leveled?"See your prize! 🎉":"Next ▶", leveled?()=>celebrate(newSticker):()=>resetToDraw("Tap the card for a new experiment! 🎴", false));
    }
  }

  // Self-paced: explanation stays until the child taps Next
  function showDiscovery(ch, label, nextAction){
    const card=document.createElement("div"); card.className="quest-card";
    const d=div("discovery");
    d.append(span("discovery-emoji","🔍"), div("discovery-title",pick(PRAISE)+" ⭐"), div("discovery-tip","Did you know? "+(ch.tip||"")));
    card.appendChild(d); el.cardSlot.replaceChildren(card);
    if(!adventure.active) el.modeBadge.textContent="🔍 Discovery!";
    el.answers.className="answers"; el.answers.replaceChildren();
    const next=document.createElement("button"); next.className="big-btn play next-btn"; next.textContent=label;
    next.addEventListener("click",nextAction);
    el.answers.appendChild(next);
    fox(pick(PRAISE)+" Did you know? "+(ch.tip||""));
  }

  function grantSticker(){ const left=STICKERS.filter(s=>!state.stickers.includes(s)); const s=left.length?pick(left):pick(STICKERS); if(!state.stickers.includes(s))state.stickers.push(s); return s; }

  function updateHud(){ el.starCount.textContent=state.stars; el.levelNum.textContent=state.level; el.progressFill.style.width=Math.round((state.progress/STARS_PER_LEVEL)*100)+"%"; if(el.starStat){ el.starStat.classList.remove("bump"); void el.starStat.offsetWidth; el.starStat.classList.add("bump"); } }

  function resetToDraw(msg,say){
    awaitingDraw=true; current=null; locked=false; el.modeBadge.textContent="🧪 New experiment?";
    el.answers.className="answers"; el.answers.replaceChildren();
    const back=document.createElement("button"); back.className="quest-card card-back"; back.setAttribute("aria-label","Draw an experiment card");
    back.appendChild(span("card-back-art","🎴")); back.appendChild(span("card-back-text","Tap to explore")); back.addEventListener("click",drawNow);
    el.cardSlot.replaceChildren(back); if(msg)fox(msg,!!say); setFox("happy");
  }
  function drawNow(){ if(!awaitingDraw)return; ensureAudio(); showExperiment(dealExperiment()); }

  /* ---------------- celebration ---------------- */
  function celebrate(newSticker){
    const title=LEVEL_TITLES[(state.level-2+LEVEL_TITLES.length)%LEVEL_TITLES.length];
    el.celebrateBadge.textContent=pick(["🏆","🥇","🌟","🎖️","👑","💎","🔬"]);
    el.celebrateTitle.textContent="Level "+state.level+"!";
    el.celebrateText.textContent="You're a "+title+"! 🎉";
    if(newSticker){el.celebrateSticker.classList.remove("hidden");el.newSticker.textContent=newSticker;} else el.celebrateSticker.classList.add("hidden");
    el.celebrate.classList.remove("hidden"); el.celebrate.setAttribute("aria-hidden","false");
    sfx.levelUp(); setFox("cheer"); foxCheer(); speak("Level up! You're a "+title+"! You earned a new sticker!"); runConfetti();
  }
  function closeCelebrate(){ stopConfetti(); el.celebrate.classList.add("hidden"); el.celebrate.setAttribute("aria-hidden","true"); resetToDraw("New level! Tap the card to keep exploring! 🎴", true); }

  /* ---------------- confetti ---------------- */
  let raf=null,pieces=[],confCanvas=null;
  function runConfetti(cv){ cv=cv||el.confetti; confCanvas=cv; const ctx=cv.getContext("2d"); cv.width=window.innerWidth;cv.height=window.innerHeight; const cols=["#ffd166","#ff7eb6","#7dd3fc","#86efac","#a78bfa","#fef08a"]; pieces=Array.from({length:130},()=>({x:Math.random()*cv.width,y:-20-Math.random()*cv.height,r:5+Math.random()*8,c:pick(cols),vy:2+Math.random()*3,vx:-1.5+Math.random()*3,rot:Math.random()*Math.PI,vr:-0.15+Math.random()*0.3})); const draw=()=>{ctx.clearRect(0,0,cv.width,cv.height);pieces.forEach(p=>{p.y+=p.vy;p.x+=p.vx;p.rot+=p.vr;if(p.y>cv.height+20)p.y=-20;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.fillStyle=p.c;ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*0.6);ctx.restore();});raf=requestAnimationFrame(draw);};draw(); }
  function stopConfetti(){ if(raf)cancelAnimationFrame(raf);raf=null; if(confCanvas){const ctx=confCanvas.getContext("2d");ctx&&ctx.clearRect(0,0,confCanvas.width,confCanvas.height);} }

  /* ---------------- GRAND VOYAGE ---------------- */
  function islandStatus(i){ if(state.crew.includes(ISLANDS[i].id)) return "done"; if(i===state.islandIndex) return "current"; return i<state.islandIndex?"done":"locked"; }
  function buildVoyage(){
    const inner=div("voyage-inner");
    ISLANDS.forEach((isl,i)=>{
      const st=islandStatus(i);
      const node=div("island-node "+st); node.tabIndex=0; node.setAttribute("role","button");
      node.append(span("isl-emoji",isl.icon));
      const info=div("isl-info");
      info.append(div("isl-name",isl.name), div("isl-tag","✨ "+isl.tag),
        div("isl-status", st==="done"?("✅ "+ (ISLANDS[i].crew.emoji) +" recruited"): st==="current"?"▶ Play now!":"🔒 Locked"));
      node.appendChild(info);
      if(st==="done") node.appendChild(span("isl-flag","🚩"));
      if(st==="current") node.appendChild(span("isl-ship","⛵"));
      const go=()=>{ if(st==="locked"){ node.classList.remove("anim"); void node.offsetWidth; sfx.wrong(); fox(""); speak("Finish the island before this one first!"); } else startChapter(isl); };
      node.addEventListener("click",go);
      node.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}});
      inner.appendChild(node);
    });
    el.voyageMap.replaceChildren(inner);
  }
  function startChapter(isl){
    adventure={active:true, island:isl, goal:4, progress:0};
    SCREENS.forEach(s=>el[s].classList.toggle("hidden", s!=="gameScreen"));
    const scr=el.gameScreen; scr.classList.remove("anim"); void scr.offsetWidth; scr.classList.add("anim");
    enterGame();
  }
  function finishChapter(){
    const isl=adventure.island;
    if(!state.crew.includes(isl.id)) state.crew.push(isl.id);
    const i=ISLANDS.findIndex(x=>x.id===isl.id);
    if(i+1>state.islandIndex) state.islandIndex=Math.min(i+1, ISLANDS.length-1);
    adventure.active=false; save();
    el.recruitEmoji.textContent=isl.crew.emoji;
    el.recruitName.textContent="🎉 "+isl.crew.name;
    el.recruitBio.textContent=isl.crew.bio;
    el.recruitJoin.textContent= isl.id==="treasure" ? "You finished the Grand Voyage! 🏆" : "joined your crew! 🎉";
    el.recruit.classList.remove("hidden"); el.recruit.setAttribute("aria-hidden","false");
    sfx.levelUp(); foxCheer(); speak(isl.crew.name+"! "+isl.crew.bio); runConfetti(el.recruitConfetti);
  }
  function closeRecruit(){ stopConfetti(); el.recruit.classList.add("hidden"); el.recruit.setAttribute("aria-hidden","true"); showScreen("voyageScreen"); }
  function openCrew(){
    el.crewGrid.replaceChildren(...ISLANDS.map(isl=>{
      const got=state.crew.includes(isl.id);
      const c=div("crew-cell "+(got?"got":"locked"));
      c.append(span("cc-emoji",got?isl.crew.emoji:"❔"), div("cc-name",got?isl.crew.name.split(" ")[0]:"???"));
      return c;
    }));
    el.crewModal.classList.remove("hidden");
  }

  /* ---------------- home / stickers / settings ---------------- */
  function refreshHome(){ if(state.stars>0){el.savedBadge.classList.remove("hidden");el.savedBadge.textContent=`⭐ ${state.stars} stars • Level ${state.level} • ${state.stickers.length} stickers`;} else el.savedBadge.classList.add("hidden"); }
  function openStickers(){ el.stickerGrid.replaceChildren(...STICKERS.map(s=>{const got=state.stickers.includes(s);return div("sticker-cell "+(got?"got":"empty"),got?s:"❔");})); el.stickerModal.classList.remove("hidden"); }
  function refreshToggles(){ el.soundToggle.textContent=state.sound?"🔊 Sound":"🔇 Sound";el.soundToggle.setAttribute("aria-pressed",String(state.sound)); el.voiceToggle.textContent=state.voice?"🗣️ Voice":"🤐 Voice";el.voiceToggle.setAttribute("aria-pressed",String(state.voice)); }

  function openAI(){ el.aiProvider.value=ai.provider; el.aiBase.value=ai.base; el.aiKey.value=ai.key; el.aiModel.value=ai.model; el.aiBaseRow.style.display = ai.provider==="anthropic"?"block":"block"; el.aiModal.classList.remove("hidden"); }
  function saveAISettings(){ ai.provider=el.aiProvider.value; ai.base=el.aiBase.value.trim(); ai.key=el.aiKey.value.trim(); ai.model=el.aiModel.value.trim(); saveAI(); el.aiModal.classList.add("hidden"); el.aiBadge.classList.toggle("hidden",!ai.key); }
  function clearAISettings(){ ai={provider:"anthropic",base:"",key:"",model:""}; saveAI(); el.aiKey.value="";el.aiBase.value="";el.aiModel.value=""; el.aiBadge.classList.add("hidden"); }

  /* ---------------- init ---------------- */
  function init(){
    load(); refreshToggles(); refreshHome(); injectFoxies(); initBokeh();

    // menu navigation
    document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{ ensureAudio(); showScreen(b.getAttribute("data-go")); }));
    el.homeStickersBtn.addEventListener("click",openStickers);
    el.homeHowBtn.addEventListener("click",()=>el.howModal.classList.remove("hidden"));
    el.homeCrewBtn.addEventListener("click",openCrew);
    el.voyageCrewBtn.addEventListener("click",openCrew);
    el.closeCrew.addEventListener("click",()=>el.crewModal.classList.add("hidden"));
    el.crewModal.addEventListener("click",e=>{if(e.target===el.crewModal)el.crewModal.classList.add("hidden");});
    el.recruitBtn.addEventListener("click",closeRecruit);
    el.recruit.addEventListener("click",e=>{if(e.target===el.recruit)closeRecruit();});

    // intro
    el.introNext.addEventListener("click",introNext);
    el.introSkip.addEventListener("click",()=>showScreen("gameScreen"));
    el.introReplay.addEventListener("click",startIntro);

    // story
    el.storyNext.addEventListener("click",storyNext);
    el.storyPrev.addEventListener("click",storyPrev);
    el.storyRepeat.addEventListener("click",renderStory);

    // teacher
    el.askBtn.addEventListener("click",askQuestion);
    el.askInput.addEventListener("keydown",e=>{if(e.key==="Enter")askQuestion();});
    el.teacherRepeat.addEventListener("click",()=>speak(el.teacherAnswer.textContent));

    // game
    el.drawCard && el.drawCard.addEventListener("click",drawNow);
    el.repeatBtn.addEventListener("click",()=>{ if(current)speak(current.question+" "+(current.tip||"")); else speak("Tap the card to start an experiment!"); });

    // toggles
    el.soundToggle.addEventListener("click",()=>{state.sound=!state.sound;save();refreshToggles();if(state.sound){ensureAudio();sfx.draw();}});
    el.voiceToggle.addEventListener("click",()=>{state.voice=!state.voice;save();refreshToggles();if(state.voice)speak("Hi! I'm Foxy. Let's discover together!");});
    el.grownupBtn.addEventListener("click",openAI);

    // modals
    el.closeHow.addEventListener("click",()=>el.howModal.classList.add("hidden"));
    el.howModal.addEventListener("click",e=>{if(e.target===el.howModal)el.howModal.classList.add("hidden");});
    el.closeStickers.addEventListener("click",()=>el.stickerModal.classList.add("hidden"));
    el.stickerModal.addEventListener("click",e=>{if(e.target===el.stickerModal)el.stickerModal.classList.add("hidden");});
    el.aiProvider.addEventListener("change",()=>{ el.aiBase.placeholder = el.aiProvider.value==="anthropic"?"https://api.anthropic.com":"https://your-endpoint/v1"; el.aiModel.placeholder = el.aiProvider.value==="anthropic"?"claude-haiku-4-5-20251001":"gpt-4o-mini"; });
    el.aiSave.addEventListener("click",saveAISettings);
    el.aiClear.addEventListener("click",clearAISettings);
    el.aiClose.addEventListener("click",()=>el.aiModal.classList.add("hidden"));
    el.aiModal.addEventListener("click",e=>{if(e.target===el.aiModal)el.aiModal.classList.add("hidden");});

    // celebration
    el.celebrateBtn.addEventListener("click",closeCelebrate);
    el.celebrate.addEventListener("click",e=>{if(e.target===el.celebrate)closeCelebrate();});

    window.addEventListener("resize",()=>{if(raf){el.confetti.width=window.innerWidth;el.confetti.height=window.innerHeight;}});
    if("speechSynthesis"in window)window.speechSynthesis.getVoices();

    // expose generators for tests (harmless in browser)
    window.__foxytest={dealExperiment,diff,state,makeExp,ISLANDS,expCount,expCompare,expGuess,expSort,expSurvey,expPattern,expShare,expChance,expRiddle,expBigNumber,expSeqNumber,expOddOne,expChartValue,buildOption,bestMatch};
  }

  document.addEventListener("DOMContentLoaded",init);
})();
