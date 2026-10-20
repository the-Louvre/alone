import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Plus, Copy, Check, Sparkle, Suitcase, ChatCircleDots, BookOpenText, ClockCounterClockwise, SpeakerHigh, Play, Stop, Microphone, MicrophoneSlash, PaperPlaneTilt, X, SlidersHorizontal, CaretDown, ArrowClockwise, CircleNotch, PencilSimple, Scissors, GlobeHemisphereWest, DotsThree, Waveform, SquaresFour, UserCircle } from "@phosphor-icons/react";
import { teachers } from "../../domain/content/data.js";
import { createRealtimeClient } from "../../websocket/realtimeClient.js";
import { agentRequest as api, presets, blankAgent, fromSaved, readAgentDraft } from "./agentApi.js";
import useConversationDraft from "./useConversationDraft.js";
import AgentDialog from "./AgentDialog.jsx";
import AgentReadingSettings from "./AgentReadingSettings.jsx";
import useReadingPreferences from "./useReadingPreferences.js";
import { conversationContext, continuesMessage } from "./conversationPresentation.js";
import AgentNotesPanel from "./AgentNotesPanel.jsx";
import AgentCollectionDialog from "./AgentCollectionDialog.jsx";
import AgentPracticeDialog from "./AgentPracticeDialog.jsx";
import AgentMessageTools from "./AgentMessageTools.jsx";
import AgentReplyHint from "./AgentReplyHint.jsx";
import AgentLearningAssets from "./AgentLearningAssets.jsx";
import AgentConversationHistory from "./AgentConversationHistory.jsx";
import { SceneSuggestions } from "./WorkspaceCollections.jsx";
import "./agentWorkspace.css";
import "./freeChatDesign.css";
import "./freeChatUx.css";

const corrections = { gentle: "轻柔提醒", after: "聊完后提醒", "on-request": "问到时再纠正" };
const levels = { A1: "初次开口", A2: "简单交流", B1: "日常交流", B2: "深入表达", C1: "自如讨论", C2: "精细表达" };
const Icon = ({ name = "", index = 0, ...props }) => /理发|托尼|barber/i.test(name) ? <Scissors {...props} /> : /旅|travel/i.test(name) ? <GlobeHemisphereWest {...props} /> : index % 3 === 0 ? <Suitcase {...props} /> : <ChatCircleDots {...props} />;
const cleanConfig = ({ presetKey, ...config }) => config;
const Spinner = () => <CircleNotch className="aw-spin" aria-hidden="true" />;
const assetTabs = [["all", "全部词句"], ["word", "词汇"], ["sentence", "句子"], ["chat", "对话记录"], ["practice", "练习记录"], ["existing", "已有场景"]];
function workspaceRoute(sessionId, search) {
  const params = new URLSearchParams(search);
  return { view: sessionId || params.has("preset") || params.has("draft") ? "chat" : "editor", panel: params.get("section") === "assets" ? "assets" : null, tab: assetTabs.some(([key]) => key === params.get("tab")) ? params.get("tab") : "all" };
}

