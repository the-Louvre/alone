import React, { useEffect, useRef, useState } from "react";
import { CircleNotch, Plus, Check, SpeakerHigh, Stop, Translate } from "@phosphor-icons/react";
import { agentRequest, agentSpeech } from "./agentApi.js";

export default function AgentMessageTools({ message, sessionId, live, collecting, onExtract, onCollect, onRead, readingKey, collectedCount = 0 }) {
  const [translation, setTranslation] = useState(null), [translated, setTranslated] = useState(false);
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const audioBlob = useRef(null), request = useRef(null), alive = useRef(true), pending = useRef(false);
  const key = `${sessionId}:${message.messageNo}`;
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  async function tool(kind) {
    if (pending.current) return;
    if (kind === "translate" && translation) { setTranslated(!translated); return; }
    const controller = new AbortController(); request.current = controller; pending.current = true; setBusy(kind); setError("");
    try {
      if (kind === "translate") {
        const result = await agentRequest(`/conversations/${sessionId}/messages/${message.messageNo}/translation`, "POST", undefined, controller.signal);
        if (alive.current) { setTranslation(result.text); setTranslated(true); }
      } else {
        if (!audioBlob.current) audioBlob.current = await agentSpeech(sessionId, message.messageNo, controller.signal);
        if (alive.current) await onRead(key, audioBlob.current);
      }
    } catch (e) { if (alive.current && e.name !== "AbortError") setError(e.message || "暂时不可用，请重试"); }
    finally { pending.current = false; if (alive.current) setBusy(""); }
  }
  return <>
    <div className="aw-message-actions">
      <button disabled={Boolean(busy) || live || message.content.length > 4000} title={live ? "结束语音后可朗读这句" : "朗读这句"} onClick={() => void tool("speech")}>{busy === "speech" ? <CircleNotch className="aw-spin" /> : readingKey === key ? <Stop /> : <SpeakerHigh />}{readingKey === key ? "停止朗读" : "听这句"}</button>
      <button disabled={Boolean(busy) || message.content.length > 4000} onClick={() => void tool("translate")}>{busy === "translate" ? <CircleNotch className="aw-spin" /> : <Translate />}{translated ? "收起翻译" : "翻译"}</button>
      <button disabled={collecting} aria-label={collectedCount ? `已收藏 ${collectedCount} 项，查看收藏` : "收藏词句"} title="选择原句或收藏整段" className={collectedCount ? "is-collected" : ""} onClick={onCollect}>{collectedCount ? <Check /> : <Plus />}{collectedCount ? `已收藏 ${collectedCount}` : "收藏"}</button>
    </div>
    {translated && translation && <p className="aw-message-translation">{translation}</p>}
    {error && <p className="aw-tool-error" role="alert">{error}<button onClick={() => { setError(""); }}>关闭</button></p>}
  </>;
}
