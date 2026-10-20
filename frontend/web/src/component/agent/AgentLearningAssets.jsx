import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpenText, ChatCircleDots, CircleNotch, PencilSimple } from "@phosphor-icons/react";
import { agentRequest as api } from "./agentApi.js";
import { ExistingSceneAssets } from "./WorkspaceCollections.jsx";
import AgentPracticeDialog from "./AgentPracticeDialog.jsx";
import { learningLabel } from "./learningSelections.js";
import "./agentWorkspace.css";
import "./freeChatUx.css";

const tabs = [["all", "全部词句"], ["word", "词汇"], ["sentence", "句子"], ["chat", "对话记录"], ["practice", "练习记录"], ["existing", "场景资产"]];
const resources = { learning: ["/learning", "词句"], history: ["/conversations", "对话记录"], attempts: ["/attempts", "练习记录"] };
const date = (value) => new Date(value).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** The same chat assets are available in the conversation drawer and the existing asset page. */
export default function AgentLearningAssets({ initialTab = "all", onTabChange, onOpenConversation, onUseScene, renderSceneAssets, userId, onPractice }) {
  const [tab, setTab] = useState(initialTab);
  const [learning, setLearning] = useState([]);
  const [history, setHistory] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState({ learning: true, history: true, attempts: true });
  const [loadErrors, setLoadErrors] = useState({});
  const mounted = useRef(false), sequence = useRef({ learning: 0, history: 0, attempts: 0 });
  const [exercise, setExercise] = useState(null);
  const practiceAudio = useRef(null), practiceUrl = useRef(null);
  function stopReading() { practiceAudio.current?.pause(); practiceAudio.current = null; if (practiceUrl.current) URL.revokeObjectURL(practiceUrl.current); practiceUrl.current = null; }
  async function readAudio(key, blob) { stopReading(); practiceUrl.current = URL.createObjectURL(blob); practiceAudio.current = new Audio(practiceUrl.current); await practiceAudio.current.play(); }
  useEffect(() => () => stopReading(), []);
  useEffect(() => { setTab(tabs.some(([key]) => key === initialTab) ? initialTab : "all"); }, [initialTab]);
  async function loadResource(kind, signal) {
    const revision = ++sequence.current[kind];
    setLoading((old) => ({ ...old, [kind]: true }));
    setLoadErrors((old) => ({ ...old, [kind]: "" }));
    try {
      const data = await api(resources[kind][0], "GET", undefined, signal);
      if (mounted.current && revision === sequence.current[kind]) {
        ({ learning: setLearning, history: setHistory, attempts: setAttempts })[kind](data);
      }
    } catch (e) {
      if (mounted.current && revision === sequence.current[kind] && e.name !== "AbortError") {
        setLoadErrors((old) => ({ ...old, [kind]: `${resources[kind][1]}读取失败：${e.message || "请稍后重试"}` }));
      }
    } finally {
      if (mounted.current && revision === sequence.current[kind]) setLoading((old) => ({ ...old, [kind]: false }));
    }
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    for (const kind of Object.keys(resources)) void loadResource(kind, controller.signal);
    return () => { mounted.current = false; controller.abort(); };
  }, []);
  const startPractice = (item) => onPractice ? onPractice(item) : setExercise(item);
  const resource = tab === "chat" ? "history" : tab === "practice" ? "attempts" : "learning";
  const sectionError = loadErrors[resource];
  const externalScenes = tab === "existing" && renderSceneAssets;
  return <>
    <div className="agent-workspace aw-assets-surface">
      <section className="aw-library">
        {!externalScenes && <header><h1>学习资产</h1></header>}
        <nav className="aw-tabs aw-asset-tabs" aria-label="学习资产分类">{tabs.map(([key, label]) => <button key={key} className={tab === key ? "is-selected" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => { setTab(key); onTabChange?.(key); }}>{label}</button>)}</nav>
        {sectionError && !exercise && tab !== "existing" && <p role="alert" className="aw-inline-error">{sectionError} <button className="aw-link" disabled={loading[resource]} onClick={() => void loadResource(resource)}>重试读取</button></p>}
        {tab === "existing" ? !externalScenes && <ExistingSceneAssets onUse={onUseScene} /> : loading[resource] ? <div className="aw-empty"><CircleNotch className="aw-spin" /><p>正在读取学习资产…</p></div> : ["all", "word", "sentence"].includes(tab) ? <>
          <div className="aw-library-grid">{learning.filter((item) => tab === "all" || item.kind === tab).map((item) => <article className="aw-learning-card" key={item.id}>
            <small>{learningLabel(item)}</small><strong>{item.text}</strong>{item.meaning && <p>{item.meaning}</p>}<div><button className="aw-primary" onClick={() => startPractice(item)}><PencilSimple />造句练习</button><button onClick={() => onOpenConversation(item.sessionId)}>来源对话<ArrowRight /></button></div>
          </article>)}</div>
          {!sectionError && !learning.some((item) => tab === "all" || item.kind === tab) && <div className="aw-empty"><BookOpenText /><h2>把有用的表达留下来</h2><p>聊天中选中词句，或点击消息下的「收藏」，就会收藏在这里。</p></div>}
        </> : tab === "chat" ? <div className="aw-history-list">{history.map((record) => <button key={record.sessionId} onClick={() => onOpenConversation(record.sessionId)}><span className="aw-agent-symbol"><ChatCircleDots /></span><span><strong>{record.config.name}</strong><p>{record.config.purpose}</p><small>{date(record.createdAt)} · {record.config.level} · {record.channel === "voice" ? "语音" : "文字"}{record.status === "FAILED" ? " · 连接未完成" : ""}</small></span><ArrowRight /></button>)}{!sectionError && !history.length && <div className="aw-empty"><p>开始聊天后，记录会出现在这里。</p></div>}</div> : <div className="aw-practice-history">{attempts.map((item) => <article key={item.id}><small>{date(item.createdAt)}</small><h3>{item.text}</h3><p>你的表达：{item.answer}</p><div>{item.feedback}</div><button className="aw-link" onClick={() => onOpenConversation(item.sessionId)}>回到来源对话<ArrowRight /></button></article>)}{!sectionError && !attempts.length && <div className="aw-empty"><p>完成一次词句练习，反馈会保存在这里。</p></div>}</div>}
      </section>
      {exercise && <div className="freechat-v2"><AgentPracticeDialog item={exercise} userId={userId} onRead={readAudio} onSaved={() => void loadResource("attempts")} onClose={() => { stopReading(); setExercise(null); }} /></div>}
    </div>
    {externalScenes ? renderSceneAssets() : null}
  </>;
}
