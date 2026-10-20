import React, { useId } from "react";
import { CHAT_FONT_SIZES } from "./useReadingPreferences.js";

export default function AgentReadingSettings({ fontSize, onChange, error }) {
  const id = useId();
  return <section className="aw-reading-settings" aria-label="阅读设置">
    <div className="aw-setting"><label htmlFor={id}>聊天字号</label><select id={id} value={fontSize} onChange={(event) => onChange(Number(event.target.value))} aria-describedby={`${id}-hint`}>{CHAT_FONT_SIZES.map((size) => <option key={size} value={size}>{size}px{size === 18 ? " · 默认" : ""}</option>)}</select></div>
    <p className="aw-reading-caption" id={`${id}-hint`}>即时生效。</p>
    {error && <p className="aw-inline-error" role="status">字号已应用，本机暂时无法保存，刷新后可能恢复默认。</p>}
  </section>;
}
