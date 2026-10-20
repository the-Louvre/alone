import React from "react";
import { BookOpenText, PencilSimple, X } from "@phosphor-icons/react";
import AgentDialog from "./AgentDialog.jsx";
import { learningLabel } from "./learningSelections.js";

export default function AgentNotesPanel({ open, wide, items = [], config, live, busy, error, onClose, onEnd, onPractice }) {
  if (!open) return null;
  const content = <><h3>本次收藏 <span>{items.length}</span></h3>{items.length ? items.map((item) => <div className="aw-learning-card" key={item.id}><small>{learningLabel(item)}</small><strong>{item.text}</strong>{item.meaning && <p>{item.meaning}</p>}<button onClick={() => onPractice(item)}><PencilSimple />造句练习</button></div>) : <p className="aw-collection-empty">选中消息中的表达即可收藏。</p>}<details className="aw-snapshot"><summary>查看本次提示词</summary><p>{config?.prompt}</p><small>{config?.level}</small></details></>;
  if (wide) return <aside className="aw-chat-learning is-open" aria-label="本次随手记"><header><BookOpenText /><h2>本次随手记</h2><button className="aw-icon-button" aria-label="收起随手记" onClick={onClose}><X /></button></header>{content}</aside>;
  return <AgentDialog label="随手记" drawer className="aw-notes-dialog" onClose={onClose} headerExtra={live ? <button className="aw-link aw-notes-end" disabled={busy} onClick={onEnd}>结束语音</button> : null}><div className="aw-ux-dialog-body">{live && <p className="aw-dialog-caption">语音通话中</p>}{error && <p role="alert" className="aw-error">{error}</p>}{content}</div></AgentDialog>;
}
