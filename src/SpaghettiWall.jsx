import { useState, useEffect, useRef } from "react";

// ─── Storage ─────────────────────────────────────────────────────────
const STORAGE_KEY = "kairo-sw-v1";
const THEME_KEY = "kairo-theme";

async function loadData() {
  try {
    const res = await fetch("/api/ideas");
    if (res.ok) {
      const ideas = await res.json();
      return { ideas, themeMode: localStorage.getItem(THEME_KEY) || "auto" };
    }
  } catch(e) {}
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

async function saveData(d) {
  try {
    localStorage.setItem(THEME_KEY, d.themeMode);
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas: d.ideas }),
    });
    if (!res.ok) throw new Error();
  } catch(e) {
    // Fallback to localStorage
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch(_) {}
  }
}

// ─── AI ──────────────────────────────────────────────────────────────
async function analyseIdea(text, existing) {
  const allTags = [...new Set(existing.flatMap(i => i.tags || []))];
  const context = existing.slice(-15).map((i, idx) => `[${idx}] "${i.title}" [${(i.tags||[]).join(",")}]`).join("\n");

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, allTags, context }),
    });
    const d = await res.json();
    return JSON.parse((d.content?.[0]?.text || "{}").replace(/```json|```/g, "").trim());
  } catch(e) {
    return { title: text.split(/\s+/).slice(0, 5).join(" "), tags: [], insight: "", connections: [] };
  }
}

