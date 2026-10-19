import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowClockwise, ChatCircleDots, CircleNotch, Trash, X } from "@phosphor-icons/react";
import { agentRequest as api } from "./agentApi.js";
const date = (value) => new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
export default function AgentConversationHistory({ agentId, agentName, onClose, onOpen, onRemoved, currentThreadId, currentSessionId, deleteBlocked = "" }) {
  const [all, setAll] = useState(!agentId), [trash, setTrash] = useState(false);
  const [records, setRecords] = useState([]), [legacy, setLegacy] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [more, setMore] = useState(false);
  const [target, setTarget] = useState(null), [mutating, setMutating] = useState(false), [notice, setNotice] = useState("");
  const dialog = useRef(null), cancel = useRef(null), sequence = useRef(0), mutation = useRef(false), trigger = useRef(null), actionButtons = useRef(new Map());
  const isCurrent = (record) => record.threadId ? record.threadId === currentThreadId : record.sessionId === currentSessionId;
  const close = () => { if (!mutation.current) onClose(); };
  async function load(offset = 0) {
    const seq = ++sequence.current; setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ offset: String(offset) }); if (!all && agentId) params.set("agentId", agentId);
      if (trash) params.set("deleted", "true");
      const items = await api(`/threads?${params}`);
      const old = all && offset === 0 ? await api(`/legacy-conversations${trash ? "?deleted=true" : ""}`) : null;
      if (seq !== sequence.current) return;
      setRecords((previous) => offset ? [...previous, ...items] : items); setMore(items.length === 50);
      if (old) setLegacy(old); else if (!all) setLegacy([]);
    } catch (e) { if (seq === sequence.current) setError(e.message); }
    finally { if (seq === sequence.current) setLoading(false); }
  }
  useEffect(() => { setRecords([]); setLegacy([]); setMore(false); setNotice(""); void load(); return () => { sequence.current += 1; }; }, [agentId, all, trash]);
  useEffect(() => { const initial = document.activeElement; dialog.current?.focus(); return () => { if (initial?.isConnected) initial.focus(); }; }, []);
  useEffect(() => { if (target) cancel.current?.focus(); else if (actionButtons.current.get(trigger.current)?.isConnected) actionButtons.current.get(trigger.current).focus(); else dialog.current?.focus(); }, [target]);
  function requestDelete(record) { trigger.current = record.threadId || record.sessionId; setError(""); setTarget(record); }
  async function change(record, restore = false) {
    if (mutation.current) return;
    if (!restore && isCurrent(record) && deleteBlocked) { setError(deleteBlocked); return; }
    mutation.current = true; setMutating(true); setError("");
    try {
      const id = record.threadId || record.sessionId;
      await api(`/${record.threadId ? "threads" : "legacy-conversations"}/${encodeURIComponent(id)}${restore ? "/restore" : ""}`, restore ? "POST" : "DELETE");
      const remove = (items) => items.filter((item) => (item.threadId || item.sessionId) !== id);
      setRecords(remove); setLegacy(remove); setTarget(null);
      setNotice(restore ? "已恢复，可在对话记录中打开。" : "已移入回收站，可随时恢复。");
      if (!restore) await onRemoved?.(record);
    } catch (e) { setError(e.message || "操作失败，请重试"); }
    finally { mutation.current = false; setMutating(false); }
  }
  function keys(e) {
    if (e.key === "Escape") { e.stopPropagation(); if (!mutation.current) { if (target) { setTarget(null); setError(""); } else close(); } }
    if (e.key === "Tab") {
      const elements = [...dialog.current.querySelectorAll('button:not([disabled])')];
      const first = elements[0], last = elements.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  function row(record) {
    const old = !record.threadId, id = record.threadId || record.sessionId, name = old ? "旧版语音对话" : record.config.name;
    const blocked = !trash && isCurrent(record) && deleteBlocked;
    return <div className="aw-history-row" key={id}>
      <button className="aw-history-open" disabled={mutating || trash} onClick={() => onOpen(id, !old)}>
        <span className="aw-agent-symbol"><ChatCircleDots /></span><span><strong>{name}</strong><p>{record.preview || (old ? "原始语音记录" : "尚未发送消息")}</p><small>{date(record.lastMessageAt || record.createdAt)} · {record.messageCount} 条消息</small></span>{!trash && <ArrowRight />}
      </button>
      <button ref={(node) => { if (node) actionButtons.current.set(id, node); else actionButtons.current.delete(id); }} className={`aw-history-action ${trash ? "" : "aw-history-delete"}`} disabled={mutating || Boolean(blocked)} title={blocked || (trash ? "恢复对话" : "移入回收站")} aria-label={`${trash ? "恢复" : "删除"}${name}的对话 ${date(record.createdAt)}`} onClick={() => trash ? void change(record, true) : requestDelete(record)}>{trash ? <><ArrowClockwise /><span>恢复</span></> : <Trash />}</button>
    </div>;
  }
  return <div className="aw-settings-backdrop" onClick={close}><aside ref={dialog} tabIndex={-1} className="aw-history-drawer" role="dialog" aria-modal="true" aria-label="对话历史记录" onClick={(e) => e.stopPropagation()} onKeyDown={keys}>
    <header className="aw-drawer-header"><div><h2>{target ? "删除这段对话？" : trash ? "对话回收站" : all ? "全部对话记录" : `${agentName}的对话`}</h2><p>{target ? "移入回收站后，可以随时恢复。" : trash ? "恢复后，原来的消息和设置都会保留。" : "每段对话都保留当时的设置和消息。"}</p></div><button aria-label="关闭对话历史" className="aw-icon-button" disabled={mutating} onClick={close}><X /></button></header>
    {target ? <div className="aw-history-confirm"><span className="aw-history-confirm-icon"><Trash /></span><h3>{target.config?.name || "旧版语音对话"}</h3><p>{date(target.createdAt)} · {target.messageCount} 条消息</p><blockquote>{target.preview || "尚未发送消息"}</blockquote><p>只移除这段对话的历史入口。Agent 设置、已收藏的词句和练习记录会保留。</p>{error && <p className="aw-inline-error" role="alert">{error}</p>}<div><button ref={cancel} className="aw-outline" disabled={mutating} onClick={() => { setTarget(null); setError(""); }}>取消</button><button className="aw-danger" disabled={mutating || (isCurrent(target) && Boolean(deleteBlocked))} onClick={() => void change(target)}>{mutating ? <CircleNotch className="aw-spin" /> : <Trash />}移入回收站</button></div>{isCurrent(target) && deleteBlocked && <p>{deleteBlocked}</p>}</div> : <>
      <div className="aw-history-toolbar"><div className="aw-history-filters">{agentId && <><button disabled={mutating} className={!all ? "is-selected" : ""} onClick={() => setAll(false)}>当前 Agent</button><button disabled={mutating} className={all ? "is-selected" : ""} onClick={() => setAll(true)}>全部 Agent</button></>}</div><button className="aw-link" disabled={mutating} onClick={() => setTrash(!trash)}>{trash ? <ArrowRight /> : <Trash />}{trash ? "返回记录" : "回收站"}</button></div>
      {notice && <p className="aw-history-status" role="status">{notice}</p>}
      {error && <p className="aw-inline-error" role="alert">{error}<button className="aw-link" onClick={() => load()}>重试读取</button></p>}
      <div className="aw-history-list">{records.map(row)}</div>
      {loading && <p className="aw-empty"><CircleNotch className="aw-spin" />正在读取历史…</p>}
      {!loading && !error && !records.length && !legacy.length && <div className="aw-empty"><h3>{trash ? "回收站是空的" : "还没有对话记录"}</h3><p>{trash ? "移除的对话会保留在这里，可随时恢复。" : "发送消息或开始语音后，会保存在这里。"}</p></div>}
      {more && <button className="aw-outline aw-load-more" disabled={loading || mutating} onClick={() => load(records.length)}>加载更多</button>}
      {legacy.length > 0 && <section className="aw-legacy-history"><h3>旧版对话</h3><p>这些记录没有保存 Agent 关联，原始消息仍然保留。</p><div className="aw-history-list">{legacy.map(row)}</div></section>}
    </>}
  </aside></div>;
}
