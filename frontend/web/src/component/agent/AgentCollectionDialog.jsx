import React, { useEffect, useRef, useState } from "react";
import AgentDialog from "./AgentDialog.jsx";
import { agentRequest } from "./agentApi.js";
import { sentences } from "./learningSelections.js";

export default function AgentCollectionDialog({ message, sourceId, learning, busy, error, onSave, onClose }) {
  const [selected, setSelected] = useState([]), [suggestions, setSuggestions] = useState(null), [loading, setLoading] = useState(false), [failure, setFailure] = useState("");
  const abort = useRef(null), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  const exists = (item) => learning.some((entry) => entry.sessionId === sourceId && entry.messageNo === message.messageNo && entry.kind === item.kind && entry.text === item.text);
  const options = [...sentences(message.content).map((text) => ({ kind: "sentence", scope: "sentence", text })), ...(suggestions || []).map((item) => ({ ...item, scope: item.kind }))].filter((item, index, items) => items.findIndex((x) => x.kind === item.kind && x.text === item.text) === index);
  async function recommend() {
    if (loading) return; abort.current = new AbortController(); setLoading(true); setFailure("");
    try { const items = await agentRequest(`/conversations/${sourceId}/messages/${message.messageNo}/suggestions`, "POST", undefined, abort.current.signal); if (alive.current) setSuggestions(items); }
    catch (e) { if (alive.current && e.name !== "AbortError") setFailure(e.message); }
    finally { if (alive.current) setLoading(false); }
  }
  async function save(items) {
    for (const item of items) if (!exists(item) && !await onSave(item)) return;
    onClose();
  }
  return <AgentDialog label="收藏词句" onClose={onClose} busy={busy} className="aw-collection-dialog">
    <div className="aw-ux-dialog-body"><p className="aw-dialog-caption">选择要收藏的句子。</p>
      <div className="aw-sentence-list">{options.map((item) => { const id = `${item.kind}:${item.text}`, saved = exists(item); return <label className={`aw-sentence-choice ${saved ? "is-saved" : ""}`} key={id}><input type="checkbox" disabled={busy || saved || item.text.length > 2000} checked={saved || selected.includes(id)} onChange={(e) => setSelected((old) => e.target.checked ? [...old, id] : old.filter((value) => value !== id))} /><span><span>{item.text}</span>{item.meaning && <small>{item.meaning}</small>}{saved && <small>已收藏</small>}{item.text.length > 2000 && <small>这句较长，请在原文中选取需要的表达。</small>}</span></label>; })}</div>
      <div className="aw-collection-secondary"><button className="aw-link" onClick={recommend} disabled={loading || busy}>{loading ? "正在推荐…" : suggestions ? "重新推荐表达" : "推荐表达"}</button><button className="aw-link" disabled={busy || message.content.length > 2000 || exists({ kind: "sentence", text: message.content })} onClick={() => save([{ kind: "sentence", scope: "passage", text: message.content }])}>收藏整段</button></div>
      {(error || failure) && <p role="alert" className="aw-inline-error">{error || failure}</p>}
    </div><footer className="aw-ux-dialog-footer"><button className="aw-outline" disabled={busy} onClick={onClose}>取消</button><button className="aw-primary" disabled={busy || !selected.length} onClick={() => save(options.filter((item) => selected.includes(`${item.kind}:${item.text}`)))}>{busy ? "保存中…" : "确认收藏"}</button></footer>
  </AgentDialog>;
}
