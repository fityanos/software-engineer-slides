import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";

// ---------- Helpers ----------

function splitIntoSlides(raw, maxChars = 280) {
  if (!raw) return [];
  const cleaned = raw.replace(/\r/g, "").trim();
  const blocks = cleaned.split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  const sentences = cleaned.split(/[.!?؟:؛]+\s+/);
  const slides = []; let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > maxChars && buf.trim().length > 0) { slides.push(buf.trim()); buf = s; }
    else { buf = (buf + " " + s).trim(); }
  }
  if (buf.trim()) slides.push(buf.trim());
  return slides;
}

function pickTitleAndBody(block) {
  const lines = block.split(/\n/);
  let title = lines[0].trim();
  let body = lines.slice(1).join("\n").trim();
  if (title.length > 80 || !/^[#\-•\w]/.test(title)) {
    const parts = block.split(/[.!?؟:؛]+\s+/);
    const t = (parts[0] || "").trim();
    if (t && t.length <= 80) { title = t; body = block.slice(t.length).trim(); }
    else { title = (block.slice(0, 70) + (block.length > 70 ? "…" : "")).trim(); body = block.slice(title.length).trim(); }
  }
  title = title.replace(/^\s*[#\-•]+\s*/, "");
  return { title, body };
}

const animations = {
  Fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  Slide: { initial: { x: 50, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -50, opacity: 0 } },
  Zoom: { initial: { scale: 0.95, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.05, opacity: 0 } },
  Wipe: { initial: { clipPath: 'inset(0 0 100% 0)' }, animate: { clipPath: 'inset(0 0 0% 0)' }, exit: { clipPath: 'inset(100% 0 0 0)' } },
  Staggered: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
};

export default function AnimatedSlidesFromText() {
  const [raw, setRaw] = useState("");
  const [theme, setTheme] = useState("dark");
  const [accent, setAccent] = useState("indigo");
  const [anim, setAnim] = useState("Fade");
  const [duration, setDuration] = useState(3);
  const [aspect, setAspect] = useState("16:9");
  const [maxChars, setMaxChars] = useState(280);
  const [titleSize, setTitleSize] = useState(1);
  const [bodySize, setBodySize] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [idx, setIdx] = useState(0);
  const [present, setPresent] = useState(false);
  const [presentScale, setPresentScale] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportScale, setExportScale] = useState(2);
  const [exportPadding, setExportPadding] = useState(40);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [slidesExpanded, setSlidesExpanded] = useState(false);
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [aiTone, setAiTone] = useState("professional");
  const [aiLength, setAiLength] = useState("medium");
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [rateLimitedText, setRateLimitedText] = useState("");

  const blocks = useMemo(() => splitIntoSlides(raw, maxChars), [raw, maxChars]);
  const slides = useMemo(() => blocks.map(pickTitleAndBody), [blocks]);
  const total = slides.length;
  const wordCount = useMemo(() => raw.trim().split(/\s+/).filter(word => word.length > 0).length, [raw]);
  const size = useMemo(() => {
    const w = 1280;
    const h = aspect === "4:3" ? Math.round((w * 3) / 4) : Math.round((w * 9) / 16);
    return { w, h };
  }, [aspect]);


  const previewRef = useRef(null);
  const presentRef = useRef(null);
  const exitBtnRef = useRef(null);
  const timerRef = useRef(null);
  const settingsRef = useRef(null);

  useEffect(() => {
    if (!autoPlay || total === 0) return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => { setIdx((i) => (i + 1) % total); }, duration * 1000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [autoPlay, duration, total]);

  useEffect(() => {
    const onKey = (e) => {
      // Don't trigger shortcuts when typing in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
        return;
      }
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, total - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
      if (e.key.toLowerCase() === "f") setAutoPlay((v) => (present ? !v : v));
      if (e.key.toLowerCase() === "p") setPresent((v) => !v);
      if (e.key === "Escape") setPresent(false);
      if (e.key === "?" || (e.shiftKey && e.key === "/")) setHelpOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, present]);

  useEffect(() => {
    function recalcScale() {
      const vw = window.innerWidth || 1;
      const vh = window.innerHeight || 1;
      const scale = Math.min(vw / size.w, vh / size.h);
      setPresentScale(scale);
    }
    if (present) {
      recalcScale();
      window.addEventListener("resize", recalcScale);
      return () => window.removeEventListener("resize", recalcScale);
    }
  }, [present, size]);

  useEffect(() => {
    async function enterFs() {
      const el = presentRef.current;
      if (el && el.requestFullscreen) {
        try { await el.requestFullscreen(); } catch {}
      }
    }
    async function exitFs() {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch {}
      }
    }
    function onFsChange() {
      if (!document.fullscreenElement && present) {
        // User exited fullscreen via ESC or system UI
        setPresent(false);
      }
    }
    if (present) {
      enterFs();
      document.addEventListener("fullscreenchange", onFsChange);
      return () => document.removeEventListener("fullscreenchange", onFsChange);
    } else {
      exitFs();
    }
  }, [present]);

  // Close settings dropdown on outside click / Esc
  useEffect(() => {
    function onDocClick(e) {
      if (!settingsOpen) return;
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === 'Escape') setSettingsOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [settingsOpen]);

  // Focus management and simple focus trap in presentation
  useEffect(() => {
    if (present && exitBtnRef.current) {
      const prev = document.activeElement;
      exitBtnRef.current.focus();
      function onKeyDown(e) {
        if (e.key === "Tab") {
          e.preventDefault();
          exitBtnRef.current && exitBtnRef.current.focus();
        }
      }
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        if (prev && prev.focus) try { prev.focus(); } catch {}
      };
    }
  }, [present]);

  // Persist and restore settings via URL and localStorage
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const get = (k, d) => params.get(k) ?? localStorage.getItem(`slides:${k}`) ?? d;
    setTheme(get("theme", "dark"));
    setAccent(get("accent", "indigo"));
    setAnim(get("anim", "Fade"));
    setAspect(get("aspect", "16:9"));
    setDuration(Number(get("duration", "3")) || 3);
    setMaxChars(Number(get("maxChars", "280")) || 280);
    setTitleSize(Number(get("titleSize", "1")) || 1);
    setBodySize(Number(get("bodySize", "1")) || 1);
    setIdx(Math.max(0, Math.min(Number(get("idx", "0")) || 0, total - 1)));
    setAiModel(get("aiModel", "gpt-4o-mini"));
    setAiTone(get("aiTone", "inspiring"));
    setAiLength(get("aiLength", "medium"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    // Only set non-default values to keep URLs clean
    if (theme !== "dark") params.set("theme", theme);
    if (accent !== "indigo") params.set("accent", accent);
    if (anim !== "Fade") params.set("anim", anim);
    if (aspect !== "16:9") params.set("aspect", aspect);
    if (duration !== 3) params.set("duration", String(duration));
    if (maxChars !== 280) params.set("maxChars", String(maxChars));
    if (titleSize !== 1) params.set("titleSize", String(titleSize));
    if (bodySize !== 1) params.set("bodySize", String(bodySize));
    if (idx !== 0) params.set("idx", String(idx));
    if (aiModel !== "gpt-4o-mini") params.set("aiModel", aiModel);
    if (aiTone !== "inspiring") params.set("aiTone", aiTone);
    if (aiLength !== "medium") params.set("aiLength", aiLength);
    
    const newUrl = params.toString() ? `${location.pathname}?${params.toString()}` : location.pathname;
    window.history.replaceState(null, "", newUrl);
    localStorage.setItem("slides:theme", theme);
    localStorage.setItem("slides:accent", accent);
    localStorage.setItem("slides:anim", anim);
    localStorage.setItem("slides:aspect", aspect);
    localStorage.setItem("slides:duration", String(duration));
    localStorage.setItem("slides:maxChars", String(maxChars));
    localStorage.setItem("slides:titleSize", String(titleSize));
    localStorage.setItem("slides:bodySize", String(bodySize));
    localStorage.setItem("slides:aiModel", aiModel);
    localStorage.setItem("slides:aiTone", aiTone);
    localStorage.setItem("slides:aiLength", aiLength);
  }, [theme, accent, anim, aspect, duration, maxChars, titleSize, bodySize, idx, aiModel, aiTone, aiLength]);

  const bgClass = theme === "dark" ? "bg-neutral-900 text-neutral-100" : "bg-white text-neutral-900";
  const cardClass = theme === "dark" ? "bg-neutral-800" : "bg-neutral-100";
  const borderClass = theme === "dark" ? "border-neutral-700" : "border-neutral-200";
  const accentGradient = accent === "indigo"
    ? (theme === "dark" ? "linear-gradient(135deg, #60a5fa, #a78bfa)" : "linear-gradient(135deg, #6366f1, #22d3ee)")
    : accent === "emerald"
      ? (theme === "dark" ? "linear-gradient(135deg, #34d399, #60a5fa)" : "linear-gradient(135deg, #10b981, #34d399)")
      : accent === "rose"
        ? (theme === "dark" ? "linear-gradient(135deg, #f472b6, #60a5fa)" : "linear-gradient(135deg, #f43f5e, #fb7185)")
        : "linear-gradient(135deg, #6366f1, #22d3ee)";


  async function exportPNGs() {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < total; i++) {
        setIdx(i);
        await new Promise((r) => setTimeout(r, 300));
        const node = previewRef.current;
        const canvas = await html2canvas(node, { backgroundColor: theme === "dark" ? "#0a0a0a" : "#ffffff", scale: exportScale });
        const blob = await new Promise((res) => canvas.toBlob(res));
        if (blob) zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "slides_png.zip");
    } finally {
      setExporting(false);
    }
  }

  async function exportPPTX() {
    const pptx = new PptxGenJS();
    pptx.layout = aspect === "4:3" ? "LAYOUT_4x3" : "LAYOUT_16x9";
    const titleStyle = { x: 0.5, y: 0.5, w: 9, h: 1.2, fontFace: "Montserrat", fontSize: 36, bold: true, color: theme === "dark" ? "FFFFFF" : "111111" };
    const bodyStyle = { x: 0.7, y: 1.7, w: 8.6, h: 4.5, fontFace: "Montserrat", fontSize: 22, color: theme === "dark" ? "DDDDDD" : "222222" };
    slides.forEach(({ title, body }) => {
      const s = pptx.addSlide();
      s.background = { color: theme === "dark" ? "111111" : "FFFFFF" };
      s.addText(title || " ", titleStyle);
      if (body) {
        const bullets = body.split(/\n|•|\-/).map((t) => t.trim()).filter(Boolean);
        s.addText(bullets.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), bodyStyle);
      }
    });
    const out = await pptx.write({ outputType: "blob" });
    saveAs(out, "slides_from_text.pptx");
  }

  function SlideVisual({ title, body, full = false }) {
    return (
      <div className={`relative w-full h-full ${bgClass} overflow-hidden ${full ? '' : `rounded-2xl shadow-2xl border ${borderClass}`}`}
           style={{ width: full ? size.w : size.w / 2, height: full ? size.h : size.h / 2 }}>
        {/* contextual visual */}
        <div className="absolute inset-0 flex flex-col gap-6" style={{ padding: exportPadding }}>
          <div className="font-extrabold tracking-tight leading-tight" style={{ 
            fontSize: `${(theme === 'dark' ? 48 : 48) * titleSize}px`,
            background: accentGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {title}
          </div>
          {body && (
            anim === 'Staggered'
              ? (
                <div className="opacity-90 leading-relaxed">
                  {body.split(/\n|•|\-/).map((t, i) => t.trim()).filter(Boolean).map((line, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                      className="whitespace-pre-wrap" style={{ fontSize: `${16 * bodySize}px` }}>
                      • {line}
                    </motion.div>
                  ))}
                </div>
              )
              : (
                <div className="opacity-90 whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${16 * bodySize}px` }}>
                  {body}
                </div>
              )
          )}
          {!full && (
            <div className="mt-auto flex items-center justify-between text-xs opacity-60">
              <span>Press ← / → to navigate • Press F to toggle autoplay</span>
              <span>{idx + 1} / {total}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const current = slides[idx] || { title: "", body: "" };
  const animCfg = animations[anim];

  return (
    <div className={`${bgClass} min-h-screen w-full`}>
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <header className="mb-8 pr-32">
          <motion.h1 
            className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent leading-tight"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
            style={{
              backgroundSize: "200% 200%",
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 800,
              lineHeight: "1.1",
              paddingBottom: "0.1em"
            }}
          >
            Software Engineer Slides
          </motion.h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className={`rounded-2xl border ${borderClass} ${cardClass} p-4 flex flex-col gap-4`}>
            <div className="flex justify-between items-start mb-2">
              <label className="text-sm opacity-80 flex-1">Paste your text or context here, I'll auto-chunk by length/sentences with AI touch. Feel free to modify later</label>
              <div className={`text-xs px-2 py-1 rounded-full ml-3 flex items-center gap-1.5 ${wordCount >= 30 ? 'bg-green-500/20 text-green-600 border border-green-500/30' : 'bg-amber-500/20 text-amber-600 border border-amber-500/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${wordCount >= 30 ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                <span className="font-medium">{wordCount}</span>
                {wordCount < 30 && (
                  <span className="text-xs opacity-60">/30</span>
                )}
              </div>
            </div>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={16}
                      className={`w-full rounded-xl p-4 border ${borderClass} bg-transparent focus:outline-none`} placeholder="Paste your text here…" />
            <div className="flex flex-wrap gap-3">
              <motion.button 
                onClick={async () => {
                  // Validate input before generating
                  if (!raw.trim() || wordCount < 30) {
                    setShowValidationModal(true);
                    return;
                  }
                  
                  setGenerating(true);
                  try {
                    const apiUrl = import.meta.env.DEV ? 'http://localhost:8787/api/story' : '/api/story';
                    const res = await fetch(apiUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ raw, tone: aiTone, length: aiLength, model: aiModel })
                    });
                    const data = await res.json();
                    if (res.status === 429) {
                      // Rate limit exceeded - show donation popup
                      setRateLimitedText(raw); // Store the original text
                      setShowDonationModal(true);
                      // Don't generate fallback slides yet - wait for user to click "Continue with Original Text"
                    } else {
                      const out = data?.content?.trim();
                      if (out) setRaw(out);
                    }
                  } catch (err) {
                    console.error("AI generation failed:", err);
                    // AI generation failed - keep original text
                  } finally {
                    setGenerating(false);
                  }
                }} 
                className="px-6 py-3 rounded-xl text-white hover:opacity-90 flex items-center gap-2 font-medium tracking-wide relative overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{ 
                  background: [
                    "linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)",
                    "linear-gradient(135deg, #8b5cf6, #06b6d4, #6366f1)",
                    "linear-gradient(135deg, #06b6d4, #6366f1, #8b5cf6)",
                    "linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)"
                  ]
                }}
                transition={{ 
                  background: { duration: 3, repeat: Infinity, ease: "linear" }
                }}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    GENERATING...
                  </>
                ) : (
                  <>
                    GENERATE
                  </>
                )}
              </motion.button>
            </div>
            <div className="text-xs opacity-60">
              Tip: Use blank lines to force a new slide. Use bullets (- or •) for nicer PPTX exports.
            </div>
          </div>

          <div className={`rounded-2xl border ${borderClass} ${cardClass} p-4 flex items-center justify-center`}>
            <div ref={previewRef} className="relative">
              <AnimatePresence mode="popLayout">
                <motion.div key={idx} initial={animCfg.initial} animate={animCfg.animate} exit={animCfg.exit} transition={{ duration: 0.45, ease: "easeOut" }}>
                  <SlideVisual title={current.title} body={current.body} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Settings panel removed in favor of dropdown */}
        </div>

        {total > 1 && (
          <div className="mt-16">
            <button 
              onClick={() => setSlidesExpanded(!slidesExpanded)}
              className="flex items-center gap-2 text-sm mb-3 opacity-70 hover:opacity-100 transition-opacity"
            >
              <span>Slides ({total})</span>
              <motion.span
                animate={{ rotate: slidesExpanded ? 90 : 0 }}
                transition={{ duration: 0.2 }}
              >
                ▶
              </motion.span>
            </button>
            <AnimatePresence>
              {slidesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {slides.map((s, i) => (
                      <button key={i} onClick={() => setIdx(i)}
                              className={`text-left p-3 rounded-xl border ${borderClass} ${i === idx ? `ring-2 ${accent === 'indigo' ? 'ring-indigo-500' : accent === 'emerald' ? 'ring-emerald-500' : 'ring-rose-500'}` : ''} ${cardClass} hover:opacity-90`}>
                        <div className="text-xs font-semibold line-clamp-2">{s.title || `Slide ${i + 1}`}</div>
                        {s.body && <div className="text-[11px] opacity-60 line-clamp-3 mt-1 whitespace-pre-wrap">{s.body}</div>}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>

      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <div ref={settingsRef} className="relative">
          <button onClick={() => setSettingsOpen((v)=>!v)} className={`px-3 py-2 rounded-lg border ${borderClass} ${cardClass} hover:opacity-90`} aria-label="Settings">Settings</button>
          {settingsOpen && (
            <div className={`absolute right-0 mt-2 w-80 max-h-[80vh] overflow-y-auto rounded-2xl border ${borderClass} ${cardClass} p-4 shadow-xl`}
                 role="dialog" aria-label="Settings">
              <div className="text-sm font-semibold opacity-80 mb-2">Settings</div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs opacity-70 mb-1">Theme</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setTheme("dark")} 
                      className={`px-2 py-1 rounded border text-xs ${theme === "dark" ? "bg-indigo-600 text-white" : ""}`}
                    >
                      Dark
                    </button>
                    <button 
                      onClick={() => setTheme("light")} 
                      className={`px-2 py-1 rounded border text-xs ${theme === "light" ? "bg-indigo-600 text-white" : ""}`}
                    >
                      Light
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Accent</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setAccent("indigo")} 
                      className={`px-2 py-1 rounded border text-xs ${accent === "indigo" ? "bg-indigo-600 text-white" : ""}`}
                    >
                      Indigo
                    </button>
                    <button 
                      onClick={() => setAccent("emerald")} 
                      className={`px-2 py-1 rounded border text-xs ${accent === "emerald" ? "bg-emerald-600 text-white" : ""}`}
                    >
                      Emerald
                    </button>
                    <button 
                      onClick={() => setAccent("rose")} 
                      className={`px-2 py-1 rounded border text-xs ${accent === "rose" ? "bg-rose-600 text-white" : ""}`}
                    >
                      Rose
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Animation</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(animations).map((k) => (
                      <button 
                        key={k}
                        onClick={() => setAnim(k)} 
                        className={`px-2 py-1 rounded border text-xs ${anim === k ? "bg-indigo-600 text-white" : ""}`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs opacity-70 mb-1">Ratio</div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setAspect("16:9")} 
                        className={`px-2 py-1 rounded border text-xs ${aspect === "16:9" ? "bg-indigo-600 text-white" : ""}`}
                      >
                        16:9
                      </button>
                      <button 
                        onClick={() => setAspect("4:3")} 
                        className={`px-2 py-1 rounded border text-xs ${aspect === "4:3" ? "bg-indigo-600 text-white" : ""}`}
                      >
                        4:3
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">sec/slide</span>
                    <input type="number" min={1} max={20} className="w-full px-2 py-1 rounded border bg-transparent outline-none text-sm" value={duration} onChange={(e) => setDuration(Number(e.target.value || 3))} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">chunk</span>
                    <input type="number" min={120} max={600} className="w-full px-2 py-1 rounded border bg-transparent outline-none text-sm" value={maxChars} onChange={(e) => setMaxChars(Number(e.target.value || 280))} />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Keyboard help</span>
                    <button onClick={() => { setHelpOpen(true); setSettingsOpen(false); }} className="w-full px-2 py-1 rounded border text-sm">Open</button>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Title scale</span>
                    <input type="number" step={0.1} min={0.6} max={2} className="w-full px-2 py-1 rounded border bg-transparent outline-none text-sm" value={titleSize} onChange={(e) => setTitleSize(Number(e.target.value || 1))} />
                  </label>
                  <label className="flex flex-col">
                    <span className="text-xs opacity-70 mb-1">Body scale</span>
                    <input type="number" step={0.1} min={0.6} max={2} className="w-full px-2 py-1 rounded border bg-transparent outline-none text-sm" value={bodySize} onChange={(e) => setBodySize(Number(e.target.value || 1))} />
                  </label>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs opacity-70 mb-1">Export Settings</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col">
                      <span className="text-xs opacity-70 mb-1">PNG scale</span>
                      <input type="number" min={1} max={4} className="w-full px-2 py-1 rounded border bg-transparent outline-none text-sm" value={exportScale} onChange={(e) => setExportScale(Number(e.target.value || 2))} />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs opacity-70 mb-1">Padding</span>
                      <input type="number" min={0} max={80} className="w-full px-2 py-1 rounded border bg-transparent outline-none text-sm" value={exportPadding} onChange={(e) => setExportPadding(Number(e.target.value || 40))} />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={exportPNGs} className="px-2 py-1 rounded border text-xs">Export PNGs</button>
                    <button onClick={exportPPTX} className="px-2 py-1 rounded border text-xs">Export PPTX</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <button onClick={() => setPresent(true)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white shadow-lg hover:opacity-90" aria-label="Present">▶</button>
      </div>

      {present && (
        <div ref={presentRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label="Presentation" >
          <div style={{ width: size.w, height: size.h, transform: `scale(${presentScale})` }}
            onTouchStart={(e) => (presentRef.current._ts = e.changedTouches[0].clientX)}
            onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (presentRef.current._ts || 0); if (dx < -40) setIdx((i)=> Math.min(i+1,total-1)); if (dx > 40) setIdx((i)=> Math.max(i-1,0)); }}>
            <AnimatePresence mode="popLayout">
              <motion.div key={idx} initial={animCfg.initial} animate={animCfg.animate} exit={animCfg.exit} transition={{ duration: 0.45, ease: "easeOut" }}>
                <SlideVisual title={current.title} body={current.body} full />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="absolute top-4 left-4 flex items-center gap-2 text-xs text-white/80">
            <button onClick={() => setAutoPlay((v)=>!v)} className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20" aria-label="Toggle autoplay">{autoPlay ? 'Pause' : 'Play'}</button>
            <span>{idx + 1} / {total}</span>
          </div>
          <button ref={exitBtnRef} onClick={() => { setPresent(false); setAutoPlay(false); }} className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20" aria-label="Exit presentation">Exit</button>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Keyboard help">
          <div className={`rounded-2xl border ${borderClass} ${cardClass} p-5 w-[28rem] max-w-[90vw]`}>
            <div className="text-lg font-semibold mb-3">Keyboard & controls</div>
            <ul className="text-sm space-y-1">
              <li><strong>← / →</strong> — previous/next slide</li>
              <li><strong>P</strong> — enter/exit presentation</li>
              <li><strong>F</strong> — toggle autoplay (presentation only)</li>
              <li><strong>?</strong> — open this help</li>
              <li><strong>Esc</strong> — close modals / exit presentation</li>
            </ul>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setHelpOpen(false)} className="px-3 py-2 rounded-lg border">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Donation Modal */}
      {showDonationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDonationModal(false)} />
          <div className={`relative max-w-md w-full rounded-2xl border ${borderClass} ${cardClass} p-6 shadow-2xl`}>
            <div className="text-center">
              <div className="text-4xl mb-4">⏰</div>
              <h2 className="text-xl font-semibold mb-2">You Hit Your Daily Limit</h2>
              <p className="text-sm opacity-80 mb-6">
                To maintain the service we are limiting the usage. You can come back tomorrow.
              </p>
              
              <div className="space-y-3">
                <a 
                  href="https://github.com/sponsors/fityanos" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  💖 $5 GitHub Sponsoring
                </a>
              </div>
              
              <p className="text-xs opacity-60 mt-4">
                Your support helps keep this service free for everyone!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowValidationModal(false)} />
          <div className={`relative max-w-md w-full rounded-2xl border ${borderClass} ${cardClass} p-6 shadow-2xl`}>
            <div className="text-center">
              <div className="text-4xl mb-4">🤔</div>
              <h2 className="text-xl font-semibold mb-2">Need More Context!</h2>
              <p className="text-sm opacity-80 mb-6">
                I can't read your thoughts! Give me more context please.
                <br />
                <span className="text-xs opacity-60">Try adding at least 30 words to get better results.</span>
              </p>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setShowValidationModal(false)}
                  className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Got it, I'll add more text
                </button>
                
                <button 
                  onClick={() => {
                    setShowValidationModal(false);
                    // Focus on the textarea
                    setTimeout(() => {
                      const textarea = document.querySelector('textarea');
                      if (textarea) textarea.focus();
                    }, 100);
                  }}
                  className="block w-full border border-gray-300 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Focus on text area
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}