// ─── Tag colours ─────────────────────────────────────────────────────
const TAG_PALETTE = ["#007AFF","#34C759","#FF9500","#AF52DE","#FF3B30","#5AC8FA","#FF2D55","#FFCC00","#30B0C7","#A2845E"];
function tagColor(tag) {
  let h = 0; for (let i = 0; i < tag.length; i++) h = tag.charCodeAt(i) + ((h << 5) - h);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

// ─── Spaghetti wallpaper ──────────────────────────────────────────────
const spaghettiWallpaper = `url("/spag.jpg")`;

// ─── App ─────────────────────────────────────────────────────────────
export default function SpaghettiWall() {
  const [ideas, setIdeas] = useState([]);
  const [themeMode, setThemeMode] = useState("auto"); // light|dark|auto|spaghetti
  const [input, setInput] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [kbOffset, setKbOffset] = useState(0);
  const [analysing, setAnalysing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterTags, setFilterTags] = useState([]);
  const [noteInput, setNoteInput] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [captureImage, setCaptureImage] = useState(null);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [systemDark, setSystemDark] = useState(window.matchMedia("(prefers-color-scheme: dark)").matches);

  const fileRef = useRef(null);
  const detailFileRef = useRef(null);
  const recogRef = useRef(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const selRef = useRef(null);
  const ideasRef = useRef([]);
  const touchStartY = useRef(null);

  useEffect(() => { selRef.current = selected; }, [selected]);
  useEffect(() => { ideasRef.current = ideas; }, [ideas]);

  // System theme listener
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Visual viewport — push capture sheet above keyboard on iOS
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => { vv.removeEventListener("resize", handler); vv.removeEventListener("scroll", handler); };
  }, []);

  // Load
  useEffect(() => {
    (async () => {
      const d = await loadData();
      if (d) { setIdeas(d.ideas || []); setThemeMode(d.themeMode || "auto"); }
    })();
  }, []);

  // Save (debounced — waits 800ms after last change before syncing)
  useEffect(() => {
    const t = setTimeout(() => saveData({ ideas, themeMode }), 800);
    return () => clearTimeout(t);
  }, [ideas, themeMode]);

  // Speech recognition
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = "en-GB";
      r.onresult = (e) => { let t = ""; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); };
      r.onerror = () => setListening(false);
      r.onend = () => setListening(false);
      recogRef.current = r;
    }
  }, []);

  // ─── Theme resolution ──────────────────────────────────────────────
  const isDark = themeMode === "dark" || (themeMode === "auto" && systemDark) || themeMode === "spaghetti";
  const isSpaghetti = themeMode === "spaghetti";

  const t = {
    bg: isSpaghetti ? "#B52A1C" : isDark ? "#000000" : "#F2F2F7",
    bgSecondary: isDark ? "#1C1C1E" : "#FFFFFF",
    bgTertiary: isDark ? "#2C2C2E" : "#F2F2F7",
    bgElevated: isDark ? "#1C1C1E" : "#FFFFFF",
    text: isDark ? "#FFFFFF" : "#000000",
    textSecondary: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
    textTertiary: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
    separator: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    accent: "#007AFF",
    destructive: "#FF3B30",
    cardShadow: isDark ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 3px rgba(0,0,0,0.08)",
    cardShadowHover: isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.12)",
    inputBg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    backdrop: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)",
  };

  // ─── Helpers ───────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (!recogRef.current) return;
    if (listening) { recogRef.current.stop(); setListening(false); }
    else { setInput(""); recogRef.current.start(); setListening(true); }
  };

  const readFile = (f) => new Promise(r => { const fr = new FileReader(); fr.onload = e => r(e.target.result); fr.readAsDataURL(f); });

  const updateIdea = (id, patch) => {
    setIdeas(p => p.map(i => i.id === id ? { ...i, ...patch } : i));
    setSelected(p => p && p.id === id ? { ...p, ...patch } : p);
  };

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  // ─── Actions ───────────────────────────────────────────────────────
  const submitIdea = async () => {
    const text = input.trim();
    if (!text && !captureImage) return;
    setAnalysing(true);
    const analysis = text ? await analyseIdea(text, ideas) : { title: "Image capture", tags: ["visual"], insight: "", connections: [] };
    const idea = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text, title: analysis.title || text.split(/\s+/).slice(0, 5).join(" "),
      tags: analysis.tags || [], insight: analysis.insight || "",
      connections: (analysis.connections || []).map(Number).filter(n => !isNaN(n)),
      notes: [],
      attachments: captureImage ? [{ type: "image", data: captureImage, at: new Date().toISOString() }] : [],
      createdAt: new Date().toISOString(),
      priority: "none",
    };
    setIdeas(p => [idea, ...p]);
    setInput(""); setCaptureImage(null); setAnalysing(false); setCapturing(false);
    if (listening) { recogRef.current?.stop(); setListening(false); }
  };

  const addNote = (id) => {
    if (!noteInput.trim()) return;
    const idea = ideas.find(i => i.id === id); if (!idea) return;
    updateIdea(id, { notes: [...(idea.notes || []), { text: noteInput.trim(), at: new Date().toISOString() }] });
    setNoteInput("");
  };

  const deleteNote = (id, idx) => {
    const idea = ideas.find(i => i.id === id); if (!idea) return;
    updateIdea(id, { notes: idea.notes.filter((_, i) => i !== idx) });
  };

  const addAttachment = async (id, file) => {
    const data = await readFile(file);
    const idea = ideas.find(i => i.id === id); if (!idea) return;
    updateIdea(id, { attachments: [...(idea.attachments || []), { type: file.type.startsWith("audio") ? "voice" : "image", data, at: new Date().toISOString() }] });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (!chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const data = await readFile(blob);
        const sel = selRef.current;
        if (sel) {
          const idea = ideasRef.current.find(i => i.id === sel.id);
          if (idea) updateIdea(sel.id, { attachments: [...(idea.attachments || []), { type: "voice", data, at: new Date().toISOString() }] });
        }
      };
      mr.start(); mediaRef.current = mr; setRecording(true);
    } catch(e) { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRef.current?.state !== "inactive") mediaRef.current?.stop();
    setRecording(false);
  };

  const saveTitle = () => {
    if (!titleDraft.trim() || !selected) return;
    updateIdea(selected.id, { title: titleDraft.trim() });
    setEditingTitle(false);
  };

  const addTag = (id, tag) => {
    const tt = tag.toLowerCase().trim().replace(/\s+/g, "-"); if (!tt) return;
    const idea = ideas.find(i => i.id === id); if (!idea || idea.tags.includes(tt)) return;
    updateIdea(id, { tags: [...idea.tags, tt] });
  };
  const removeTag = (id, tag) => {
    const idea = ideas.find(i => i.id === id); if (!idea) return;
    updateIdea(id, { tags: idea.tags.filter(t => t !== tag) });
  };

  // ─── Pointer-based drag reorder ─────────────────────────────────────
  const [reorderingId, setReorderingId] = useState(null);
  const [reorderY, setReorderY] = useState(0);
  const [reorderTargetIdx, setReorderTargetIdx] = useState(null);
  const reorderStartY = useRef(0);
  const reorderStartIdx = useRef(0);
  const rowHeight = 72;

  const onReorderStart = (id, filteredIdx, clientY) => {
    setReorderingId(id);
    reorderStartY.current = clientY;
    reorderStartIdx.current = filteredIdx;
    setReorderY(0);
    setReorderTargetIdx(filteredIdx);
  };

  const onReorderMove = (clientY) => {
    if (reorderingId === null) return;
    const dy = clientY - reorderStartY.current;
    setReorderY(dy);
    setReorderTargetIdx(idx => {
      const next = Math.max(0, Math.min(filtered.length - 1, reorderStartIdx.current + Math.round(dy / rowHeight)));
      return next;
    });
  };

  const onReorderEnd = () => {
    if (reorderingId === null) return;
    const startFIdx = reorderStartIdx.current;
    const endFIdx = reorderTargetIdx ?? startFIdx;
    if (endFIdx !== startFIdx) {
      setIdeas(prev => {
        const fromIdx = prev.findIndex(i => i.id === reorderingId);
        if (fromIdx === -1) return prev;
        const offset = endFIdx - startFIdx;
        const toIdx = Math.max(0, Math.min(prev.length - 1, fromIdx + offset));
        if (fromIdx === toIdx) return prev;
        const next = [...prev];
        const [item] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, item);
        return next;
      });
    }
    setReorderingId(null);
    setReorderY(0);
    setReorderTargetIdx(null);
  };

  // Priority helpers
  const PRIORITIES = [
    { key: "none", label: "—", color: "transparent" },
    { key: "low", label: "Low", color: "#34C759" },
    { key: "medium", label: "Med", color: "#FF9500" },
    { key: "high", label: "High", color: "#FF3B30" },
  ];

  const cyclePriority = (id) => {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    const keys = PRIORITIES.map(p => p.key);
    const next = keys[(keys.indexOf(idea.priority || "none") + 1) % keys.length];
    updateIdea(id, { priority: next });
  };

  const getPriority = (key) => PRIORITIES.find(p => p.key === key) || PRIORITIES[0];

  // ─── Filter ────────────────────────────────────────────────────────
  const allTags = [...new Set(ideas.flatMap(i => i.tags || []))];
  const filtered = ideas.filter(i => {
    if (filterTags.length && !filterTags.some(ft => (i.tags || []).includes(ft))) return false;
    if (searchQ) { const q = searchQ.toLowerCase(); return i.title.toLowerCase().includes(q) || i.text.toLowerCase().includes(q) || (i.tags||[]).some(tt => tt.includes(q)); }
    return true;
  });

  // ─── Render ────────────────────────────────────────────────────────
  const IdeaRow = ({ idea, idx, filteredIdx }) => {
    const isReordering = reorderingId === idea.id;
    const pri = getPriority(idea.priority);

    // Spring shift: slide other items out of the way while dragging
    let shift = 0;
    if (reorderingId && !isReordering && reorderTargetIdx !== null) {
      const s = reorderStartIdx.current;
      const t2 = reorderTargetIdx;
      if (s < t2 && filteredIdx > s && filteredIdx <= t2) shift = -rowHeight;
      else if (s > t2 && filteredIdx >= t2 && filteredIdx < s) shift = rowHeight;
    }

    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          borderBottom: isSpaghetti ? "none" : `0.5px solid ${t.separator}`,
          transition: isReordering ? "none" : "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease",
          transform: isReordering ? `translateY(${reorderY}px)` : shift ? `translateY(${shift}px)` : "none",
          zIndex: isReordering ? 100 : 1,
          position: "relative",
          marginBottom: isSpaghetti ? 6 : 0,
          background: isSpaghetti
            ? "rgba(20,20,20,0.62)"
            : isReordering ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)") : "transparent",
          borderRadius: isSpaghetti ? 12 : isReordering ? 12 : 0,
          border: isSpaghetti ? "1px solid rgba(255,255,255,0.13)" : "none",
          boxShadow: isSpaghetti ? "0 2px 12px rgba(0,0,0,0.35)" : isReordering ? "0 8px 24px rgba(0,0,0,0.15)" : "none",
          backdropFilter: isSpaghetti ? "blur(6px)" : "none",
          WebkitBackdropFilter: isSpaghetti ? "blur(6px)" : "none",
          userSelect: "none",
        }}
      >
        {/* Priority indicator — tap to cycle */}
        <button onClick={e => { e.stopPropagation(); cyclePriority(idea.id); }}
          title={`Priority: ${pri.label}`}
          style={{
            width: 6, minHeight: 40, borderRadius: 3, flexShrink: 0,
            background: pri.color === "transparent" ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") : pri.color,
            border: "none", cursor: "pointer", padding: 0,
            transition: "background 0.2s ease",
          }} />

        {/* Content — tap to open */}
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          onClick={() => { setSelected(idea); setNoteInput(""); setEditingTitle(false); }}>
          <div style={{
            fontSize: 16, fontWeight: 500, color: t.text, lineHeight: 1.3,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{idea.title}</div>
          {idea.text && (
            <div style={{
              fontSize: 13, color: t.textSecondary, lineHeight: 1.4, marginTop: 2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{idea.text.length > 80 ? idea.text.slice(0, 80) + "…" : idea.text}</div>
          )}
          {(idea.tags || []).length > 0 && (
            <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
              {idea.tags.slice(0, 3).map(tg => (
                <span key={tg} style={{
                  fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                  background: `${tagColor(tg)}18`, color: tagColor(tg),
                }}>{tg}</span>
              ))}
              {idea.tags.length > 3 && <span style={{ fontSize: 11, color: t.textTertiary }}>+{idea.tags.length - 3}</span>}
            </div>
          )}
        </div>

        {/* Meta */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: t.textTertiary }}>{timeAgo(idea.createdAt)}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {(idea.notes || []).length > 0 && <span style={{ fontSize: 11, color: t.textTertiary }}>💬{idea.notes.length}</span>}
            {(idea.attachments || []).length > 0 && <span style={{ fontSize: 11, color: t.textTertiary }}>📎{idea.attachments.length}</span>}
          </div>
        </div>

        {/* Drag handle */}
        <div
          onPointerDown={e => { e.preventDefault(); onReorderStart(idea.id, filteredIdx, e.clientY); }}
          onTouchStart={e => onReorderStart(idea.id, filteredIdx, e.touches[0].clientY)}
          style={{
            color: t.textTertiary, fontSize: 18, cursor: "grab",
            padding: "8px 2px", userSelect: "none", touchAction: "none",
            display: "flex", alignItems: "center",
          }}>≡</div>
      </div>
    );
  };

  return (
    <div
      className={isSpaghetti ? "spaghetti-bg" : undefined}
      onPointerMove={e => onReorderMove(e.clientY)}
      onPointerUp={onReorderEnd}
      onPointerCancel={onReorderEnd}
      onTouchMove={e => { if (reorderingId) { e.preventDefault(); onReorderMove(e.touches[0].clientY); } }}
      onTouchEnd={onReorderEnd}
      onTouchCancel={onReorderEnd}
      style={{
        fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
        background: isSpaghetti ? undefined : t.bg,
        backgroundImage: isSpaghetti ? spaghettiWallpaper : undefined,
        backgroundSize: isSpaghetti ? "cover" : undefined,
        backgroundPosition: isSpaghetti ? "center" : undefined,
        backgroundAttachment: isSpaghetti ? "fixed" : undefined,
        color: t.text, minHeight: "100vh",
        WebkitFontSmoothing: "antialiased",
        touchAction: reorderingId ? "none" : undefined,
      }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes recording-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.4); } 50% { box-shadow: 0 0 0 6px rgba(255,59,48,0); } }
        @media (max-width: 768px) { .spaghetti-bg { background-size: 300% !important; background-position: center 40% !important; background-attachment: scroll !important; } }
        .idea-row:hover { background: ${isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"} !important; }
        .idea-row:active { background: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"} !important; }
        .btn-secondary { transition: all 0.15s ease; }
        .btn-secondary:hover { opacity: 0.8; }
        .btn-secondary:active { transform: scale(0.97); }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        .modal-content { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .recording-indicator { animation: recording-pulse 1.5s ease infinite; }
      `}</style>

      {/* ─── Header ─── */}
      <header style={{
        padding: "52px 20px 12px",
        background: isSpaghetti ? "rgba(0,0,0,0.65)" : isDark ? "rgba(0,0,0,0.85)" : "rgba(242,242,247,0.85)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `0.5px solid ${t.separator}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.5px", color: t.text }}>Spaghetti Wall</h1>
          {/* Theme toggle */}
          <div style={{ display: "flex", gap: 2, background: t.inputBg, borderRadius: 8, padding: 2 }}>
            {[
              { key: "light", label: "☀️" },
              { key: "dark", label: "🌙" },
              { key: "auto", label: "A" },
              { key: "spaghetti", label: "🍝" },
            ].map(opt => (
              <button key={opt.key} onClick={() => setThemeMode(opt.key)} style={{
                width: 32, height: 28, borderRadius: 6, border: "none",
                background: themeMode === opt.key ? t.bgElevated : "transparent",
                color: themeMode === opt.key ? t.text : t.textSecondary,
                fontSize: opt.key === "auto" ? 12 : 14, fontWeight: 600, cursor: "pointer",
                boxShadow: themeMode === opt.key ? t.cardShadow : "none",
                transition: "all 0.2s ease",
              }}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: allTags.length > 0 ? 8 : 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: t.textTertiary }}>🔍</span>
          <input
            type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search"
            style={{
              width: "100%", padding: "8px 12px 8px 32px", borderRadius: 10, border: "none",
              background: t.inputBg, color: t.text, fontSize: 16, outline: "none",
            }}
          />
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
            {allTags.slice(0, 10).map(tg => (
              <button key={tg} onClick={() => setFilterTags(p => p.includes(tg) ? p.filter(x => x !== tg) : [...p, tg])} style={{
                padding: "4px 10px", borderRadius: 14, border: "none", whiteSpace: "nowrap",
                background: filterTags.includes(tg) ? t.accent : t.inputBg,
                color: filterTags.includes(tg) ? "#fff" : t.textSecondary,
                fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s ease",
              }}>{tg}</button>
            ))}
            {filterTags.length > 0 && (
              <button onClick={() => setFilterTags([])} style={{
                padding: "4px 8px", borderRadius: 14, border: "none",
                background: "transparent", color: t.destructive, fontSize: 12, cursor: "pointer",
              }}>Clear</button>
            )}
          </div>
        )}
      </header>

      {/* ─── Idea List ─── */}
      <main style={{
        maxWidth: 680,
        background: isSpaghetti ? "rgba(0,0,0,0.10)" : t.bgSecondary,
        borderRadius: isSpaghetti ? 16 : 0,
        margin: isSpaghetti ? "12px auto" : "0 auto",
        overflow: "hidden",
        minHeight: "calc(100vh - 160px)",
        padding: isSpaghetti ? "6px 8px" : 0,
      }}>
        {filtered.length === 0 && (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💭</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: t.text, marginBottom: 4 }}>No ideas yet</div>
            <div style={{ fontSize: 15, color: t.textSecondary }}>Tap + to throw something at the wall</div>
          </div>
        )}

        {/* Active ideas */}
        {filtered.map((idea, filteredIdx) => (
          <div key={idea.id} className="idea-row">
            <IdeaRow idea={idea} idx={ideas.indexOf(idea)} filteredIdx={filteredIdx} />
          </div>
        ))}

        {/* Bottom spacer for FAB */}
        <div style={{ height: 80 }} />
      </main>

      {/* ─── FAB ─── */}
      {!capturing && !selected && (
        <button onClick={() => setCapturing(true)} style={{
          position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: "50%",
          border: "none", background: t.accent, color: "#fff", fontSize: 28, fontWeight: 300,
          cursor: "pointer", boxShadow: "0 4px 16px rgba(0,122,255,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 40,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}>+</button>
      )}

      {/* ─── Capture Sheet ─── */}
      {capturing && (
        <div className="modal-overlay" onClick={() => { if (!analysing) setCapturing(false); }}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: kbOffset, background: t.backdrop, backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 680,
            background: t.bgElevated, borderRadius: "16px 16px 0 0",
            padding: "8px 0 0", boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
            maxHeight: "85vh", overflow: "auto",
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 5, borderRadius: 3, background: t.textTertiary, margin: "0 auto 12px" }} />

            <div style={{ padding: "0 20px 20px" }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: t.text }}>New Idea</h2>

              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder="What's on your mind? Type a quick thought or a long ramble..."
                disabled={analysing}
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) submitIdea(); }}
                style={{
                  width: "100%", minHeight: 100, padding: 14, borderRadius: 12, border: "none",
                  background: t.inputBg, color: t.text, fontSize: 16,
                  fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", outline: "none",
                }} />

              {captureImage && (
                <div style={{ position: "relative", display: "inline-block", marginTop: 8 }}>
                  <img src={captureImage} alt="" style={{ maxHeight: 80, borderRadius: 10 }} />
                  <button onClick={() => setCaptureImage(null)} style={{
                    position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%",
                    border: "none", background: t.destructive, color: "#fff", fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={toggleVoice} className="btn-secondary" style={{
                    width: 40, height: 40, borderRadius: 10, border: "none",
                    background: listening ? "rgba(255,59,48,0.12)" : t.inputBg,
                    color: listening ? t.destructive : t.textSecondary, fontSize: 18, cursor: "pointer",
                  }}>🎙</button>
                  <button onClick={() => fileRef.current?.click()} className="btn-secondary" style={{
                    width: 40, height: 40, borderRadius: 10, border: "none",
                    background: t.inputBg, color: t.textSecondary, fontSize: 18, cursor: "pointer",
                  }}>📷</button>
                  <input ref={fileRef} type="file" accept="image/*" onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setCaptureImage(await readFile(f));
                  }} style={{ display: "none" }} />
                </div>
                {listening && <span style={{ fontSize: 13, color: t.destructive, animation: "pulse 1.5s ease infinite" }}>Listening...</span>}
                <button onClick={submitIdea} disabled={analysing || (!input.trim() && !captureImage)} style={{
                  padding: "10px 24px", borderRadius: 12, border: "none",
                  background: t.accent, color: "#fff", fontSize: 16, fontWeight: 600, cursor: "pointer",
                  opacity: analysing || (!input.trim() && !captureImage) ? 0.4 : 1,
                  transition: "opacity 0.15s ease",
                }}>
                  {analysing ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detail Sheet ─── */}
      {selected && (() => (
        <div className="modal-overlay" onClick={() => setSelected(null)}
          style={{ position: "fixed", inset: 0, background: t.backdrop, backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            width: "100%", maxWidth: 680,
            background: t.bgElevated, borderRadius: "16px 16px 0 0",
            padding: "8px 0 0", boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
            maxHeight: "90vh", overflow: "auto",
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 5, borderRadius: 3, background: t.textTertiary, margin: "0 auto 8px" }} />

            <div style={{ padding: "0 20px 24px" }}>
              {/* Title */}
              {editingTitle ? (
                <div style={{ marginBottom: 12 }}>
                  <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                    autoFocus
                    style={{
                      width: "100%", fontSize: 22, fontWeight: 600, color: t.text, padding: "4px 0",
                      background: "transparent", border: "none", borderBottom: `2px solid ${t.accent}`, outline: "none",
                      fontFamily: "inherit",
                    }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={saveTitle} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: t.accent, color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingTitle(false)} style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: t.inputBg, color: t.textSecondary, fontSize: 14, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <h2 onClick={() => { setEditingTitle(true); setTitleDraft(selected.title); }}
                  style={{ fontSize: 22, fontWeight: 600, color: t.text, marginBottom: 4, cursor: "pointer", lineHeight: 1.3 }}>
                  {selected.title}
                </h2>
              )}
              <div style={{ fontSize: 13, color: t.textTertiary, marginBottom: 16 }}>{timeAgo(selected.createdAt)}</div>

              {/* Original text */}
              {selected.text && (
                <div style={{
                  padding: 14, borderRadius: 12, background: t.inputBg,
                  fontSize: 15, color: t.textSecondary, lineHeight: 1.6, marginBottom: 16,
                }}>{selected.text}</div>
              )}

              {/* Priority */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Priority</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {PRIORITIES.map(p => {
                    const isActive = (selected.priority || "none") === p.key;
                    return (
                      <button key={p.key} onClick={() => updateIdea(selected.id, { priority: p.key })} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none",
                        background: isActive ? (p.color === "transparent" ? t.inputBg : p.color) : t.inputBg,
                        color: isActive && p.color !== "transparent" ? "#fff" : (isActive ? t.text : t.textSecondary),
                        fontSize: 13, fontWeight: isActive ? 600 : 400, cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}>{p.label}</button>
                    );
                  })}
                </div>
              </div>

              {/* AI Insight */}
              {selected.insight && (
                <div style={{
                  padding: 14, borderRadius: 12, marginBottom: 16,
                  background: isDark ? "rgba(0,122,255,0.08)" : "rgba(0,122,255,0.06)",
                  borderLeft: `3px solid ${t.accent}`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>AI Insight</div>
                  <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5 }}>{selected.insight}</div>
                </div>
              )}

              {/* Tags */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tags</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                  {(selected.tags || []).map(tg => (
                    <span key={tg} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 13, fontWeight: 500, padding: "3px 10px", borderRadius: 6,
                      background: `${tagColor(tg)}18`, color: tagColor(tg),
                    }}>
                      {tg}
                      <span onClick={e => { e.stopPropagation(); removeTag(selected.id, tg); }}
                        style={{ cursor: "pointer", opacity: 0.5, fontSize: 11 }}>✕</span>
                    </span>
                  ))}
                  <input placeholder="Add tag" onKeyDown={e => {
                    if (e.key === "Enter" && e.target.value.trim()) { addTag(selected.id, e.target.value); e.target.value = ""; }
                  }} style={{
                    padding: "3px 8px", borderRadius: 6, border: `1px dashed ${t.separator}`,
                    background: "transparent", color: t.text, fontSize: 13, width: 70, outline: "none",
                    fontFamily: "inherit",
                  }} />
                </div>
              </div>

              {/* Connections */}
              {(selected.connections || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Connected Ideas</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selected.connections.map(idx => {
                      const c = ideas[idx]; if (!c) return null;
                      return <button key={idx} onClick={() => { setSelected(c); setNoteInput(""); setEditingTitle(false); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: t.inputBg, color: t.accent, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{c.title}</button>;
                    })}
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Attachments{(selected.attachments || []).length > 0 ? ` · ${selected.attachments.length}` : ""}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => detailFileRef.current?.click()} className="btn-secondary" style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", background: t.inputBg,
                      color: t.textSecondary, fontSize: 13, cursor: "pointer",
                    }}>Add File</button>
                    <button onClick={recording ? stopRecording : startRecording}
                      className={recording ? "recording-indicator" : "btn-secondary"}
                      style={{
                        padding: "4px 10px", borderRadius: 6, border: "none",
                        background: recording ? "rgba(255,59,48,0.1)" : t.inputBg,
                        color: recording ? t.destructive : t.textSecondary,
                        fontSize: 13, cursor: "pointer",
                      }}>{recording ? "Stop ⏹" : "Voice Note"}</button>
                    <input ref={detailFileRef} type="file" accept="image/*,audio/*" onChange={async e => {
                      const f = e.target.files?.[0]; if (!f || !selected) return;
                      await addAttachment(selected.id, f);
                    }} style={{ display: "none" }} />
                  </div>
                </div>
                {(selected.attachments || []).map((att, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {att.type === "image" && <img src={att.data} alt="" style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 10 }} />}
                    {att.type === "voice" && <audio controls src={att.data} style={{ width: "100%", height: 36 }} />}
                    <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{timeAgo(att.at)}</div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.textTertiary, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Notes{(selected.notes || []).length > 0 ? ` · ${selected.notes.length}` : ""}
                </div>
                {(selected.notes || []).map((n, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    padding: "8px 12px", borderRadius: 8, marginBottom: 4,
                    background: t.inputBg,
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: t.text, lineHeight: 1.5 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 2 }}>{timeAgo(n.at)}</div>
                    </div>
                    <button onClick={() => deleteNote(selected.id, i)} style={{
                      background: "transparent", border: "none", color: t.textTertiary, fontSize: 14,
                      cursor: "pointer", padding: "0 0 0 8px", flexShrink: 0,
                    }}>✕</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                    placeholder="Add a note..."
                    onKeyDown={e => { if (e.key === "Enter") addNote(selected.id); }}
                    style={{
                      flex: 1, padding: "8px 12px", borderRadius: 8, border: "none",
                      background: t.inputBg, color: t.text, fontSize: 14, outline: "none",
                      fontFamily: "inherit",
                    }} />
                  <button onClick={() => addNote(selected.id)} disabled={!noteInput.trim()} style={{
                    padding: "8px 16px", borderRadius: 8, border: "none",
                    background: t.accent, color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
                    opacity: noteInput.trim() ? 1 : 0.35, transition: "opacity 0.15s ease",
                  }}>Add</button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: `0.5px solid ${t.separator}` }}>
                <button onClick={() => { setIdeas(p => p.filter(i => i.id !== selected.id)); setSelected(null); }} style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: "rgba(255,59,48,0.08)", color: t.destructive,
                  fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}>Delete Idea</button>
              </div>
            </div>
          </div>
        </div>
      ))()}
    </div>
  );
}
