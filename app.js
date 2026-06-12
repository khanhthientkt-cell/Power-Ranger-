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
  const modelSelect = $("modelSelect");
  const saveSettings = $("saveSettings");
  const closeSettings = $("closeSettings");
  const clearKey = $("clearKey");

  // State
  let currentText = "";
  let currentAnalysis = null;

  // ---- Settings persistence ----
  const LS_KEY = "paperlens_apikey";
  const LS_MODEL = "paperlens_model";
  function loadSettings() {
    apiKeyInput.value = localStorage.getItem(LS_KEY) || "";
    modelSelect.value = localStorage.getItem(LS_MODEL) || "claude-sonnet-4-6";
  }
  loadSettings();

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
  async function generateAISummary() {
    const key = localStorage.getItem(LS_KEY);
    if (!key) {
      openSettings();
      setStatus("Add a Claude API key to enable AI summaries.", "error");
      return;
    }
    const model = localStorage.getItem(LS_MODEL) || "claude-sonnet-4-6";
    const body = $("summaryBody");
    const btn = $("aiSummaryBtn");
    btn.disabled = true;
    body.innerHTML = `<p class="muted"><span class="spinner"></span> Analyzing with ${model}…</p>`;

    // Trim text to keep request reasonable
    const excerpt = currentText.slice(0, 24000);
    const prompt =
      "You are an expert research assistant. Analyze the following journal paper text and respond in Markdown with these sections:\n" +
      "## TL;DR (2-3 sentences)\n## Key Contributions (bullets)\n## Methods (brief)\n## Main Findings (bullets)\n## Limitations & Caveats (bullets)\n## Who should read this\n\n" +
      "Be concise and specific. If information is missing, say so.\n\nPAPER TEXT:\n" + excerpt;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data = await res.json();
      const md = (data.content || []).map((b) => b.text || "").join("\n");
      body.innerHTML = `<div class="ai-content">${miniMarkdown(md)}</div>`;
      currentAnalysis.aiSummary = md;
    } catch (err) {
      console.error(err);
      body.innerHTML = `<p class="status error">Failed: ${escapeHtml(err.message)}</p>
        <p class="muted small">If you see a CORS or network error, your environment may block direct browser API calls.</p>`;
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
    localStorage.setItem(LS_MODEL, modelSelect.value);
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
