import { useEffect, useRef, useState } from "react";

const valid = (value) => value && typeof value.text === "string" && value.text.length <= 4000 && ["voice", "text"].includes(value.mode);
const withoutAlternate = ({ alternate, ...entry }) => entry;

/** Persist at the input boundary, rather than waiting for navigation or React effects. */
export default function useConversationDraft(userId, namespace = "chat") {
  const prefix = `unispeaking.draft.v2.${userId || "local"}.${namespace}.`;
  const persisted = useRef(false), active = useRef(null), owner = useRef(crypto.randomUUID()), current = useRef({ text: "", mode: "voice" });
  const [value, setValue] = useState(current.current), [storageError, setStorageError] = useState(false);
  const keyFor = (key) => `${prefix}${key}`;
  function read(key) {
    try { const value = JSON.parse(localStorage.getItem(keyFor(key))); return valid(value) ? value : null; }
    catch { return null; }
  }
  function publish(next) { current.current = next; setValue(next); return next; }
  function store(next, detectConflict = true) {
    if (!active.current) return publish(next);
    const disk = read(active.current);
    if (detectConflict && disk && disk.revision !== current.current.revision && disk.writer !== owner.current && disk.text !== next.text) next = { ...next, alternate: withoutAlternate(disk) };
    const record = { ...next, version: 2, updatedAt: Date.now(), writer: owner.current, revision: crypto.randomUUID() };
    try { localStorage.setItem(keyFor(active.current), JSON.stringify(record)); persisted.current = true; setStorageError(false); }
    catch { persisted.current = false; setStorageError(true); }
    return publish(record);
  }
  function patch(update, detectConflict = true) { return store({ ...current.current, ...update }, detectConflict); }
  function setText(next) { patch({ text: typeof next === "function" ? next(current.current.text) : next }); }
  function setMode(mode) { patch({ mode }); }
  function activate(key, defaultMode = "voice", options = {}) {
    if (active.current === key) return current.current;
    let recovered = read(key);
    if (!recovered && namespace === "chat") {
      try {
        const legacy = sessionStorage.getItem(`unispeaking.chat-draft.${userId || "local"}.${options.legacyKey || key.replace(/^(thread|new):/, "")}`);
        if (legacy) recovered = { text: legacy.slice(0, 4000), mode: "text" };
      } catch { /* The durable store still works when legacy storage is disabled. */ }
    }
    active.current = key;
    const next = { text: "", mode: defaultMode, creationId: options.creationId || crypto.randomUUID(), ...recovered };
    if (next.text) next.mode = "text";
    publish(next); return store(next);
  }
  function promote(key) {
    if (!active.current || active.current === key) return;
    const old = active.current; active.current = key; store(current.current);
    if (persisted.current) { try { localStorage.removeItem(keyFor(old)); } catch {} }
  }
  function clearSent(text) { if (current.current.text === text) patch({ text: "", request: null, alternate: null }); }
  function remove(key) {
    try { localStorage.removeItem(keyFor(key)); } catch {}
    if (namespace === "chat") { try { sessionStorage.removeItem(`unispeaking.chat-draft.${userId || "local"}.${key.replace(/^(thread|new):/, "")}`); } catch {} }
    if (active.current === key) { active.current = null; publish({ text: "", mode: "voice" }); }
  }
  function recoverAlternate() {
    if (!current.current.alternate) return;
    const previous = withoutAlternate(current.current);
    patch({ ...current.current.alternate, alternate: previous }, false);
  }
  useEffect(() => {
    const receive = (event) => {
      if (!active.current || event.key !== keyFor(active.current) || !event.newValue) return;
      try { const next = JSON.parse(event.newValue); if (valid(next) && next.writer !== owner.current && next.text !== current.current.text) publish({ ...current.current, alternate: withoutAlternate(next) }); } catch {}
    };
    const flush = () => { if (active.current) store(current.current); };
    window.addEventListener("storage", receive); window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => { window.removeEventListener("storage", receive); window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", flush); };
  }, [prefix]);
  return { ...value, setText, setMode, activate, promote, patch, read, clearSent, remove, recoverAlternate,
    keepCurrent: () => patch({ alternate: null }, false), storageError, currentKey: () => active.current,
    snapshot: () => current.current };
}
