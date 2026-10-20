import React, { useEffect, useRef, useState } from "react";
import { CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { agentRequest as api } from "./agentApi.js";

export default function AgentReplyHint({ threadId, contextKey, onUse, disabled }) {
  const [open, setOpen] = useState(false), [hint, setHint] = useState(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const generation = useRef(0), request = useRef(null), trigger = useRef(null), pending = useRef(false);
  useEffect(() => { ++generation.current; request.current?.abort(); pending.current = false; setOpen(false); setHint(null); setError(""); setLoading(false); }, [threadId, contextKey]);
  useEffect(() => () => { ++generation.current; request.current?.abort(); }, []);
  async function load() {
    if (pending.current) return;
    setOpen(true); if (hint) return;
    const sequence = ++generation.current, controller = new AbortController(); request.current = controller;
    pending.current = true; setLoading(true); setError("");
    try { const result = await api(`/threads/${threadId}/hints`, "POST", undefined, controller.signal); if (sequence === generation.current) setHint(result); }
    catch (e) { if (sequence === generation.current && e.name !== "AbortError") setError(e.message || "暂未生成提示，请重试"); }
    finally { if (sequence === generation.current) { pending.current = false; setLoading(false); } }
  }
  return <div className="aw-hint">
    <button ref={trigger} className="aw-link aw-hint-trigger" disabled={disabled || !threadId || loading} onClick={() => open ? setOpen(false) : void load()} aria-expanded={open}>{loading ? <CircleNotch className="aw-spin" /> : <Sparkle />}接话建议</button>
    {open && <section className="aw-hint-card" aria-label="接话提示"><button className="aw-icon-button" aria-label="关闭接话提示" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X /></button>{loading ? <p role="status">生成中…</p> : error ? <p role="alert">{error}<button className="aw-link" onClick={() => void load()}>重试</button></p> : hint && <><strong>{hint.text}</strong><p>{hint.meaning}</p><button className="aw-link" onClick={() => { onUse(hint.text); }}>带入输入框</button></>}</section>}
  </div>;
}
