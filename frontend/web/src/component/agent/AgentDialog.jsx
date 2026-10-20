import React, { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

const dialogStack = [];

function focusable(root) {
  return [...root.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],summary,[tabindex="0"]')].filter((node) => {
    if (node.closest('[hidden],[inert]')) return false;
    const closed = node.closest("details:not([open])");
    if (closed && closed.querySelector("summary") !== node) return false;
    for (let parent = node; parent && parent !== root; parent = parent.parentElement) {
      const style = getComputedStyle(parent); if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  });
}
export default function AgentDialog({ label, closeLabel, title = label, onClose, busy = false, className = "", children, initialFocus, drawer = false, headerExtra }) {
  const root = useRef(null), close = useRef(onClose), blocked = useRef(busy);
  close.current = onClose; blocked.current = busy;
  useEffect(() => {
    const trigger = document.activeElement;
    const element = root.current; dialogStack.push(element);
    const initial = initialFocus && root.current.querySelector(initialFocus);
    (initial || root.current).focus(); initial?.scrollIntoView({ block: "nearest" });
    const keys = (event) => {
      if (!root.current || dialogStack.at(-1) !== root.current) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); if (!blocked.current) close.current(); }
      if (event.key === "Tab") {
        const nodes = focusable(root.current), first = nodes[0], last = nodes.at(-1);
        if (!nodes.length) { event.preventDefault(); root.current.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !root.current.contains(document.activeElement) || document.activeElement === root.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !root.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keys, true);
    return () => { const index = dialogStack.indexOf(element); if (index >= 0) dialogStack.splice(index, 1); document.removeEventListener("keydown", keys, true); if (trigger?.isConnected) trigger.focus(); };
  }, []);
  return <div className={drawer ? "aw-settings-backdrop" : "aw-modal-backdrop"} onClick={() => { if (!busy) onClose(); }}>
    <section ref={root} tabIndex={-1} className={`${drawer ? "aw-ux-drawer" : "aw-modal"} ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
      <header className="aw-ux-dialog-header"><h2>{title}</h2>{headerExtra}<button className="aw-icon-button" disabled={busy} aria-label={closeLabel || `关闭${label}`} onClick={onClose}><X /></button></header>
      {children}
    </section>
  </div>;
}
