import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, CircleNotch } from "@phosphor-icons/react";
import { getDailyPicks, getLearningAssets, getLearningAsset } from "../../infrastructure/http/apiClient.js";

export function SceneSuggestions({ onUse }) {
  const [picks, setPicks] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getDailyPicks().then((data) => { if (!cancelled) setPicks(data?.picks || []); })
      .catch(() => { if (!cancelled) setError("暂时无法读取场景，请稍后重试。你也可以直接写下聊天目的。"); });
    return () => { cancelled = true; };
  }, []);
  return <section className="aw-scene-suggestions" aria-label="聊天场景灵感">
    {error ? <p role="alert">{error}</p> : !picks ? <p role="status">正在读取场景灵感…</p> : picks.length ? picks.map((scene) => <button key={scene.id || scene.title} onClick={() => onUse(scene)}><span><strong>{scene.title}</strong><small>{scene.goal}</small></span><ArrowRight /></button>) : <p>暂时没有推荐场景，直接写下你想聊的内容即可。</p>}
  </section>;
}

export function ExistingSceneAssets({ onUse, onStartConversation }) {
  const [records, setRecords] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    getLearningAssets().then((data) => { if (!cancelled) setRecords(data || []); }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const open = async (record) => {
    setLoading(true); setError("");
    try { setDetail(await getLearningAsset(record.sceneId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  if (loading) return <div className="aw-empty"><CircleNotch className="aw-spin" /><p>正在读取已有资产…</p></div>;
  return <div className="aw-existing-assets">{error && <p className="aw-inline-error" role="alert">{error}</p>}{detail ? <><button className="aw-link" onClick={() => setDetail(null)}><ArrowLeft />返回已有场景</button><header><h2>{detail.title || "已有场景"}</h2><button className="aw-primary" onClick={() => onUse({ title: detail.title, sceneInput: detail.background || detail.title, goal: detail.learningGoal })}>带入 Agent 聊天<ArrowRight /></button></header><div className="aw-library-grid">{[...(detail.wordList || []).map((x) => ({ ...x, kind: "词汇" })), ...(detail.phraseList || []).map((x) => ({ ...x, kind: "短语" })), ...(detail.sentenceList || []).map((x) => ({ ...x, kind: "句子" }))].map((item, index) => <article className="aw-learning-card" key={item.contentId || index}><small>{item.kind}</small><strong>{item.englishText}</strong><p>{item.chineseText}</p></article>)}</div></> : <div className="aw-history-list">{records.map((record) => <button key={record.sceneId} onClick={() => open(record)}><span className="aw-agent-symbol"><BookOpenText /></span><span><strong>{record.title}</strong><p>{record.label || "已有场景"} · 原有词汇、短语与句子</p></span><ArrowRight /></button>)}{!records.length && <div className="aw-empty"><BookOpenText /><p>以前保存的场景资产会显示在这里。新的聊天词句在「全部词句」中。</p>{onStartConversation && <button className="aw-primary" onClick={onStartConversation}>进入我的陪练<ArrowRight /></button>}</div>}</div>}</div>;
}
