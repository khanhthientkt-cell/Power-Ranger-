/* PaperLens — client-side journal paper analyzer */
(function () {
  "use strict";

  // Configure pdf.js worker
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const dropzone = $("dropzone");
  const fileInput = $("fileInput");
  const textInput = $("textInput");
  const analyzeBtn = $("analyzeBtn");
  const clearBtn = $("clearBtn");
  const statusEl = $("status");
  const results = $("results");
  const sampleBtn = $("sampleBtn");

  // Settings modal
  const settingsBtn = $("settingsBtn");
  const settingsModal = $("settingsModal");
  const apiKeyInput = $("apiKey");
  const modelInput = $("modelInput");
  const providerSelect = $("providerSelect");
  const baseUrlInput = $("baseUrl");
  const settingsHint = $("settingsHint");
  const saveSettings = $("saveSettings");
  const closeSettings = $("closeSettings");
  const clearKey = $("clearKey");

  // State
  let currentText = "";
  let currentAnalysis = null;

  // ---- Settings persistence ----
  const LS_KEY = "paperlens_apikey";
  const LS_MODEL = "paperlens_model";
  const LS_PROVIDER = "paperlens_provider";
  const LS_BASEURL = "paperlens_baseurl";

  const PROVIDER_DEFAULTS = {
    anthropic: { baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-6" },
    // Pre-filled custom endpoint (the key is NOT stored here — paste it below).
    openai: { baseUrl: "http://211.20.245.95:21434/v1", model: "" },
  };

  function getProvider() { return localStorage.getItem(LS_PROVIDER) || "anthropic"; }
  function getBaseUrl() {
    return (localStorage.getItem(LS_BASEURL) || PROVIDER_DEFAULTS[getProvider()].baseUrl).replace(/\/+$/, "");
  }
  function getModel() {
    return localStorage.getItem(LS_MODEL) || PROVIDER_DEFAULTS[getProvider()].model;
  }

  function updateSettingsHint() {
    const p = providerSelect.value;
    const baseRow = $("baseUrlRow");
    if (p === "openai") {
      if (baseRow) baseRow.style.display = "";
      settingsHint.innerHTML =
        "OpenAI-compatible mode calls <code>{base}/chat/completions</code>. " +
        "Note: an <strong>http://</strong> endpoint only works when this site is opened over http " +
        "(e.g. locally) — browsers block http calls from an https page.";
    } else {
      // Anthropic: base URL is fixed, so hide it to keep things simple.
      if (baseRow) baseRow.style.display = "none";
      settingsHint.innerHTML =
        "Paste an Anthropic key (<code>sk-ant-…</code>) and pick a model. " +
        "Works on the live https site — no extra setup.";
    }
  }

  function loadSettings() {
    const provider = getProvider();
    providerSelect.value = provider;
    apiKeyInput.value = localStorage.getItem(LS_KEY) || "";
    baseUrlInput.value = getBaseUrl();
    modelInput.value = getModel();
    updateSettingsHint();
  }
  loadSettings();

  // When provider changes in the modal, swap in that provider's defaults
  providerSelect.addEventListener("change", () => {
    const d = PROVIDER_DEFAULTS[providerSelect.value];
    baseUrlInput.value = d.baseUrl;
    modelInput.value = d.model;
    updateSettingsHint();
  });

  // ---- Status helper ----
  function setStatus(msg, type) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (type ? " " + type : "");
  }

  // ===================================================================
  //  TEXT EXTRACTION
  // ===================================================================
  async function extractFromPDF(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      setStatus(`Reading PDF… page ${i}/${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Group items into lines by their y position to preserve structure
      let lastY = null;
      let line = "";
      for (const item of content.items) {
        const y = item.transform[5];
        if (lastY !== null && Math.abs(y - lastY) > 3) {
          text += line.trim() + "\n";
          line = "";
        }
        line += item.str + " ";
        lastY = y;
      }
      text += line.trim() + "\n\n";
    }
    return text;
  }

  async function handleFile(file) {
    if (!file) return;
    try {
      setStatus("Loading file…");
      let text = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (!window.pdfjsLib) throw new Error("PDF reader failed to load (check network).");
        text = await extractFromPDF(file);
      } else {
        text = await file.text();
      }
      textInput.value = text;
      setStatus(`Loaded "${file.name}" (${text.length.toLocaleString()} chars). Click Analyze.`, "success");
    } catch (err) {
      console.error(err);
      setStatus("Could not read file: " + err.message, "error");
    }
  }

  // ===================================================================
  //  ANALYSIS
  // ===================================================================
  const STOPWORDS = new Set(("a an the and or but if then else for to of in on at by with from as is are was were be been being this that these those it its their our your his her we they he she you i not no do does did has have had will would can could should may might must also into over under more most such than too very just only other some any each both few many much our out up down about which who whom whose what when where why how all another between because before after during above below off again further once here there own same so s t can will don should now").split(/\s+/));

  function countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, "");
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
    word = word.replace(/^y/, "");
    const m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }

  function detectTitle(text) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 12)) {
      const words = line.split(/\s+/);
      if (
        words.length >= 4 &&
        words.length <= 30 &&
        line.length < 200 &&
        !/^(abstract|introduction|keywords|doi|http|©|copyright)/i.test(line) &&
        !/\d{4}/.test(line.slice(0, 4))
      ) {
        return line;
      }
    }
    return lines[0] || "Untitled paper";
  }

  function extractSection(text, names) {
    // Find a heading line matching any name, capture until next heading-like line
    const lines = text.split("\n");
    const headingRe = new RegExp("^\\s*(?:\\d+\\.?\\s*)?(" + names.join("|") + ")\\b", "i");
    const nextHeadingRe = /^\s*(?:\d+\.?\s*)?(introduction|abstract|background|related work|methods?|methodology|materials and methods|results?|discussion|conclusions?|references|acknowledg|appendix)\b/i;
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (headingRe.test(lines[i]) && lines[i].trim().length < 80) { start = i; break; }
    }
    if (start === -1) return null;
    let body = [];
    for (let i = start + 1; i < lines.length; i++) {
      if (nextHeadingRe.test(lines[i]) && lines[i].trim().length < 80) break;
      body.push(lines[i]);
    }
    const content = body.join("\n").trim();
    return content.length > 0 ? content : null;
  }

  const SECTIONS = [
    { key: "Abstract", names: ["abstract", "summary"] },
    { key: "Introduction", names: ["introduction", "background"] },
    { key: "Methods", names: ["methods?", "methodology", "materials and methods", "experimental"] },
    { key: "Results", names: ["results?", "findings", "results and discussion"] },
    { key: "Discussion", names: ["discussion"] },
    { key: "Conclusion", names: ["conclusions?", "concluding remarks"] },
    { key: "References", names: ["references", "bibliography", "works cited"] },
  ];

  function extractReferences(text) {
    const section = extractSection(text, ["references", "bibliography", "works cited"]);
    if (!section) return [];
    let refs = [];
    // Try numbered references first: [1] ... or 1. ...
    const numbered = section.split(/\n(?=\s*(?:\[\d+\]|\d+\.)\s)/);
    if (numbered.length > 3) {
      refs = numbered;
    } else {
      // Fallback: split by lines that look like new entries (start with author surname + year nearby)
      refs = section.split(/\n(?=[A-Z][a-z]+,?\s)/);
    }
    return refs
      .map((r) => r.replace(/\s+/g, " ").trim())
      .filter((r) => r.length > 25);
  }

  function countCitations(text) {
    const inText = (text.match(/\[\d+(?:\s*[-,–]\s*\d+)*\]/g) || []).length;
    const author = (text.match(/\([A-Z][A-Za-z]+(?: et al\.?)?,?\s*\d{4}[a-z]?\)/g) || []).length;
    return inText + author;
  }

  function keywordFrequency(text, limit) {
    const words = text.toLowerCase().match(/[a-z][a-z\-]{2,}/g) || [];
    const freq = {};
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  }

  function topSentences(text, limit) {
    // Score sentences by presence of signal phrases and keyword density
    const body = text.replace(/\n+/g, " ");
    const sentences = body.match(/[^.!?]+[.!?]+/g) || [];
    const kws = new Set(keywordFrequency(text, 25).map((k) => k.word));
    const signals = /\b(we (show|find|propose|present|demonstrate|introduce)|our (results?|findings|study|approach)|in conclusion|these results|significant|novel|we conclude|this (paper|study|work)|results (show|indicate|suggest)|key contribution)\b/i;
    const scored = sentences
      .map((s) => s.trim())
      .filter((s) => s.split(/\s+/).length >= 6 && s.split(/\s+/).length <= 60)
      .map((s) => {
        let score = 0;
        if (signals.test(s)) score += 5;
        const ws = s.toLowerCase().match(/[a-z\-]{3,}/g) || [];
        for (const w of ws) if (kws.has(w)) score += 1;
        return { s, score: score / Math.sqrt(ws.length || 1) };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((x) => x.s);
  }

  function extractAcronyms(text) {
    const found = {};
    // Pattern: "Some Full Form (ACR)" — expansion before the parenthesised acronym
    const defRe = /([A-Z][\w-]+(?:\s+[A-Za-z][\w-]+){0,5})\s+\(([A-Z][A-Za-z]*[A-Z][A-Za-z0-9]{0,5})\)/g;
    let m;
    while ((m = defRe.exec(text)) !== null) {
      const acr = m[2];
      const words = m[1].trim().split(/\s+/);
      // Heuristic: expansion should have at least as many words as the acronym has letters (roughly)
      const letters = acr.replace(/[^A-Z]/g, "").length;
      const expansion = words.slice(-Math.min(words.length, letters + 2)).join(" ");
      if (!found[acr]) found[acr] = { acronym: acr, expansion, count: 0 };
    }
    // Count occurrences of every acronym-like token (2-6 uppercase letters/digits)
    const tokens = text.match(/\b[A-Z][A-Z0-9]{1,5}\b/g) || [];
    const counts = {};
    for (const t of tokens) counts[t] = (counts[t] || 0) + 1;
    // Add frequent standalone acronyms not already captured
    for (const [t, c] of Object.entries(counts)) {
      if (c >= 2 && !/^(THE|AND|FOR|WITH|THIS|THAT|FROM|WERE|HTTP|HTTPS|PDF|DOI|II|III|IV)$/.test(t)) {
        if (found[t]) found[t].count = c;
        else found[t] = { acronym: t, expansion: "", count: c };
      }
    }
    // Fill counts for defined ones missing it
    for (const k of Object.keys(found)) if (!found[k].count) found[k].count = counts[k] || 1;
    return Object.values(found)
      .filter((a) => a.expansion || a.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }

  function scanEvidence(text) {
    const uniq = (re) => Array.from(new Set(text.match(re) || []));
    const pValues = text.match(/\bp\s*[<>=]\s*0?\.\d+/gi) || [];
    const sampleSizes = text.match(/\bn\s*=\s*\d[\d,]*/gi) || [];
    const cis = text.match(/\b\d{2,3}\s*%\s*CI\b/gi) || text.match(/confidence interval/gi) || [];
    const ciCount = (text.match(/\b\d{2,3}\s*%\s*CI\b/gi) || []).length + (text.match(/confidence intervals?/gi) || []).length;
    const figures = uniq(/\bfig(?:ure)?\.?\s*\d+/gi).length;
    const tables = uniq(/\btable\s*\d+/gi).length;
    const equations = uniq(/\b(?:eq(?:uation)?\.?\s*)\(?\d+\)?/gi).length;
    const effectSizes = (text.match(/\b(cohen'?s\s*d|odds ratio|hazard ratio|\bOR\s*=|\bRR\s*=|\bη2|\beta\^?2|\br\s*=\s*[-0]?\.\d+|R\^?2\s*=)/gi) || []).length;
    return {
      pValues: pValues.length,
      pValueExamples: Array.from(new Set(pValues)).slice(0, 4),
      sampleSizes: sampleSizes.length,
      sampleExamples: Array.from(new Set(sampleSizes)).slice(0, 4),
      confidenceIntervals: ciCount,
      effectSizes,
      figures,
      tables,
      equations,
    };
  }

  function criticalAppraisal(text) {
    const t = text;
    const checks = [
      { key: "Research question / hypothesis", re: /\b(hypothes\w+|research question|we (aim|investigate|propose|ask|hypothesize)|objective of (this|the) (study|paper)|address(es)? the (question|problem))\b/i, hint: "States what the paper sets out to answer" },
      { key: "Methods described", re: /\b(method(s|ology)?|materials and methods|experimental setup|procedure|we (trained|measured|collected|conducted))\b/i, hint: "Explains how the work was done" },
      { key: "Sample / participants / data", re: /\b(participants?|subjects?|sample size|\bn\s*=\s*\d|datasets?|benchmark|corpus|corpora|cohort|respondents?)\b/i, hint: "Describes the data or population studied" },
      { key: "Statistical analysis", re: /\b(statistical|significan\w+|p\s*[<>=]\s*0?\.\d|regression|t-test|anova|confidence interval|standard deviation)\b/i, hint: "Reports quantitative analysis" },
      { key: "Limitations acknowledged", re: /\b(limitation|caveat|shortcoming|drawback|threats? to validity)\b/i, hint: "Discusses weaknesses honestly" },
      { key: "Future work", re: /\b(future (work|research|directions|studies)|further (study|research|investigation))\b/i, hint: "Points to next steps" },
      { key: "Funding disclosed", re: /\b(fund(ing|ed)|grant\s*(no|number|#)?|financial support|supported by)\b/i, hint: "States who paid for the research" },
      { key: "Ethics / consent", re: /\b(ethic\w*|IRB|institutional review|informed consent|ethics committee|declaration of helsinki)\b/i, hint: "Notes ethical approval (esp. human/animal studies)" },
      { key: "Data availability", re: /\b(data (are|is)? ?(publicly )?availab\w+|available (at|on|upon request)|data availability|zenodo|figshare|dryad|osf\.io)\b/i, hint: "Says where the data can be found" },
      { key: "Code / reproducibility", re: /\b(code (is )?available|source code|github\.com|gitlab\.com|open[- ]?source|reproduc\w+|replicat\w+)\b/i, hint: "Enables others to reproduce results" },
    ];
    const results = checks.map((c) => ({ key: c.key, hint: c.hint, found: c.re.test(t) }));
    const score = results.filter((r) => r.found).length;
    return { items: results, score, total: checks.length };
  }

  function analyze(text) {
    const cleanWords = text.match(/[A-Za-z][A-Za-z\-']*/g) || [];
    const wordCount = cleanWords.length;
    const sentences = (text.match(/[^.!?]+[.!?]+/g) || []).filter((s) => s.trim().split(/\s+/).length > 2);
    const sentenceCount = Math.max(sentences.length, 1);
    const syllables = cleanWords.reduce((sum, w) => sum + countSyllables(w), 0);
    const complexWords = cleanWords.filter((w) => countSyllables(w) >= 3).length;

    const wordsPerSentence = wordCount / sentenceCount;
    const syllablesPerWord = syllables / Math.max(wordCount, 1);

    // Flesch Reading Ease & Flesch-Kincaid Grade
    const flesch = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
    const fkGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
    // Gunning Fog
    const fog = 0.4 * (wordsPerSentence + 100 * (complexWords / Math.max(wordCount, 1)));

    const sectionsFound = SECTIONS.map((sec) => {
      const content = extractSection(text, sec.names);
      return { key: sec.key, found: !!content, words: content ? (content.match(/\S+/g) || []).length : 0 };
    });

    const refs = extractReferences(text);

    return {
      title: detectTitle(text),
      wordCount,
      sentenceCount,
      readingMinutes: Math.max(1, Math.round(wordCount / 220)),
      flesch: Math.round(flesch),
      fkGrade: Math.max(0, fkGrade).toFixed(1),
      fog: fog.toFixed(1),
      avgWordsPerSentence: wordsPerSentence.toFixed(1),
      sections: sectionsFound,
      keywords: keywordFrequency(text, 24),
      sentences: topSentences(text, 6),
      references: refs,
      citationCount: countCitations(text),
      acronyms: extractAcronyms(text),
      evidence: scanEvidence(text),
      appraisal: criticalAppraisal(text),
    };
  }

  // ===================================================================
  //  RENDERING
  // ===================================================================
  function fleschLabel(score) {
    if (score >= 70) return "Easy to read";
    if (score >= 50) return "Fairly difficult";
    if (score >= 30) return "Difficult (academic)";
    return "Very difficult";
  }

  function render(a) {
    $("paperTitle").textContent = a.title;

    // Metrics
    $("metricsGrid").innerHTML = [
      ["📝", a.wordCount.toLocaleString(), "Words"],
      ["⏱", a.readingMinutes + " min", "Read time"],
      ["🔗", a.citationCount, "In-text citations"],
      ["📚", a.references.length, "References"],
      ["📖", a.flesch, "Reading ease"],
      ["🎓", a.fkGrade, "Grade level"],
    ].map(([icon, val, label]) =>
      `<div class="metric"><div class="value">${val}</div><div class="label">${icon} ${label}</div></div>`
    ).join("");

    // Structure
    $("structureBody").innerHTML = a.sections.map((s) =>
      `<div class="struct-item">
        <span class="dot ${s.found ? "found" : "missing"}"></span>
        <span class="name">${s.key}</span>
        <span class="meta">${s.found ? s.words.toLocaleString() + " words" : "not detected"}</span>
      </div>`
    ).join("");

    // Keywords
    const maxC = a.keywords.length ? a.keywords[0].count : 1;
    $("keywordsBody").innerHTML =
      `<div class="chips">` +
      a.keywords.map((k) =>
        `<span class="chip">${k.word}<span class="count">${k.count}</span></span>`
      ).join("") +
      `</div>`;

    // Readability bars
    const fleschPct = Math.max(0, Math.min(100, a.flesch));
    const fogPct = Math.max(0, Math.min(100, (a.fog / 20) * 100));
    const fkPct = Math.max(0, Math.min(100, (parseFloat(a.fkGrade) / 20) * 100));
    $("readabilityBody").innerHTML = `
      <div class="bar-row">
        <div class="bar-label"><span>Flesch Reading Ease</span><span>${a.flesch} · ${fleschLabel(a.flesch)}</span></div>
        <div class="bar"><span style="width:${fleschPct}%"></span></div>
      </div>
      <div class="bar-row">
        <div class="bar-label"><span>Flesch–Kincaid grade</span><span>Grade ${a.fkGrade}</span></div>
        <div class="bar"><span style="width:${fkPct}%"></span></div>
      </div>
      <div class="bar-row">
        <div class="bar-label"><span>Gunning Fog index</span><span>${a.fog}</span></div>
        <div class="bar"><span style="width:${fogPct}%"></span></div>
      </div>
      <p class="muted small">Avg ${a.avgWordsPerSentence} words/sentence across ${a.sentenceCount.toLocaleString()} sentences. Lower reading-ease and higher grade are typical for technical papers.</p>
    `;

    // Acronyms
    $("acronymsBody").innerHTML = a.acronyms.length
      ? a.acronyms.map((x) =>
          `<div class="struct-item">
            <span class="name">${escapeHtml(x.acronym)}</span>
            <span style="flex:1;color:var(--muted);font-size:13px;">${x.expansion ? escapeHtml(x.expansion) : "<em>used in text</em>"}</span>
            <span class="meta">×${x.count}</span>
          </div>`
        ).join("")
      : `<p class="muted">No acronyms detected.</p>`;

    // Evidence & statistics
    const ev = a.evidence;
    $("evidenceBody").innerHTML = `
      <div class="stat-grid">
        <div class="stat-pill"><div class="v">${ev.pValues}</div><div class="k">p-values</div></div>
        <div class="stat-pill"><div class="v">${ev.sampleSizes}</div><div class="k">sample sizes (n=)</div></div>
        <div class="stat-pill"><div class="v">${ev.confidenceIntervals}</div><div class="k">confidence intervals</div></div>
        <div class="stat-pill"><div class="v">${ev.effectSizes}</div><div class="k">effect sizes</div></div>
        <div class="stat-pill"><div class="v">${ev.figures}</div><div class="k">figures</div></div>
        <div class="stat-pill"><div class="v">${ev.tables}</div><div class="k">tables</div></div>
        <div class="stat-pill"><div class="v">${ev.equations}</div><div class="k">equations</div></div>
      </div>
      ${(ev.pValueExamples.length || ev.sampleExamples.length)
        ? `<p class="muted small" style="margin-top:10px;">${[...ev.pValueExamples, ...ev.sampleExamples].map(escapeHtml).join(" · ")}</p>`
        : ""}`;

    // Critical appraisal
    const ap = a.appraisal;
    $("appraisalScore").textContent = `${ap.score} / ${ap.total} signals present`;
    $("appraisalBody").innerHTML =
      `<div class="check-grid">` +
      ap.items.map((c) =>
        `<div class="check-item">
          <span class="mark">${c.found ? "✅" : "⬜"}</span>
          <span class="ctext"><strong>${escapeHtml(c.key)}</strong><span>${escapeHtml(c.hint)}</span></span>
        </div>`
      ).join("") +
      `</div>
      <p class="muted small" style="margin-top:10px;">Heuristic keyword scan — a missing item may simply use different wording. Use as a reading aid, not a verdict.</p>`;

    // Highlight sentences
    $("sentencesBody").innerHTML = a.sentences.length
      ? `<ol class="sentence-list">${a.sentences.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`
      : `<p class="muted">No standout sentences detected.</p>`;

    // References
    if (a.references.length) {
      $("referencesBody").innerHTML =
        `<ol class="ref-list collapsed" id="refList">${a.references.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ol>` +
        (a.references.length > 10 ? `<button class="btn ghost small show-more" id="showMoreRefs">Show all ${a.references.length}</button>` : "");
      const btn = $("showMoreRefs");
      if (btn) btn.onclick = () => { $("refList").classList.remove("collapsed"); btn.remove(); };
    } else {
      $("referencesBody").innerHTML = `<p class="muted">No reference list detected.</p>`;
    }

    results.classList.remove("hidden");
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ===================================================================
  //  AI SUMMARY (Claude API, optional)
  // ===================================================================
  // Unified AI call — supports Anthropic and OpenAI-compatible providers.
  async function callAI(userPrompt, maxTokens) {
    const key = localStorage.getItem(LS_KEY);
    if (!key) {
      openSettings();
      setStatus("Add an API key in AI Settings to use AI features.", "error");
      throw new Error("No API key configured.");
    }
    const provider = getProvider();
    const base = getBaseUrl();
    const model = getModel();
    if (!model) throw new Error("No model set in AI Settings.");

    if (provider === "openai") {
      const res = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + key },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }

    // Anthropic
    const res = await fetch(base + "/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: "user", content: userPrompt }] }),
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return (data.content || []).map((b) => b.text || "").join("\n");
  }

  async function generateAISummary() {
    if (!localStorage.getItem(LS_KEY)) { openSettings(); setStatus("Add an API key to enable AI summaries.", "error"); return; }
    const body = $("summaryBody");
    const btn = $("aiSummaryBtn");
    btn.disabled = true;
    body.innerHTML = `<p class="muted"><span class="spinner"></span> Analyzing with ${escapeHtml(getModel() || "AI")}…</p>`;

    const prompt =
      "You are an expert research assistant. Analyze the following journal paper text and respond in Markdown with these sections:\n" +
      "## TL;DR (2-3 sentences)\n## Key Contributions (bullets)\n## Methods (brief)\n## Main Findings (bullets)\n## Limitations & Caveats (bullets)\n## Who should read this\n\n" +
      "Be concise and specific. If information is missing, say so.\n\nPAPER TEXT:\n" + currentText.slice(0, 24000);

    try {
      const md = await callAI(prompt, 1500);
      body.innerHTML = `<div class="ai-content">${miniMarkdown(md)}</div>`;
      currentAnalysis.aiSummary = md;
    } catch (err) {
      console.error(err);
      body.innerHTML = `<p class="status error">Failed: ${escapeHtml(err.message)}</p>
        <p class="muted small">A CORS, network, or "mixed content" error means your browser blocked the request. For an http:// endpoint, open this site over http (e.g. locally).</p>`;
    } finally {
      btn.disabled = false;
    }
  }

  function miniMarkdown(md) {
    return md
      .split(/\n{2,}/)
      .map((block) => {
        if (/^#{1,4}\s/.test(block)) {
          return "<h4>" + escapeHtml(block.replace(/^#{1,4}\s/, "")) + "</h4>";
        }
        if (/^\s*[-*]\s/m.test(block)) {
          const items = block.split(/\n/).filter((l) => /^\s*[-*]\s/.test(l))
            .map((l) => "<li>" + inlineMd(l.replace(/^\s*[-*]\s/, "")) + "</li>").join("");
          return "<ul>" + items + "</ul>";
        }
        return "<p>" + inlineMd(escapeHtml(block)) + "</p>";
      })
      .join("");
  }
  function inlineMd(s) {
    return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  }

  // ===================================================================
  //  EXPORT
  // ===================================================================
  function exportReport() {
    const a = currentAnalysis;
    if (!a) return;
    let md = `# Analysis: ${a.title}\n\n`;
    md += `## Overview\n`;
    md += `- Words: ${a.wordCount}\n- Estimated read time: ${a.readingMinutes} min\n`;
    md += `- In-text citations: ${a.citationCount}\n- References: ${a.references.length}\n`;
    md += `- Flesch Reading Ease: ${a.flesch} (${fleschLabel(a.flesch)})\n`;
    md += `- Flesch–Kincaid grade: ${a.fkGrade}\n- Gunning Fog: ${a.fog}\n\n`;
    md += `## Structure\n`;
    a.sections.forEach((s) => { md += `- ${s.found ? "✅" : "⬜"} ${s.key}${s.found ? ` (${s.words} words)` : ""}\n`; });
    md += `\n## Critical appraisal (${a.appraisal.score}/${a.appraisal.total})\n`;
    a.appraisal.items.forEach((c) => { md += `- ${c.found ? "✅" : "⬜"} ${c.key}\n`; });
    const ev = a.evidence;
    md += `\n## Evidence & statistics\n`;
    md += `- p-values: ${ev.pValues}\n- Sample sizes (n=): ${ev.sampleSizes}\n- Confidence intervals: ${ev.confidenceIntervals}\n`;
    md += `- Effect sizes: ${ev.effectSizes}\n- Figures: ${ev.figures}\n- Tables: ${ev.tables}\n- Equations: ${ev.equations}\n`;
    if (a.acronyms.length) {
      md += `\n## Acronyms\n${a.acronyms.map((x) => `- **${x.acronym}**${x.expansion ? " — " + x.expansion : ""} (×${x.count})`).join("\n")}\n`;
    }
    md += `\n## Key terms\n${a.keywords.map((k) => `${k.word} (${k.count})`).join(", ")}\n\n`;
    md += `## Highlight sentences\n${a.sentences.map((s) => `- ${s}`).join("\n")}\n\n`;
    if (a.aiSummary) md += `## AI Summary\n${a.aiSummary}\n\n`;
    if (a.references.length) md += `## References\n${a.references.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = (a.title.slice(0, 50).replace(/[^\w]+/g, "_") || "paper") + "_analysis.md";
    link.click();
    URL.revokeObjectURL(url);
  }

  // ===================================================================
  //  ASK THE PAPER (AI Q&A)
  // ===================================================================
  const SUGGESTED_QUESTIONS = [
    "What problem does this paper solve?",
    "What are the main findings?",
    "What methods did they use?",
    "What are the limitations?",
    "What data or dataset was used?",
    "How is this different from prior work?",
  ];

  function renderAskSuggestions() {
    $("askSuggestions").innerHTML = SUGGESTED_QUESTIONS
      .map((q) => `<span class="chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</span>`)
      .join("");
    $("askSuggestions").querySelectorAll(".chip").forEach((el) => {
      el.addEventListener("click", () => { $("askInput").value = el.dataset.q; askQuestion(); });
    });
  }

  async function askQuestion() {
    const q = $("askInput").value.trim();
    if (!q) return;
    if (!currentText) { setStatus("Analyze a paper first.", "error"); return; }
    if (!localStorage.getItem(LS_KEY)) { openSettings(); setStatus("Add an API key to ask questions.", "error"); return; }
    const thread = $("askThread");
    const item = document.createElement("div");
    item.className = "qa";
    item.innerHTML = `<div class="q">❓ ${escapeHtml(q)}</div><div class="a"><span class="spinner"></span> Thinking…</div>`;
    thread.prepend(item);
    $("askInput").value = "";
    $("askBtn").disabled = true;

    const prompt =
      "Answer the question using ONLY the paper text below. If the answer is not in the text, say so clearly. Be concise and cite the relevant section when possible.\n\n" +
      "QUESTION: " + q + "\n\nPAPER TEXT:\n" + currentText.slice(0, 24000);
    try {
      const answer = await callAI(prompt, 1000);
      item.querySelector(".a").innerHTML = `<div class="ai-content">${miniMarkdown(answer)}</div>`;
    } catch (err) {
      item.querySelector(".a").innerHTML = `<span class="status error">Failed: ${escapeHtml(err.message)}</span>`;
    } finally {
      $("askBtn").disabled = false;
    }
  }

  // ===================================================================
  //  PAPER LIBRARY (localStorage)
  // ===================================================================
  const LIB_KEY = "paperlens_library";
  function loadLibrary() {
    try { return JSON.parse(localStorage.getItem(LIB_KEY) || "[]"); } catch { return []; }
  }
  function saveLibrary(lib) {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); return true; }
    catch { setStatus("Library is full — delete some saved papers.", "error"); return false; }
  }
  function saveCurrentToLibrary() {
    if (!currentAnalysis) return;
    const lib = loadLibrary();
    if (lib.some((p) => p.title === currentAnalysis.title && p.wordCount === currentAnalysis.wordCount)) {
      setStatus("This paper is already in your library.", "success");
      return;
    }
    lib.unshift({
      id: Date.now(),
      title: currentAnalysis.title,
      date: new Date().toISOString(),
      wordCount: currentAnalysis.wordCount,
      analysis: currentAnalysis,
      text: currentText.slice(0, 60000),
    });
    while (lib.length > 25) lib.pop();
    if (saveLibrary(lib)) setStatus("Saved to library.", "success");
  }
  function renderLibrary() {
    const lib = loadLibrary();
    const list = $("libraryList");
    if (!lib.length) {
      list.innerHTML = `<p class="muted">No saved papers yet. Analyze a paper, then click “⭐ Save to library”.</p>`;
      return;
    }
    list.innerHTML = lib.map((p) =>
      `<div class="lib-item">
        <div>
          <div class="lib-title">${escapeHtml(p.title)}</div>
          <div class="lib-meta">${new Date(p.date).toLocaleDateString()} · ${p.wordCount.toLocaleString()} words</div>
        </div>
        <div class="lib-actions">
          <button class="btn ghost small" data-open="${p.id}">Open</button>
          <button class="btn ghost small danger" data-del="${p.id}">Delete</button>
        </div>
      </div>`
    ).join("");
    list.querySelectorAll("[data-open]").forEach((b) =>
      b.addEventListener("click", () => openFromLibrary(Number(b.dataset.open)))
    );
    list.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", () => {
        saveLibrary(loadLibrary().filter((p) => p.id !== Number(b.dataset.del)));
        renderLibrary();
      })
    );
  }
  function openFromLibrary(id) {
    const p = loadLibrary().find((x) => x.id === id);
    if (!p) return;
    currentAnalysis = p.analysis;
    currentText = p.text || "";
    textInput.value = currentText;
    render(currentAnalysis);
    $("summaryBody").innerHTML =
      `<p class="muted">Add your Claude API key in <strong>AI Settings</strong> to generate a plain-language summary.</p>`;
    $("askThread").innerHTML = "";
    renderAskSuggestions();
    $("libraryPanel").classList.add("hidden");
    setStatus(`Opened "${p.title}" from library.`, "success");
  }

  // ===================================================================
  //  EVENTS
  // ===================================================================
  function runAnalysis() {
    const text = textInput.value.trim();
    if (text.length < 100) {
      setStatus("Please add a paper with at least ~100 characters of text.", "error");
      return;
    }
    setStatus("Analyzing…");
    currentText = text;
    // Defer so UI can paint the status
    setTimeout(() => {
      try {
        currentAnalysis = analyze(text);
        render(currentAnalysis);
        // Reset AI summary card
        $("summaryBody").innerHTML =
          `<p class="muted">Add your Claude API key in <strong>AI Settings</strong> to generate a plain-language summary, key contributions, and limitations.</p>`;
        // Reset Ask-the-paper
        $("askThread").innerHTML = "";
        renderAskSuggestions();
        setStatus(`Done. Analyzed ${currentAnalysis.wordCount.toLocaleString()} words.`, "success");
      } catch (err) {
        console.error(err);
        setStatus("Analysis error: " + err.message, "error");
      }
    }, 30);
  }

  analyzeBtn.addEventListener("click", runAnalysis);
  clearBtn.addEventListener("click", () => {
    textInput.value = "";
    results.classList.add("hidden");
    setStatus("");
    currentText = "";
    currentAnalysis = null;
  });
  $("exportBtn").addEventListener("click", exportReport);
  $("aiSummaryBtn").addEventListener("click", generateAISummary);

  // Ask the paper
  $("askBtn").addEventListener("click", askQuestion);
  $("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") askQuestion(); });

  // Library
  $("saveLibraryBtn").addEventListener("click", saveCurrentToLibrary);
  $("libraryBtn").addEventListener("click", () => {
    renderLibrary();
    $("libraryPanel").classList.toggle("hidden");
    if (!$("libraryPanel").classList.contains("hidden")) {
      $("libraryPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
  $("closeLibraryBtn").addEventListener("click", () => $("libraryPanel").classList.add("hidden"));

  // File handling
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  // Settings modal
  function openSettings() { loadSettings(); settingsModal.classList.remove("hidden"); }
  settingsBtn.addEventListener("click", openSettings);
  closeSettings.addEventListener("click", () => settingsModal.classList.add("hidden"));
  settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) settingsModal.classList.add("hidden"); });
  saveSettings.addEventListener("click", () => {
    localStorage.setItem(LS_KEY, apiKeyInput.value.trim());
    localStorage.setItem(LS_PROVIDER, providerSelect.value);
    localStorage.setItem(LS_BASEURL, baseUrlInput.value.trim());
    localStorage.setItem(LS_MODEL, modelInput.value.trim());
    settingsModal.classList.add("hidden");
    setStatus("AI settings saved.", "success");
  });
  clearKey.addEventListener("click", () => {
    localStorage.removeItem(LS_KEY);
    apiKeyInput.value = "";
    setStatus("API key removed.", "success");
  });

  // Sample paper
  sampleBtn.addEventListener("click", () => {
    textInput.value = SAMPLE_PAPER;
    setStatus("Sample paper loaded. Click Analyze.", "success");
  });

  // ---- Embedded sample paper ----
  const SAMPLE_PAPER = `Attention-Guided Sparse Transformers for Efficient Long-Document Summarization

Abstract
Long-document summarization remains challenging because standard transformer models scale quadratically with sequence length. We propose AGST, an attention-guided sparse transformer that dynamically selects salient tokens before applying full self-attention. Across three benchmark datasets, AGST reduces memory usage by 58% while improving ROUGE-L by 2.3 points over strong baselines. Our results suggest that learned sparsity can match or exceed dense attention for documents exceeding 8,000 tokens.

Keywords: summarization, sparse attention, transformers, efficiency

1. Introduction
The proliferation of long-form scientific and legal documents has increased demand for automatic summarization systems. Traditional transformer architectures, while effective, incur prohibitive computational costs as input length grows. In this work we address the question of whether learned token selection can preserve summarization quality while substantially reducing cost. We introduce AGST and demonstrate its effectiveness on multiple benchmarks.

2. Related Work
Prior approaches to efficient attention include fixed sparse patterns (Child et al., 2019) and low-rank approximations [12]. Unlike these methods, our approach learns which tokens to attend to in a data-driven manner.

3. Methods
AGST consists of two stages. First, a lightweight scoring network assigns a saliency score to each token. Second, the top-k tokens are passed to a standard multi-head self-attention layer. We train the scoring network jointly with the summarization objective using a straight-through estimator. All models were trained for 40 epochs on 8 A100 GPUs using the Adam optimizer with a learning rate of 3e-5.

4. Results
We evaluate AGST on arXiv, PubMed, and GovReport. AGST achieves a ROUGE-L of 41.2 on arXiv, outperforming the dense baseline by 2.3 points. Memory consumption is reduced by 58% on average. These results indicate that learned sparsity is effective for long inputs.

5. Discussion
The improvements are most pronounced on documents longer than 8,000 tokens, suggesting that token selection becomes increasingly valuable at scale. A limitation of our approach is the additional overhead of the scoring network for short documents, where dense attention remains competitive.

6. Conclusion
We presented AGST, an attention-guided sparse transformer for long-document summarization. Our experiments show that learned sparsity reduces cost while maintaining quality. Future work will explore applications to multimodal inputs.

References
[1] Child, R., Gray, S., Radford, A., and Sutskever, I. (2019). Generating long sequences with sparse transformers. arXiv preprint arXiv:1904.10509.
[2] Beltagy, I., Peters, M. E., and Cohan, A. (2020). Longformer: The long-document transformer. arXiv preprint arXiv:2004.05150.
[3] Zaheer, M., Guruganesh, G., et al. (2020). Big Bird: Transformers for longer sequences. NeurIPS.
[4] Lewis, M., Liu, Y., et al. (2020). BART: Denoising sequence-to-sequence pre-training. ACL.
[5] Vaswani, A., Shazeer, N., et al. (2017). Attention is all you need. NeurIPS.`;

  setStatus("Ready. Upload a PDF, paste text, or try a sample.");
})();
