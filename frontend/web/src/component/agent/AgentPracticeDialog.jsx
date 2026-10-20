import React, { useEffect, useRef, useState } from "react";
import AgentDialog from "./AgentDialog.jsx";
import useConversationDraft from "./useConversationDraft.js";
import { learningScope, sentences } from "./learningSelections.js";
import { agentRequest, agentSpeech } from "./agentApi.js";

export default function AgentPracticeDialog({ item, userId, live, onRead, onClose, onSaved }) {
  const [target, setTarget] = useState(() => learningScope(item) === "passage" ? null : item.text);
  const [busy, setBusy] = useState(false), [listening, setListening] = useState(false), [error, setError] = useState(""), [feedback, setFeedback] = useState("");
  const draft = useConversationDraft(userId, "practice"), pending = useRef(false), alive = useRef(true), controller = useRef(null), audio = useRef(null), answerInput = useRef(null);
  useEffect(() => { if (target) { const entry = draft.activate(`${item.id}:${encodeURIComponent(target)}`, "text"); if (entry.submitted) draft.patch({ text: "", request: null, submitted: false }); answerInput.current?.focus(); } }, [target, item.id]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  async function submit() {
    if (pending.current || !draft.text.trim()) return;
    pending.current = true; setBusy(true); setError(""); controller.current = new AbortController();
    const previous = draft.snapshot().request;
    const input = previous?.answer === draft.text && previous.targetText === target ? previous : { requestId: crypto.randomUUID(), answer: draft.text, targetText: target };
    draft.patch({ request: input });
    try { const result = await agentRequest(`/learning/${item.id}/attempts`, "POST", input, controller.current.signal); if (alive.current) { setFeedback(result.feedback); draft.patch({ submitted: true }); onSaved?.(); } }
    catch (e) { if (alive.current && e.name !== "AbortError") setError(e.message || "提交失败，请重试"); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  async function listen() {
    if (pending.current) return; pending.current = true; setListening(true); setError(""); controller.current = new AbortController();
    try { if (!audio.current) audio.current = await agentSpeech(item.sessionId, item.messageNo, controller.current.signal); if (alive.current) await onRead(`${item.sessionId}:${item.messageNo}`, audio.current); }
    catch (e) { if (alive.current && e.name !== "AbortError") setError(e.message || "朗读暂不可用"); }
    finally { pending.current = false; if (alive.current) setListening(false); }
  }
  return <AgentDialog label="造句练习" onClose={onClose} busy={busy} initialFocus={target ? "#practice-answer" : undefined} className="aw-practice-dialog">
    <div className="aw-ux-dialog-body">{!target ? <><p className="aw-dialog-caption">选择一句练习。</p><div className="aw-practice-sentences">{sentences(item.text).map((text) => <button className="aw-sentence-choice" key={text} disabled={text.length > 2000} onClick={() => setTarget(text)}>{text}</button>)}</div></> : <><h3 className="aw-practice-target">{target}</h3>{item.meaning && <p>{item.meaning}</p>}<button className="aw-link" disabled={live || listening} title={live ? "结束语音后可听来源消息" : "朗读来源消息"} onClick={listen}>{listening ? "准备声音…" : "听原句"}</button><details><summary>回看原文</summary><p>{item.sourceText}</p></details><label htmlFor="practice-answer">{item.kind === "word" ? "用这个表达造一句话" : "用相同句式表达你的想法"}</label><textarea ref={answerInput} id="practice-answer" value={draft.text} disabled={busy} maxLength={4000} placeholder="输入你的句子…" onChange={(e) => { draft.setText(e.target.value); draft.patch({ submitted: false }); setFeedback(""); }} />{draft.storageError && <p role="status">练习草稿暂未保存在本机，请保留此页面。</p>}{feedback && <div className="aw-feedback"><p>{feedback}</p><small>已保存到练习记录</small></div>}</>}{error && <p className="aw-inline-error" role="alert">{error}</p>}</div>
    {target && <footer className="aw-ux-dialog-footer"><button className="aw-outline" disabled={busy} onClick={onClose}>关闭</button><button className="aw-primary" disabled={busy || !draft.text.trim() || Boolean(feedback)} onClick={submit}>{busy ? "提交中…" : "提交造句"}</button></footer>}
  </AgentDialog>;
}