export default function AgentWorkspace({ userId, sessionId, routeSearch = window.location.search, onNavigate, onPageNavigate, onActiveChange, onSessionEnded }) {
  const reading = useReadingPreferences(userId);
  const [draft] = useState(() => readAgentDraft(userId));
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [inspiration, setInspiration] = useState(false);
  const [config, setConfig] = useState(draft.config);
  const [dirty, setDirty] = useState(draft.dirty);
  const [view, setView] = useState(() => workspaceRoute(sessionId, routeSearch).view);
  const [panel, setPanel] = useState(() => workspaceRoute(sessionId, routeSearch).panel);
  const [conversation, setConversation] = useState(null);
  const [conversationError, setConversationError] = useState("");
  const [loadingConversation, setLoadingConversation] = useState(Boolean(sessionId));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opening, setOpening] = useState("");
  const [generated, setGenerated] = useState(false);
  const [settings, setSettings] = useState(false);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false), [historyAll, setHistoryAll] = useState(false);
  const [voicePreview, setVoicePreview] = useState(false);
  const chatDraft = useConversationDraft(userId);
  const { text, setText, mode, setMode } = chatDraft;
  const [recentConversation, setRecentConversation] = useState(null), [pendingPreset, setPendingPreset] = useState(null);
  const pendingPresetRef = useRef(null), localNavigation = useRef(null);
  const [collectionMessage, setCollectionMessage] = useState(null), [wideNotes, setWideNotes] = useState(false), [newMessages, setNewMessages] = useState(false);
  const mainArea = useRef(null), messageArea = useRef(null), stickToBottom = useRef(true), previousMessageCount = useRef(0);
  const [live, setLive] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false), [menuOpen, setMenuOpen] = useState(false);
  const [discover, setDiscover] = useState(false), [mobileNav, setMobileNav] = useState(false), [transition, setTransition] = useState(null);
  const [callPhase, setCallPhase] = useState("语音已连接"), [callSeconds, setCallSeconds] = useState(0), [readingKey, setReadingKey] = useState(null);
  const [muted, setMuted] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selection, setSelection] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [assetTab, setAssetTab] = useState(() => workspaceRoute(sessionId, routeSearch).tab);
  const pendingKey = `unispeaking.pending-transcripts.${userId || "local"}`;
  const [unsaved, setUnsaved] = useState(() => { try { return JSON.parse(sessionStorage.getItem(pendingKey)) || []; } catch { return []; } });
  const audio = useRef(null), preview = useRef(null), client = useRef(null);
  const readingAudio = useRef(null), readingUrl = useRef(null), transitionElement = useRef(null), discoverElement = useRef(null), menuElement = useRef(null), navigationElement = useRef(null);
  const currentId = useRef(null), currentThread = useRef(null), currentAgent = useRef(null);
  const mounted = useRef(true), generation = useRef(null), revision = useRef(0);
  const turnRequest = useRef(null), threadRequest = useRef(crypto.randomUUID()), attemptRequest = useRef(null);
  const bottom = useRef(null), refreshSequence = useRef(0), routeSequence = useRef(0);
  const pending = useRef(false), active = useRef(false), panelElement = useRef(null), settingsElement = useRef(null), focusVoiceSettings = useRef(false);
  const completedSessions = useRef(new Set()), agentsRef = useRef([]), unsavedRef = useRef(unsaved);
  const rootRestored = useRef(false);
  const rememberText = () => {};
  function restoreText(key, channel = "voice") {
    const entry = chatDraft.activate(`thread:${key}`, channel, { legacyKey: key });
    turnRequest.current = entry.request || null;
  }
  function navigateKnown(path) {
    localNavigation.current = path;
    onNavigate(path);
  }
  function restorePreset(key) {
    const preset = presets.find((item) => item.presetKey === key);
    if (!preset) return;
    const existing = agentsRef.current.find((agent) => agent.presetKey === key);
    if (existing) {
      if (chatDraft.read(`new:${existing.id}`)?.text) openNewDraft(existing);
      else { onNavigate(`/conversation/agents/${existing.id}`); void restore(`agent:${existing.id}`); }
      return;
    }
    setPanel(null); setCollectionMessage(null); setNotesOpen(false); setHistoryOpen(false);
    rootRestored.current = true; pendingPresetRef.current = key; setPendingPreset(key);
    currentAgent.current = null; currentThread.current = null; currentId.current = null;
    setSelectedAgent(null); setConversation(null); setRecentConversation(null); setLoadingConversation(false); setConversationError("");
    const entry = chatDraft.activate(`preset:${key}`);
    setConfig(entry.context?.config || cleanConfig(preset)); setDirty(false); setEditing(false); setView("chat");
    threadRequest.current = entry.creationId; turnRequest.current = entry.request || null;
    chatDraft.patch({ context: { config: entry.context?.config || cleanConfig(preset), presetKey: key } });
  }
  async function ensurePreset(snapshot) {
    if (!pendingPresetRef.current) return cleanConfig(snapshot);
    const saved = await api(`/presets/${pendingPresetRef.current}`, "POST", { config: cleanConfig(snapshot), requestId: chatDraft.snapshot().creationId });
    const items = [saved, ...agentsRef.current.filter((item) => item.id !== saved.id)];
    agentsRef.current = items; setAgents(items); currentAgent.current = saved.id; setSelectedAgent(saved); setConfig(fromSaved(saved));
    pendingPresetRef.current = null; setPendingPreset(null); chatDraft.promote(`new:${saved.id}`);
    navigateKnown(`/conversation/agents/${saved.id}?new=${threadRequest.current}`);
    return fromSaved(saved);
  }
  function notifyCompletion(result) {
    const parts = result?.segments?.length ? [result.segments.at(-1)] : (result?.sessionId ? [result] : []);
    for (const part of parts) if (part.status === "COMPLETED" && !completedSessions.current.has(part.sessionId)) {
      completedSessions.current.add(part.sessionId); onSessionEnded?.(part.sessionId);
    }
  }
  async function run(key, operation) {
    if (pending.current) return;
    pending.current = true; setBusy(key); setError("");
    try { return await operation(); }
    catch (err) { if (mounted.current && err.name !== "AbortError") setError(err.message || "请求失败，请重试"); }
    finally { pending.current = false; if (mounted.current) setBusy(""); }
  }
  const flash = (message) => setNotice(message);
  const update = (key, value) => {
    rootRestored.current = true; revision.current += 1;
    setConfig((old) => ({ ...old, [key]: value })); setDirty(true);
    if (["prompt", "purpose", "level"].includes(key)) setOpening("");
  };
  const setActive = (value) => { active.current = value; setLive(value); onActiveChange?.(value); };
  function applyConversation(result, promoteDraft = false) {
    if (result?.messages?.length) setRecentConversation(result);
    if (promoteDraft && result?.threadId && /^(new|preset|custom):/.test(chatDraft.currentKey() || "")) chatDraft.promote(`thread:${result.threadId}`);
    setConversation(result); setConversationError(""); setLoadingConversation(false); setView("chat");
    currentThread.current = result?.threadId || null; currentId.current = result?.sessionId || null;
    if (result?.agentId || result?.config?.id) {
      currentAgent.current = result.agentId || result.config.id;
      const saved = agentsRef.current.find((a) => a.id === currentAgent.current);
      if (saved) setSelectedAgent(saved);
    } else if (result) { currentAgent.current = null; setSelectedAgent(null); }
  }
  async function refresh(id = currentThread.current || currentId.current) {
    if (!id) return;
    const sequence = ++refreshSequence.current;
    const thread = id === currentThread.current;
    try {
      const result = await api(`/${thread ? "threads" : "conversations"}/${encodeURIComponent(id)}`);
      if (mounted.current && sequence === refreshSequence.current) {
        applyConversation(result, !currentThread.current);
        if (result?.threadId && !thread) {
          const full = await api(`/threads/${result.threadId}`);
          if (mounted.current && sequence === refreshSequence.current) applyConversation(full);
        }
      }
      return result;
    } catch (err) {
      if (mounted.current && sequence === refreshSequence.current) { setConversationError(err.message || "请求失败，请重试"); setLoadingConversation(false); }
      throw err;
    }
  }
  async function restore(reference, search = "") {
    const sequence = ++routeSequence.current;
    ++refreshSequence.current;
    stopReading(); setMenuOpen(false); setNotesOpen(false); setMobileNav(false); setCollectionMessage(null);
    stickToBottom.current = true; setNewMessages(false); pendingPresetRef.current = null; setPendingPreset(null);
    setLoadingConversation(true); setConversationError(""); setError(""); setEditing(false);
    try {
      if (reference.startsWith("agent:")) {
        const id = reference.slice(6);
        const result = await api(`/agents/${encodeURIComponent(id)}/open`, "POST");
        if (!mounted.current || sequence !== routeSequence.current) return;
        const saved = result.agent; currentAgent.current = id; setSelectedAgent(saved);
        setConfig(fromSaved(saved)); setDirty(false);
        const fresh = new URLSearchParams(search).has("new");
        setRecentConversation(result.conversation || null);
        applyConversation(fresh ? null : result.conversation);
        currentAgent.current = id;
        if (fresh || !result.conversation) {
          const entry = chatDraft.activate(`new:${id}`, "voice", { creationId: new URLSearchParams(search).get("new") || undefined, legacyKey: id });
          threadRequest.current = entry.creationId; turnRequest.current = entry.request || null;
        } else { restoreText(currentThread.current || id, result.conversation?.channel); threadRequest.current = crypto.randomUUID(); }
      } else {
        const thread = reference.startsWith("thread:"), id = thread ? reference.slice(7) : reference;
        let result = await api(`/${thread ? "threads" : "conversations"}/${encodeURIComponent(id)}${thread ? "/open" : ""}`, ...(thread ? ["POST"] : []));
        if (result?.threadId && !thread) result = await api(`/threads/${result.threadId}/open`, "POST");
        if (!mounted.current || sequence !== routeSequence.current) return;
        applyConversation(result); restoreText(result.threadId || id, result.channel);
      }
    } catch (e) {
      if (mounted.current && sequence === routeSequence.current) { setConversation(null); setConversationError(e.message); setLoadingConversation(false); setView("chat"); }
    }
  }
  useEffect(() => {
    mounted.current = true;
    api("/agents").then((items) => {
      if (!mounted.current) return;
      agentsRef.current = items; setAgents(items);
      const presetKey = new URLSearchParams(routeSearch).get("preset");
      if (presetKey && items.some((item) => item.presetKey === presetKey)) { restorePreset(presetKey); return; }
      if (!sessionId && items.length && !rootRestored.current) {
        rootRestored.current = true; void restore(`agent:${items[0].id}`, routeSearch);
      }
    }).catch((e) => { if (mounted.current) setError(e.message); });
    return () => { mounted.current = false; generation.current?.abort(); preview.current?.pause(); stopReading(); void client.current?.stop(); onActiveChange?.(false); };
  }, []);
  useEffect(() => {
    const route = workspaceRoute(sessionId, routeSearch); setPanel(route.panel); setAssetTab(route.tab);
    if (localNavigation.current) {
      const local = new URL(localNavigation.current, window.location.origin), params = new URLSearchParams(routeSearch);
      const reference = local.pathname.includes("/agents/") ? `agent:${local.pathname.split("/agents/")[1]}` : local.pathname.includes("/threads/") ? `thread:${local.pathname.split("/threads/")[1]}` : null;
      if ((sessionId || null) === reference && params.get("preset") === local.searchParams.get("preset") && params.get("new") === local.searchParams.get("new") && params.get("draft") === local.searchParams.get("draft")) { localNavigation.current = null; return; }
      localNavigation.current = null;
    }
    if (sessionId) { rootRestored.current = true; void restore(sessionId, routeSearch); }
    else if (new URLSearchParams(routeSearch).has("preset")) restorePreset(new URLSearchParams(routeSearch).get("preset"));
    else if (new URLSearchParams(routeSearch).get("draft") === "custom") {
      rootRestored.current = true; const entry = chatDraft.activate("custom:new");
      if (entry.context?.config) setConfig(entry.context.config); threadRequest.current = entry.creationId; turnRequest.current = entry.request || null; setView("chat");
    }
  }, [sessionId, routeSearch]);
  useEffect(() => { try { sessionStorage.setItem(`unispeaking.agent-draft.${userId || "local"}`, JSON.stringify({ config, dirty })); } catch {} }, [config, dirty, userId]);
  useEffect(() => { unsavedRef.current = unsaved; try { sessionStorage.setItem(pendingKey, JSON.stringify(unsaved)); } catch {} }, [unsaved, pendingKey]);
  useEffect(() => {
    if (stickToBottom.current) bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else if ((conversation?.messages?.length || 0) > previousMessageCount.current) setNewMessages(true);
    previousMessageCount.current = conversation?.messages?.length || 0;
  }, [conversation?.messages?.length, busy, reading.fontSize]);
  useEffect(() => {
    const update = () => setWideNotes((mainArea.current?.getBoundingClientRect().width || 0) >= 900);
    update(); const observer = typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (observer && mainArea.current) observer.observe(mainArea.current);
    window.addEventListener("resize", update); return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!panel) return;
    const trigger = document.activeElement; panelElement.current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [panel]);
  useEffect(() => {
    const warn = (event) => { if (active.current || dirty || unsavedRef.current.length || (chatDraft.storageError && text.trim())) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, text, chatDraft.storageError]);
  function updatePendingTranscripts(transform) {
    unsavedRef.current = transform(unsavedRef.current); setUnsaved(unsavedRef.current);
  }
  async function retryTranscripts() {
    await run("retrying", async () => {
      for (const item of unsavedRef.current) {
        await api(`/conversations/${item.sessionId}/transcripts`, "POST", { eventId: item.itemId, owner: item.owner, text: item.text });
        updatePendingTranscripts((items) => items.filter((x) => x.itemId !== item.itemId || x.sessionId !== item.sessionId));
      }
      await refresh(); flash("消息已保存");
    });
  }
  function stopReading() {
    readingAudio.current?.pause(); readingAudio.current = null;
    if (readingUrl.current) URL.revokeObjectURL(readingUrl.current);
    readingUrl.current = null; if (mounted.current) setReadingKey(null);
  }
  async function readAudio(key, blob) {
    if (active.current) throw new Error("请先结束语音，再朗读这句");
    if (readingAudio.current && readingAudio.current.datasetKey === key) { stopReading(); return; }
    stopReading(); const url = URL.createObjectURL(blob); readingUrl.current = url;
    const player = new Audio(url); player.datasetKey = key; readingAudio.current = player;
    player.onended = stopReading; player.onerror = () => { stopReading(); setError("朗读播放失败，请重试"); };
    try { await player.play(); if (mounted.current && readingAudio.current === player) setReadingKey(key); } catch (e) { stopReading(); throw e; }
  }
  async function persistPendingTranscripts() {
    for (const item of [...unsavedRef.current]) {
      await api(`/conversations/${item.sessionId}/transcripts`, "POST", { eventId: item.itemId, owner: item.owner, text: item.text });
      unsavedRef.current = unsavedRef.current.filter((x) => x.itemId !== item.itemId || x.sessionId !== item.sessionId);
      setUnsaved(unsavedRef.current);
    }
  }
  async function endVoice() {
    if (client.current) { await client.current.stop(); client.current = null; }
    else if (currentId.current) await api(`/conversations/${currentId.current}/end`, "POST");
    setActive(false); setMuted(false);
    let saveError; try { await persistPendingTranscripts(); } catch (e) { saveError = e; }
    notifyCompletion(await refresh());
    if (saveError) throw new Error("语音已结束，但还有消息未保存，请重试保存后再切换。");
  }
  function prepareLeave(action, discard) {
    if (unsavedRef.current.length) { setError("还有消息未保存，请先重试保存。"); return false; }
    if (discard && dirty && !window.confirm("当前 Agent 有未保存的修改，仍要切换吗？")) return false;
    rememberText(); stopReading(); setSuggestions(null); setSelection(null); setMenuOpen(false); setMobileNav(false); setError("");
    action(); return true;
  }
  async function leave(action, discard = false) {
    if (pending.current) return;
    if (active.current) { setTransition({ title: "结束语音并离开？", description: "这段聊天会保留。结束语音并保存消息后，再打开目标页面。", label: "结束语音并继续", action, discard }); return; }
    return prepareLeave(action, discard);
  }
  async function confirmTransition() {
    if (!transition) return;
    await run("ending", async () => {
      if (active.current || client.current) await endVoice();
      if (prepareLeave(transition.action, transition.discard)) setTransition(null);
    });
  }
  function switchMode(next, after) {
    if (pending.current) return;
    const apply = () => { setMode(next); after?.(); };
    if (next === "text" && active.current) {
      setTransition({ title: "结束语音并切换文字？", description: "原来的聊天记录会保留，继续在同一段对话中打字。", label: "结束语音并切换", action: apply, discard: false });
    } else apply();
  }
  function useHint(value) {
    if (text.length + value.length + 1 > 4000) { setError("输入内容已接近长度限制，请先整理当前草稿。"); return; }
    switchMode("text", () => setText((old) => old ? `${old}\n${value}` : value));
  }
  useEffect(() => {
    if (!live) return; const started = Date.now(); setCallSeconds(0);
    const timer = setInterval(() => setCallSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [live]);
  useEffect(() => {
    if (!transition && !discover && !mobileNav) return;
    const trigger = document.activeElement; (transition ? transitionElement : discover ? discoverElement : navigationElement).current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [transition, discover, mobileNav]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (!menuElement.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);
  function modalKeys(e, ref, close) {
    if (e.key === "Escape" && !busy) { e.stopPropagation(); close(); }
    if (e.key === "Tab") {
      const nodes = [...ref.current.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter((el) => el.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  function choose(next) {
    setDiscover(false);
    if (next.presetKey && !next.id) {
      const existing = agentsRef.current.find((item) => item.presetKey === next.presetKey);
      if (existing) { choose(fromSaved(existing)); return; }
      void leave(() => { restorePreset(next.presetKey); navigateKnown(`/conversation?preset=${next.presetKey}`); }, true); return;
    }
    if (next.id && currentAgent.current === next.id && view === "chat") return;
    void leave(() => {
      generation.current?.abort(); revision.current += 1; setGenerated(false); setOpening(""); setEditing(false);
      if (next.id) { onNavigate(`/conversation/agents/${next.id}`); void restore(`agent:${next.id}`); }
      else {
        currentAgent.current = null; currentThread.current = null; currentId.current = null;
        setSelectedAgent(null); setConfig({ ...next }); setDirty(false); setView("editor"); setPanel(null); setConversation(null); pendingPresetRef.current = null; setPendingPreset(null);
        rootRestored.current = true; if (sessionId) onNavigate("/conversation");
      }
    }, true);
  }
  function openNewDraft(saved = selectedAgent) {
    currentThread.current = null; currentId.current = null; setConversation(null); setConversationError(""); setLoadingConversation(false);
    const key = saved ? `new:${saved.id}` : pendingPresetRef.current ? `preset:${pendingPresetRef.current}` : "custom:new";
    const entry = chatDraft.activate(key); threadRequest.current = entry.creationId; turnRequest.current = entry.request || null;
    setView("chat"); setHistoryOpen(false); setMenuOpen(false); stickToBottom.current = true; setNewMessages(false);
    if (saved) { setSelectedAgent(saved); currentAgent.current = saved.id; setConfig(fromSaved(saved)); setDirty(false); navigateKnown(`/conversation/agents/${saved.id}?new=${entry.creationId}`); }
  }
  function newConversation(saved = selectedAgent) { void leave(() => openNewDraft(saved)); }
  function editSettings(focusVoice = false) {
    if (busy || conversation?.legacy) return;
    focusVoiceSettings.current = focusVoice === true;
    const latest = agentsRef.current.find((a) => a.id === currentAgent.current) || selectedAgent;
    setConfig(latest ? fromSaved(latest) : { ...conversation?.config || config }); setDirty(false); setGenerated(false); setOpening(""); setMenuOpen(false); setEditing(true);
  }
  function closeSettings() {
    if (busy || (dirty && !window.confirm("放弃未保存的 Agent 修改？"))) return;
    setEditing(false); setDirty(false); preview.current?.pause(); setVoicePreview(false);
  }
  function drawerKeys(event) {
    if (event.key === "Escape") { event.stopPropagation(); closeSettings(); }
    if (event.key === "Tab") {
      const nodes = [...settingsElement.current.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])')].filter((el) => el.offsetParent !== null);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === settingsElement.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  async function generate() {
    if (!config.purpose.trim()) { setError("先写下一小段你想聊天的目的。"); return; }
    const atRevision = revision.current; generation.current?.abort(); generation.current = new AbortController();
    await run("generating", async () => {
      const result = await api("/generate", "POST", { purpose: config.purpose.trim(), level: config.level }, generation.current.signal);
      if (revision.current !== atRevision || !mounted.current) return;
      setConfig((old) => ({ ...old, name: old.id ? old.name : result.name, prompt: result.prompt }));
      setOpening(result.opening); setGenerated(true); setDirty(true); flash("提示词已生成");
    });
  }
  async function save(copy = false, openNew = false) {
    if (openNew && active.current) { setTransition({ title: "结束语音并使用新设置？", description: "保存当前语音后，打开使用新设置的新对话。", label: "结束语音并继续", action: () => { setTimeout(() => void save(false, true), 0); }, discard: false }); return; }
    if (editing && pendingPresetRef.current && !copy) {
      chatDraft.patch({ context: { config: cleanConfig(config), presetKey: pendingPresetRef.current } });
      setDirty(false); setEditing(false); flash("设置已更新"); return;
    }
    if (copy && active.current) { setTransition({ title: "结束语音并复制伙伴？", description: "保存当前聊天后，打开使用相同设置的伙伴副本。", label: "结束语音并复制", action: () => { setTimeout(() => void save(true), 0); }, discard: false }); return; }
    if (!config.prompt.trim() || !config.purpose.trim()) { setError("请先填写目的和提示词。"); return; }
    await run("saving", async () => {
      const input = copy ? { ...config, id: null, version: null, name: `${config.name.slice(0,58)} 副本` } : config;
      const result = await api(config.id && !copy ? `/agents/${config.id}` : "/agents", config.id && !copy ? "PUT" : "POST", input);
      const items = [result, ...agentsRef.current.filter((item) => item.id !== result.id)]; agentsRef.current = items; setAgents(items);
      setConfig(fromSaved(result)); setDirty(false); setSelectedAgent(result); currentAgent.current = result.id;
      if (editing && !copy) { setEditing(false); if (openNew) openNewDraft(result); else flash("已保存，下一段新对话生效"); }
      else { currentThread.current = null; currentId.current = null; setConversation(null); setView("chat"); setEditing(false); setLoadingConversation(false); openNewDraft(result); flash(copy ? "副本已保存" : "伙伴已保存"); }
    });
  }
  async function start(channel) {
    let snapshot = conversation?.config || (selectedAgent ? fromSaved(selectedAgent) : config);
    if (!snapshot.prompt?.trim() || !snapshot.purpose?.trim()) { setError("请先生成或填写对话提示词。"); return; }
    if (channel === "text") { const entry = chatDraft.activate(pendingPresetRef.current ? `preset:${pendingPresetRef.current}` : "custom:new", "text"); threadRequest.current = entry.creationId; setMode("text"); chatDraft.patch({ context: { config: cleanConfig(snapshot) } }); setView("chat"); setConversation(null); currentThread.current = null; currentId.current = null; setLoadingConversation(false); setConfig(snapshot); if (!pendingPresetRef.current) navigateKnown("/conversation?draft=custom"); return; }
    if (view === "editor" && !pendingPresetRef.current) {
      const entry = chatDraft.activate("custom:new", "voice"); threadRequest.current = entry.creationId;
      chatDraft.patch({ context: { config: cleanConfig(snapshot) } });
    }
    await run("starting", async () => {
      snapshot = await ensurePreset(snapshot);
      stopReading(); preview.current?.pause(); setMode("voice"); setCallPhase("正在连接…");
      turnRequest.current = null; setSuggestions(null);
      client.current = createRealtimeClient({
        apiBase: import.meta.env.VITE_BACKEND_URL || "", sceneType: "free-chat",
        onRemoteStream: (stream) => { if (audio.current) { audio.current.srcObject = stream; void audio.current.play().catch(() => setError("点击播放按钮以听到对方声音。")); } },
        onEvent: (event) => {
          if (!mounted.current) return;
          if (event.type === "local.connected") {
            currentId.current = event.sessionId; setView("chat"); setActive(true); setCallPhase("语音已连接");
            void refresh(event.sessionId).then((result) => { if (result?.threadId) onNavigate(`/conversation/threads/${result.threadId}`); }).catch((e) => setError(e.message));
          }
          if (event.type === "input_audio_buffer.speech_started") setCallPhase("正在听你说");
          if (["response.audio.delta", "response.audio_transcript.delta"].includes(event.type)) setCallPhase("对方正在说话");
          if (["response.audio.done", "response.done"].includes(event.type)) setCallPhase("轮到你说了");
          if (event.type === "local.transcript.final") updatePendingTranscripts((items) => items.some((x) => x.itemId === event.itemId && x.sessionId === event.sessionId) ? items : [...items, { itemId: event.itemId, sessionId: event.sessionId, owner: event.owner, text: event.text, saving: true }]);
          if (event.type === "local.transcript.failed") updatePendingTranscripts((items) => items.map((x) => x.itemId === event.itemId && x.sessionId === event.sessionId ? { ...x, saving: false } : x));
          if (event.type === "local.transcript.saved") { updatePendingTranscripts((items) => items.filter((x) => x.itemId !== event.itemId || x.sessionId !== event.sessionId)); void refresh().catch((e) => setError(e.message)); }
          if (["local.backend_warning", "local.error", "local.mic_error", "local.provider_warning", "error"].includes(event.type)) setError(event.message || event.error?.message || "语音连接异常，请重试");
          if (event.type === "local.ended") { setActive(false); void refresh().then(notifyCompletion).catch((e) => setError(e.message)); }
        },
      });
      try { await client.current.start({ voice: snapshot.voice, speechSpeed: snapshot.speed < 0.7 ? "SLOWER" : snapshot.speed < 1 ? "MODERATE" : snapshot.speed > 1.15 ? "FASTER" : "NATURAL", agentConfig: snapshot, conversationId: currentThread.current }); }
      catch (e) { await client.current?.stop(); client.current = null; setActive(false); throw e; }
    });
  }
  async function send() {
    const content = text.trim(); if (!content || conversation?.legacy || live) return;
    if (!turnRequest.current || turnRequest.current.text !== content) turnRequest.current = { requestId: crypto.randomUUID(), text: content };
    chatDraft.patch({ request: turnRequest.current });
    await run("sending", async () => {
      const snapshot = await ensurePreset(conversation?.config || (selectedAgent ? fromSaved(selectedAgent) : config));
      if (!currentThread.current && !conversation) {
        const result = await api("/threads", "POST", { config: cleanConfig(snapshot), requestId: threadRequest.current });
        applyConversation(result, true);
      }
      const id = currentThread.current;
      const result = await api(id ? `/threads/${id}/messages` : `/conversations/${conversation.sessionId}/messages`, "POST", turnRequest.current);
      applyConversation(result); chatDraft.clearSent(text); turnRequest.current = null; stickToBottom.current = true;
      if (result.threadId) navigateKnown(`/conversation/threads/${result.threadId}`);
    });
  }
  async function end() {
    await run("ending", async () => {
      if (live) await endVoice();
      else { const result = await api(currentThread.current ? `/threads/${currentThread.current}/end` : `/conversations/${conversation.sessionId}/end`, "POST"); applyConversation(result); notifyCompletion(result); }
      flash("本次练习已结束，聊天记录已保存");
    });
  }
  function openHistory(id, thread = false) {
    void leave(() => {
      setHistoryOpen(false); setPanel(null); setSelection(null);
      onNavigate(thread ? `/conversation/threads/${id}` : `/conversation/${id}`);
      void restore(thread ? `thread:${id}` : id);
    });
  }
  async function historyRemoved(record) {
    const current = record.threadId ? record.threadId === currentThread.current : record.sessionId === currentId.current;
    if (!current) return;
    ++routeSequence.current; ++refreshSequence.current;
    chatDraft.remove(`thread:${currentThread.current || currentId.current}`);
    currentThread.current = null; currentId.current = null; turnRequest.current = null; threadRequest.current = crypto.randomUUID();
    setConversation(null); setText(""); setConversationError(""); setSelection(null); setSuggestions(null); setHistoryOpen(false);
    const fallbackAgent = currentAgent.current || agentsRef.current[0]?.id;
    if (fallbackAgent) {
      const id = fallbackAgent;
      onNavigate(`/conversation/agents/${id}`); await restore(`agent:${id}`);
    } else { setLoadingConversation(false); setView("editor"); onNavigate("/conversation"); }
    flash("已移入回收站，Agent 设置和收藏已保留");
  }
  function openWorkspace(target = null, tab = "all") { setPanel(target); setAssetTab(tab); }
  function useScene(scene) {
    void leave(() => {
      revision.current += 1; currentAgent.current = null; currentThread.current = null; currentId.current = null; setSelectedAgent(null);
      setConfig((old) => ({ ...old, id: null, version: null, purpose: `我想练习${scene.sceneInput || scene.title}。英语 ${old.level}，请围绕这个情境自然交流。`, prompt: "" }));
      setDirty(true); setOpening(""); setGenerated(false); setView("editor"); setConversation(null); openWorkspace(); setInspiration(false);
      rootRestored.current = true; if (sessionId) onNavigate("/conversation"); flash("场景已带入");
    });
  }
  async function collect(item, messageNo, sourceId = conversation.sessionId) {
    return await run("collecting", async () => {
      const items = await api(`/conversations/${sourceId}/learning`, "POST", { ...item, messageNo });
      if (currentThread.current) await refresh(); else setConversation((old) => ({ ...old, learning: items }));
      setSelection(null); flash("已收藏"); return true;
    });
  }
  function selectedText(message, element) {
    const selected = window.getSelection();
    const value = selected?.toString().trim();
    if (value && element.contains(selected.anchorNode) && message.content.includes(value)) setSelection({ text: value, messageNo: message.messageNo, segmentId: message.segmentId || conversation.sessionId });
  }
  function playVoice() {
    if (voicePreview) { preview.current?.pause(); setVoicePreview(false); return; }
    preview.current?.pause(); preview.current = new Audio(teachers.find((t) => t.voiceId === config.voice)?.previewAudio);
    preview.current.onended = () => setVoicePreview(false);
    void preview.current.play().then(() => setVoicePreview(true)).catch(() => setError("音色试听暂时不可用，请重试。"));
  }
  const activeConfig = view === "chat" ? conversation?.config || (selectedAgent ? selectedAgent.config : config) : config;
  const readonly = Boolean(conversation?.legacy);
  const collected = (item, no, sourceId) => conversation?.learning?.some((x) => (!sourceId || x.sessionId === sourceId) && x.messageNo === no && x.text === item.text && x.kind === item.kind);
  const settingsChanged = Boolean(conversation && selectedAgent && Number(selectedAgent.version) > Number(conversation.config?.version || 0));
  const notesModal = notesOpen && !wideNotes;
  const savingDisabled = Boolean(busy) || !config.prompt.trim() || !config.purpose.trim() || !config.name.trim();

  const editor = (<div className="aw-editor-layout">
        <section className="aw-editor">
          {!editing && <div className="aw-breadcrumb"><span>我的 Agent <span>/</span> {config.name}</span><button className="aw-outline aw-small" onClick={() => save(true)} disabled={savingDisabled}><Copy />复制</button></div>}
          <header className="aw-editor-title"><span className="aw-symbol"><Icon name={config.name} /></span><div><div className="aw-edit-name"><input aria-label="Agent 名称" value={config.name} maxLength={64} onChange={(e) => update("name", e.target.value)} disabled={Boolean(busy)} /><PencilSimple /></div></div></header>
          <div className="aw-purpose"><label htmlFor="agent-purpose">这次想怎么聊</label><textarea id="agent-purpose" value={config.purpose} onChange={(e) => update("purpose", e.target.value)} maxLength={2000} disabled={busy === "generating"} placeholder="例如：想练去伦敦点餐，英语 B1。像朋友一样聊，别频繁打断我。" /><div className="aw-purpose-actions"><button className="aw-link" aria-expanded={inspiration} onClick={() => setInspiration(!inspiration)}><PencilSimple />从场景找灵感</button><button className="aw-primary" onClick={generate} disabled={Boolean(busy) || !config.purpose.trim()}>{busy === "generating" ? <Spinner /> : <Sparkle />} {busy === "generating" ? "生成中…" : "生成详细提示词"}</button></div>
            {inspiration && <SceneSuggestions onUse={useScene} />}
          </div>
          <div className="aw-settings-grid">
            <div className="aw-setting"><label htmlFor="agent-voice"><SpeakerHigh />声音</label><div className="aw-voice-control"><select id="agent-voice" value={config.voice} disabled={Boolean(busy)} onChange={(e) => { preview.current?.pause(); setVoicePreview(false); update("voice", e.target.value); }}>{teachers.map((t) => <option key={t.voiceId} value={t.voiceId}>{t.name} · {t.accent.replace("口音", "")}</option>)}</select><button aria-label={voicePreview ? "停止试听" : "试听音色"} className={voicePreview ? "is-playing" : ""} onClick={playVoice}>{voicePreview ? <Stop weight="fill" /> : <Play weight="fill" />}</button></div></div>
            <div className="aw-setting"><label htmlFor="agent-correction"><PencilSimple />纠错</label><select id="agent-correction" value={config.correction} disabled={Boolean(busy)} onChange={(e) => update("correction", e.target.value)}>{Object.entries(corrections).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
            <div className="aw-setting"><label htmlFor="agent-level"><SlidersHorizontal />对话难度</label><select id="agent-level" value={config.level} disabled={Boolean(busy)} onChange={(e) => update("level", e.target.value)}>{Object.entries(levels).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select></div>
            
          </div>
          {<div className="aw-speed"><label htmlFor="agent-speed">说话速度 <strong>{config.speed < 0.7 ? "慢速" : config.speed < 1 ? "舒缓" : config.speed > 1.15 ? "轻快" : "自然"}</strong></label><select id="agent-speed" value={config.speed} onChange={(e) => update("speed", Number(e.target.value))}><option value="0.6">慢速 · 清晰停顿</option><option value="0.9">舒缓 · 从容表达</option><option value="1">自然 · 日常节奏</option><option value="1.3">轻快 · 流畅交流</option></select></div>}
          <details className="aw-advanced"><summary>高级设置 · 完整对话提示词</summary>
          <div className={`aw-prompt ${busy === "generating" ? "is-generating" : ""}`}><div className="aw-section-heading"><label htmlFor="agent-prompt">对话提示词</label><span>{dirty ? "有未保存的修改" : config.id ? "已保存" : "示例 · 可编辑"}{generated && <Check />}</span></div><textarea id="agent-prompt" key={generated ? "generated" : "draft"} value={config.prompt} onChange={(e) => update("prompt", e.target.value)} maxLength={12000} disabled={busy === "generating"} placeholder="输入角色、风格和话题…" /><div className="aw-prompt-foot"><button className="aw-link" onClick={generate} disabled={Boolean(busy) || !config.purpose.trim()}><ArrowClockwise />重新生成</button></div></div>
          </details>
          {editing && <AgentReadingSettings fontSize={reading.fontSize} onChange={reading.setFontSize} error={reading.error} />}
          {!editing && <footer className="aw-editor-footer"><div><button className="aw-outline" disabled={savingDisabled} onClick={() => save()}>{busy === "saving" ? <Spinner /> : null}{config.id ? "保存修改" : "保存为 Agent"}</button><button className="aw-primary aw-start" disabled={savingDisabled} onClick={() => start("voice")}>{busy === "starting" ? <Spinner /> : <Microphone />}用这段提示词开聊<ArrowRight /></button></div></footer>}
        </section>
        <aside className="aw-preview"><header><h2>聊天预览</h2></header><div className="aw-preview-content">{opening ? <div className="aw-example"><span className="aw-agent-symbol"><Suitcase /></span><div><small>{config.name} · 开场示例</small><p>{opening}</p></div></div> : <div className="aw-preview-empty"><span className="aw-orbit"><ChatCircleDots /></span><h3>暂无开场示例</h3></div>}</div><div className="aw-preview-bottom"><button className="aw-training-hint" onClick={() => openWorkspace("assets")}><BookOpenText /><span>词句训练</span><ArrowRight /></button><button className="aw-text-start" disabled={savingDisabled} onClick={() => start("text")}><ChatCircleDots /><span>想先打字？开始文字聊天</span><ArrowRight /></button></div></aside>
      </div>);

  return <div className="agent-workspace aw-conversation-content freechat-v2" style={{ "--aw-chat-font-size": `${reading.fontSize}px` }}>
    <audio ref={audio} autoPlay />
    {mobileNav && <button className="aw-mobile-scrim" aria-label="关闭导航遮罩" tabIndex={-1} onClick={() => setMobileNav(false)} />}
    <aside inert={notesModal ? true : undefined} ref={navigationElement} tabIndex={mobileNav ? -1 : undefined} role={mobileNav ? "dialog" : undefined} aria-modal={mobileNav ? "true" : undefined} className={`aw-agent-menu ${mobileNav ? "is-mobile-open" : ""}`} aria-label="自由对话 Agent 列表" onKeyDown={(e) => { if (mobileNav) modalKeys(e, navigationElement, () => setMobileNav(false)); }}>
      <div className="aw-new-brand"><img src="/brand/unispeaking-mark-user.jpg" alt="UniSpeaking" /><strong>unispeaking</strong><button className="aw-icon-button aw-nav-close" aria-label="关闭伙伴列表" onClick={() => setMobileNav(false)}><X /></button></div>
      {onPageNavigate && <nav className="aw-global-navigation" aria-label="自由对话导航"><button className="is-selected" onClick={() => setMobileNav(false)} aria-label="自由对话"><Waveform />自由对话</button><button onClick={() => void leave(() => onPageNavigate("assets"), true)} aria-label="学习资产"><BookOpenText />学习资产</button><button onClick={() => void leave(() => onPageNavigate("scenes"), true)} aria-label="场景广场"><SquaresFour />场景广场</button></nav>}
      <div className="aw-nav-heading"><span>我的对话伙伴</span><button title="新建对话伙伴" aria-label="新建 Agent" onClick={() => choose(blankAgent())} disabled={Boolean(busy)}><Plus /></button></div>
      <nav aria-label="Agent 选择" className="aw-agents">{agents.map((agent, index) => <div className="aw-agent-entry" key={agent.id}><button aria-label={`${agent.config.name} · ${agent.config.level}`} className={(currentAgent.current || config.id) === agent.id ? "is-selected" : ""} onClick={() => choose(fromSaved(agent))} disabled={Boolean(busy)}><span className={`aw-agent-symbol aw-avatar-${index % 3}`}><Icon name={agent.config.name} index={index} /></span><span><strong>{agent.config.name}</strong><small>{agent.config.purpose}</small></span></button>{chatDraft.read(`new:${agent.id}`)?.text && <button className="aw-agent-draft-link" aria-label={`继续${agent.config.name}的草稿`} onClick={() => void leave(() => openNewDraft(agent))}>继续草稿</button>}</div>)}{!agents.length && <p className="aw-nav-empty">暂无对话伙伴</p>}</nav>
      <button className="aw-discover-link" onClick={() => setDiscover(true)} disabled={Boolean(busy)}><Plus />发现更多对话伙伴</button>
      <div className="aw-agent-tools"><button className="aw-agent-history" aria-label="词句训练" onClick={() => openWorkspace("assets", "all")}><BookOpenText /><span>我的词句训练</span></button><button className="aw-agent-history" aria-label="对话记录" onClick={() => { setHistoryAll(true); setHistoryOpen(true); setMobileNav(false); }}><ClockCounterClockwise /><span>全部对话记录</span></button>{onPageNavigate && <button className="aw-agent-history aw-profile-link" aria-label="个人中心" onClick={() => void leave(() => onPageNavigate("profile"), true)}><UserCircle /><span>我的空间</span><ArrowRight /></button>}</div>
    </aside>
    <main className="aw-main" ref={mainArea}>
      {error && !editing && <div className="aw-error" role="alert"><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X /></button></div>}
      {notice && <div className="aw-toast" role="status"><Check />{notice}</div>}
      {view === "editor" && <><button className="aw-editor-mobile-nav aw-link" aria-label="选择对话伙伴" onClick={() => setMobileNav(true)}><ArrowLeft />对话伙伴与导航</button>{editor}</>}
      {view === "chat" && <div className={`aw-chat-layout ${notesOpen && wideNotes ? "has-notes" : ""}`}><section className="aw-chat" inert={notesModal ? true : undefined} aria-hidden={notesModal || undefined}>
        <header className="aw-chat-header aw-thread-header"><button className="aw-icon-button aw-mobile-partners" aria-label="选择对话伙伴" onClick={() => setMobileNav(true)}><ArrowLeft /></button><span className="aw-agent-symbol"><Icon name={activeConfig.name} /></span>
          <div className="aw-thread-heading"><h2>{activeConfig.name}{!conversation && !loadingConversation && <span className="aw-new-state">新对话</span>}</h2><p className="aw-thread-context"><span className="aw-context-purpose" title={activeConfig.purpose || activeConfig.name}>{conversationContext(activeConfig)}</span>{activeConfig.level && <span className="aw-context-level" title={`${activeConfig.level} · ${levels[activeConfig.level] || "日常交流"}`}>{activeConfig.level}</span>}</p></div>
          <div className="aw-thread-actions"><button className="aw-header-new" aria-label="新对话" disabled={Boolean(busy) || readonly} onClick={() => newConversation()}><Plus /><span>新对话</span></button><button className="aw-icon-button" title="历史记录" aria-label="历史记录" onClick={() => { setHistoryAll(false); setHistoryOpen(true); }}><ClockCounterClockwise /></button><button className="aw-notes-toggle" title="本次随手记" aria-label="本次随手记" aria-expanded={notesOpen} onClick={() => setNotesOpen(!notesOpen)}><BookOpenText /><span>随手记 {conversation?.learning?.length || 0}</span></button><div className="aw-more-menu" ref={menuElement}><button className="aw-icon-button" title="更多操作" aria-label="更多操作" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><DotsThree /></button>{menuOpen && <div className="aw-menu-options"><button disabled={Boolean(busy) || readonly} onClick={editSettings}><SlidersHorizontal />修改设置</button></div>}</div></div>
        </header>
        {settingsChanged && <div className="aw-settings-status"><span>新设置用于新对话</span><button className="aw-link" disabled={Boolean(busy)} onClick={() => newConversation()}>新开一段</button></div>}
        <div className="aw-messages" ref={messageArea} aria-live="polite" onScroll={(e) => { const box = e.currentTarget; stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80; if (stickToBottom.current) setNewMessages(false); }}>
          {!loadingConversation && !conversationError && !live && conversation?.messages?.some((m) => m.owner === 1) && <div className="aw-resume-context"><ClockCounterClockwise /><span>接着聊 · {conversation.messages.filter((m) => m.owner === 1).at(-1).content.slice(0,100)}</span></div>}
          {loadingConversation ? <div className="aw-empty"><Spinner /><p>正在读取对话…</p></div> : conversationError ? <div className="aw-empty"><h2>无法读取这段对话</h2><p>{conversationError}</p><button className="aw-outline" onClick={() => void restore(sessionId || `agent:${currentAgent.current}`, routeSearch)}>重新读取对话</button><button className="aw-link" onClick={() => { setConversationError(""); setLoadingConversation(false); newConversation(); }}>开始新对话</button></div> : <>
            {!conversation?.messages?.length && <div className="aw-chat-welcome"><span className="aw-agent-symbol"><Icon name={activeConfig.name} /></span><h2>{activeConfig.name}</h2><p>{activeConfig.purpose}</p>{recentConversation?.threadId && <button className="aw-outline" onClick={() => openHistory(recentConversation.threadId, true)}>继续上一段对话</button>}</div>}
            {conversation?.messages?.map((message, index) => <article className={`aw-message ${message.owner === 1 ? "from-user" : "from-agent"} ${continuesMessage(message, conversation.messages[index - 1], conversation.sessionId) ? "is-continuation" : ""}`} key={`${message.segmentId || conversation.sessionId}:${message.messageNo}`}><small>{message.owner === 1 ? "你" : activeConfig.name}{message.createdAt && <time>{new Date(message.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>}</small><div className="aw-message-text" onMouseUp={(e) => selectedText(message, e.currentTarget)} onTouchEnd={(e) => selectedText(message, e.currentTarget)}>{message.content}</div>{!readonly && <AgentMessageTools message={message} sessionId={message.segmentId || conversation.sessionId} live={live} collecting={Boolean(busy)} readingKey={readingKey} onRead={readAudio} collectedCount={(conversation.learning || []).filter((item) => item.sessionId === (message.segmentId || conversation.sessionId) && item.messageNo === message.messageNo).length} onCollect={() => { setError(""); setCollectionMessage(message); }} />}</article>)}
            {unsaved.filter((item) => (conversation?.segments || [{ sessionId: currentId.current }]).some((part) => part.sessionId === item.sessionId)).map((item) => <article className={`aw-message ${item.owner === 1 ? "from-user" : "from-agent"} aw-pending-message`} key={item.itemId}><small>{item.owner === 1 ? "你" : activeConfig.name} · {item.saving ? "保存中" : "未保存"}</small><div className="aw-message-text">{item.text}</div></article>)}
            {busy === "sending" && <div className="aw-thinking"><span /><span /><span /><small>{activeConfig.name} 正在回复</small></div>}
          </>}
          <div ref={bottom} />
        </div>
        {newMessages && <button className="aw-new-messages" onClick={() => { stickToBottom.current = true; setNewMessages(false); bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }}>有新消息 ↓</button>}
        {unsaved.length > 0 && <div className="aw-save-status" role="status"><span>{unsaved.some((item) => !item.saving) ? "有消息尚未保存" : "正在保存语音消息…"}</span><button className="aw-link" disabled={Boolean(busy)} onClick={retryTranscripts}>重试保存</button></div>}
        {chatDraft.storageError && <div className="aw-save-status" role="status">草稿暂未保存在本机，请保留此页面。</div>}
        {chatDraft.alternate && <div className="aw-save-status" role="status"><span>其他窗口有一份不同的草稿</span><button onClick={chatDraft.recoverAlternate}>恢复另一份</button><button onClick={chatDraft.keepCurrent}>保留当前</button></div>}
        {selection && <div className="aw-selection"><span>“{selection.text}”</span><button disabled={Boolean(busy)} onClick={() => collect({ text: selection.text, kind: "word" }, selection.messageNo, selection.segmentId)}>存为词汇</button><button disabled={Boolean(busy)} onClick={() => collect({ text: selection.text, kind: "sentence" }, selection.messageNo, selection.segmentId)}>存为句子</button><button aria-label="取消选取" onClick={() => setSelection(null)}><X /></button></div>}
        {!readonly && !loadingConversation && !conversationError && <div className="aw-thread-composer"><div className="aw-composer-panel">
          <div className={`aw-composer-toolbar ${!live && mode === "voice" ? "is-voice-idle" : ""}`}><div className="aw-controls-left"><div className="aw-mode-tabs" aria-label="对话方式"><button className={mode === "voice" ? "is-selected" : ""} onClick={() => switchMode("voice")} disabled={Boolean(busy)}><Microphone />语音</button><button className={mode === "text" ? "is-selected" : ""} onClick={() => switchMode("text")} disabled={Boolean(busy)}><PencilSimple />文字</button></div>{!live && mode === "voice" && <button type="button" className="aw-voice-meta" aria-label="声音与语速设置" aria-haspopup="dialog" aria-expanded={editing} title="修改声音与语速（新对话生效）" disabled={Boolean(busy)} onClick={() => editSettings(true)}>{teachers.find((t) => t.voiceId === activeConfig.voice)?.name || activeConfig.voice} · {activeConfig.speed || 1}×<CaretDown /></button>}</div><div className="aw-controls-right"><AgentReplyHint threadId={currentThread.current} contextKey={`${conversation?.messages?.length || 0}:${conversation?.messages?.at(-1)?.content || ""}`} onUse={useHint} disabled={loadingConversation || !conversation?.messages?.length} />{!live && mode === "voice" && <button className="aw-primary" disabled={Boolean(busy)} onClick={() => start("voice")}>{busy === "starting" ? <Spinner /> : <Microphone />}{busy === "starting" ? "正在连接…" : conversation?.messages?.length ? "继续语音" : "开始语音"}</button>}</div></div>
          {live ? <div className="aw-voice-bar"><span className={`aw-wave ${muted ? "is-muted" : ""}`}><i /><i /><i /><i /><i /></span><div className="aw-live-copy"><strong>{muted ? "麦克风已静音" : callPhase}</strong><small>语音通话 {Math.floor(callSeconds / 60).toString().padStart(2,"0")}:{(callSeconds % 60).toString().padStart(2,"0")}</small></div><button className="aw-round-control" aria-label={muted ? "取消静音" : "静音"} onClick={() => { client.current?.setMuted(!muted); setMuted(!muted); }}>{muted ? <MicrophoneSlash /> : <Microphone />}</button><button className="aw-round-control" aria-label="播放对方声音" onClick={() => void audio.current?.play().catch((e) => setError(e.message))}><SpeakerHigh /></button><button className="aw-end-call" onClick={end} disabled={Boolean(busy)}>结束语音</button></div> : mode === "text" ? <form className="aw-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}><textarea aria-label="聊天消息" placeholder="输入消息…" value={text} maxLength={4000} disabled={Boolean(busy)} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button className="aw-send" type="submit" aria-label="发送消息" disabled={Boolean(busy) || !text.trim()}>{busy === "sending" ? <Spinner /> : <PaperPlaneTilt weight="fill" />}</button></form> : null}
          {!live && conversation?.sessionId && !["COMPLETED", "FAILED", "INTERRUPTED"].includes(conversation.status) && <div className="aw-thread-composer-foot"><button className="aw-link" disabled={Boolean(busy)} onClick={end}>结束本次练习</button></div>}
        </div></div>}
        {readonly && <p className="aw-history-note">这条旧版记录缺少 Agent 设置，原始消息已保留。你可以在左侧选择一个 Agent 开始新对话。</p>}
      </section>
<AgentNotesPanel error={error} open={notesOpen} wide={wideNotes} items={conversation?.learning || []} config={conversation?.config || activeConfig} live={live} busy={Boolean(busy)} onClose={() => setNotesOpen(false)} onEnd={end} onPractice={(item) => setExercise(item)} /></div>}

      {editing && <AgentDialog label="修改 Agent 设置" closeLabel="关闭 Agent 设置" title="修改 Agent 设置" drawer className="aw-settings-drawer" onClose={closeSettings} busy={Boolean(busy)} initialFocus={focusVoiceSettings.current ? "#agent-voice" : undefined}>
        {error && <p className="aw-inline-error" role="alert">{error}</p>}{editor}
        <footer className="aw-ux-dialog-footer"><button className="aw-outline" disabled={savingDisabled} onClick={() => save()}>{busy === "saving" ? "保存中…" : "保存修改"}</button><button className="aw-primary" disabled={savingDisabled} onClick={() => save(false, true)}>保存并新开对话</button></footer>
      </AgentDialog>}
      {collectionMessage && <AgentCollectionDialog message={collectionMessage} sourceId={collectionMessage.segmentId || conversation.sessionId} learning={conversation.learning || []} busy={Boolean(busy)} error={error} onSave={(item) => collect(item, collectionMessage.messageNo, collectionMessage.segmentId || conversation.sessionId)} onClose={() => setCollectionMessage(null)} />}

      {historyOpen && <AgentConversationHistory initialAll={historyAll} agentId={currentAgent.current} agentName={selectedAgent?.config?.name || activeConfig.name} onClose={() => setHistoryOpen(false)} onOpen={openHistory} onRemoved={historyRemoved} currentThreadId={currentThread.current} currentSessionId={currentId.current} deleteBlocked={live ? "请先结束语音，再删除当前对话" : busy ? "请等当前操作完成，再删除对话" : unsaved.length ? "请先保存未保存的语音消息" : ""} />}
      {panel && <aside ref={panelElement} tabIndex={-1} className="aw-workspace-panel" aria-label="学习资产面板" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); openWorkspace(); } }}>
        <button className="aw-panel-close" aria-label="收起工作台面板" onClick={() => openWorkspace()}><X /></button>
        <AgentLearningAssets userId={userId} onPractice={(item) => setExercise(item)} initialTab={assetTab} onTabChange={(tab) => openWorkspace("assets", tab)} onOpenConversation={openHistory} onUseScene={useScene} />
      </aside>}
    </main>
    {discover && <div className="aw-modal-backdrop" onClick={() => setDiscover(false)}><section ref={discoverElement} tabIndex={-1} className="aw-modal aw-discover-modal" role="dialog" aria-modal="true" aria-label="发现对话伙伴" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => modalKeys(e, discoverElement, () => setDiscover(false))}><button className="aw-modal-close" aria-label="关闭发现伙伴" onClick={() => setDiscover(false)}><X /></button><h2>想和谁聊聊？</h2><nav className="aw-discover-list" aria-label="Agent 模板">{presets.map((preset, index) => <button key={preset.name} onClick={() => choose(preset)}><span className={`aw-agent-symbol aw-avatar-${index}`}><Icon name={preset.name} index={index} /></span><span><strong>{preset.name}</strong><small>{preset.purpose}</small></span><ArrowRight /></button>)}</nav><button className="aw-primary" onClick={() => choose(blankAgent())}><Plus />自定义对话伙伴</button></section></div>}
    {transition && <AgentDialog label={transition.title} onClose={() => setTransition(null)} busy={Boolean(busy)} className="aw-transition-modal"><div className="aw-ux-dialog-body"><p>{transition.description}</p>{error && <p className="aw-inline-error" role="alert">{error}</p>}</div><footer className="aw-ux-dialog-footer"><button className="aw-outline" disabled={Boolean(busy)} onClick={() => setTransition(null)}>{live ? "继续语音" : "取消"}</button><button className="aw-primary" disabled={Boolean(busy)} onClick={confirmTransition}>{busy === "ending" ? <Spinner /> : null}{transition.label}</button></footer></AgentDialog>}

    {exercise && <AgentPracticeDialog key={exercise.id} item={exercise} userId={userId} live={live} onRead={readAudio} onSaved={() => flash("练习已保存")} onClose={() => { stopReading(); setExercise(null); }} />}

  </div>;
}
