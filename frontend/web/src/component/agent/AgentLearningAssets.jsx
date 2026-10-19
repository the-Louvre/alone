import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpenText, ChatCircleDots, CircleNotch, Play, X } from "@phosphor-icons/react";
import { agentRequest as api } from "./agentApi.js";
import { ExistingSceneAssets } from "./WorkspaceCollections.jsx";
import "./agentWorkspace.css";

const tabs = [["all", "全部词句"], ["word", "词汇"], ["sentence", "句子"], ["chat", "对话记录"], ["practice", "练习记录"], ["existing", "场景资产"]];
const date = (value) => new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** The same chat assets are available in the conversation drawer and the existing asset page. */
export default function AgentLearningAssets({ initialTab = "all", onTabChange, onOpenConversation, onUseScene, renderSceneAssets }) {
  const [tab, setTab] = useState(initialTab);
  const [learning, setLearning] = useState([]);
  const [history, setHistory] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exercise, setExercise] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setTab(tabs.some(([key]) => key === initialTab) ? initialTab : "all"); }, [initialTab]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api("/learning"), api("/conversations"), api("/attempts")]).then(([items, records, practices]) => {
      if (!cancelled) { setLearning(items); setHistory(records); setAttempts(practices); }
    }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  async function practice() {
    if (busy || !answer.trim()) return;
    const input = request?.answer === answer ? request : { requestId: crypto.randomUUID(), answer };
    setRequest(input); setBusy(true); setError("");
    try {
      const result = await api(`/learning/${exercise.id}/attempts`, "POST", input);
      setFeedback(result.feedback); setAttempts(await api("/attempts"));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const startPractice = (item) => { setExercise(item); setAnswer(""); setFeedback(""); setRequest(null); };
  const externalScenes = tab === "existing" && renderSceneAssets;
  return <>
    <div className="agent-workspace aw-assets-surface">
      <section className="aw-library">
        {!externalScenes && <header><p className="aw-eyebrow">KEEP WHAT YOU LEARN</p><h1>学习资产</h1><p>聊天里的词句、练习反馈和对话记录，与已有场景资产一起保留。</p></header>}
        <nav className="aw-tabs aw-asset-tabs" aria-label="学习资产分类">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "is-selected" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => { setTab(key); onTabChange?.(key); }}>{label}</button>)}</nav>
        {error && !exercise && <p role="alert" className="aw-inline-error">{error}</p>}
        {tab === "existing" ? !externalScenes && <ExistingSceneAssets onUse={onUseScene} /> : loading ? <div className="aw-empty"><CircleNotch className="aw-spin" /><p>正在读取学习资产…</p></div> : ["all", "word", "sentence"].includes(tab) ? <>
          <div className="aw-library-grid">{learning.filter((item) => tab === "all" || item.kind === tab).map((item) => <article className="aw-learning-card" key={item.id}>
            <small>{item.kind === "word" ? "词汇" : "句子"}</small><strong>{item.text}</strong><p>{item.meaning || "结合来源对话，试着用自己的话表达。"}</p><div><button className="aw-primary" onClick={() => startPractice(item)}><Play />开始练习</button><button onClick={() => onOpenConversation(item.sessionId)}>来源对话<ArrowRight /></button></div>
          </article>)}</div>
          {!learning.some((item) => tab === "all" || item.kind === tab) && <div className="aw-empty"><BookOpenText /><h2>把有用的表达留下来</h2><p>聊天中选中词句，或点击「提取词句」，就会收藏在这里。</p></div>}
        </> : tab === "chat" ? <div className="aw-history-list">{history.map((record) => <button key={record.sessionId} onClick={() => onOpenConversation(record.sessionId)}><span className="aw-agent-symbol"><ChatCircleDots /></span><span><strong>{record.config.name}</strong><p>{record.config.purpose}</p><small>{date(record.createdAt)} · {record.config.level} · {record.channel === "voice" ? "语音" : "文字"}{record.status === "FAILED" ? " · 连接未完成" : ""}</small></span><ArrowRight /></button>)}{!history.length && <div className="aw-empty"><p>开始聊天后，记录会出现在这里。</p></div>}</div> : <div className="aw-practice-history">{attempts.map((item) => <article key={item.id}><small>{date(item.createdAt)}</small><h3>{item.text}</h3><p>你的表达：{item.answer}</p><div>{item.feedback}</div><button className="aw-link" onClick={() => onOpenConversation(item.sessionId)}>回到来源对话<ArrowRight /></button></article>)}{!attempts.length && <div className="aw-empty"><p>完成一次词句练习，反馈会保存在这里。</p></div>}</div>}
      </section>
      {exercise && <div className="aw-modal-backdrop"><section className="aw-modal" role="dialog" aria-modal="true" aria-label="词句训练" onKeyDown={(e) => { if (e.key === "Escape" && !busy) { e.stopPropagation(); setExercise(null); } }}><button aria-label="关闭词句训练" className="aw-modal-close" disabled={busy} onClick={() => setExercise(null)}><X /></button><p className="aw-eyebrow">PRACTICE AN EXPRESSION</p><h2>{exercise.text}</h2><p>{exercise.meaning}</p><details><summary>回看原句</summary><p>{exercise.sourceText}</p></details><label htmlFor="asset-practice-answer">试着用这个表达说一句话</label><textarea id="asset-practice-answer" autoFocus value={answer} maxLength={4000} disabled={busy} onChange={(e) => { setAnswer(e.target.value); setFeedback(""); }} placeholder="Write your own sentence…" /><button className="aw-primary" disabled={busy || !answer.trim()} onClick={practice}>{busy ? "正在整理建议…" : "获得表达建议"}</button>{error && <p role="alert" className="aw-inline-error">{error}</p>}{feedback && <div className="aw-feedback"><p>{feedback}</p><small>已保存到练习记录</small></div>}</section></div>}
    </div>
    {externalScenes ? renderSceneAssets() : null}
  </>;
}
