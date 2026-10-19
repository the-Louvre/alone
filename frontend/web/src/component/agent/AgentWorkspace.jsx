import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Plus, Copy, Check, Sparkle, Suitcase, ChatCircleDots, BookOpenText, ClockCounterClockwise, SpeakerHigh, Play, Stop, Microphone, MicrophoneSlash, PaperPlaneTilt, X, SlidersHorizontal, CaretDown, ArrowClockwise, CircleNotch, PencilSimple } from "@phosphor-icons/react";
import { teachers } from "../../domain/content/data.js";
import { createRealtimeClient } from "../../websocket/realtimeClient.js";
import { agentRequest as api, presets, blankAgent, fromSaved, readAgentDraft } from "./agentApi.js";
import AgentLearningAssets from "./AgentLearningAssets.jsx";
import AgentConversationHistory from "./AgentConversationHistory.jsx";
import { SceneSuggestions } from "./WorkspaceCollections.jsx";
import "./agentWorkspace.css";

const corrections = { gentle: "轻柔提醒", after: "聊完后提醒", "on-request": "问到时再纠正" };
const levels = { A1: "初次开口", A2: "简单交流", B1: "日常交流", B2: "深入表达", C1: "自如讨论", C2: "精细表达" };
const Icon = ({ index = 0, ...props }) => index % 3 === 0 ? <Suitcase {...props} /> : <ChatCircleDots {...props} />;
const Spinner = () => <CircleNotch className="aw-spin" aria-hidden="true" />;
const assetTabs = [["all", "全部词句"], ["word", "词汇"], ["sentence", "句子"], ["chat", "对话记录"], ["practice", "练习记录"], ["existing", "已有场景"]];
function workspaceRoute(sessionId, search) {
  const params = new URLSearchParams(search);
  return { view: sessionId ? "chat" : "editor", panel: params.get("section") === "assets" ? "assets" : null, tab: assetTabs.some(([key]) => key === params.get("tab")) ? params.get("tab") : "all" };
}

export default function AgentWorkspace({ userId, sessionId, routeSearch = window.location.search, onNavigate, onActiveChange, onSessionEnded }) {
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [voicePreview, setVoicePreview] = useState(false);
  const [text, setText] = useState("");
  const [live, setLive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selection, setSelection] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [assetTab, setAssetTab] = useState(() => workspaceRoute(sessionId, routeSearch).tab);
  const pendingKey = `unispeaking.pending-transcripts.${userId || "local"}`;
  const [unsaved, setUnsaved] = useState(() => { try { return JSON.parse(sessionStorage.getItem(pendingKey)) || []; } catch { return []; } });
  const audio = useRef(null), preview = useRef(null), client = useRef(null);
  const currentId = useRef(null), currentThread = useRef(null), currentAgent = useRef(null);
  const mounted = useRef(true), generation = useRef(null), revision = useRef(0);
  const turnRequest = useRef(null), threadRequest = useRef(crypto.randomUUID()), attemptRequest = useRef(null);
  const bottom = useRef(null), refreshSequence = useRef(0), routeSequence = useRef(0);
  const pending = useRef(false), active = useRef(false), panelElement = useRef(null), settingsElement = useRef(null);
  const completedSessions = useRef(new Set()), agentsRef = useRef([]), unsavedRef = useRef(unsaved);
  const rootRestored = useRef(false);
  const draftKey = (key) => `unispeaking.chat-draft.${userId || "local"}.${key || "new"}`;
  const rememberText = () => { try { sessionStorage.setItem(draftKey(currentThread.current || currentAgent.current), text); } catch {} };
  function restoreText(key) { try { setText(sessionStorage.getItem(draftKey(key)) || ""); } catch { setText(""); } }
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
  function applyConversation(result) {
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
        applyConversation(result);
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
    setLoadingConversation(true); setConversationError(""); setError(""); setEditing(false);
    try {
      if (reference.startsWith("agent:")) {
        const id = reference.slice(6);
        const result = await api(`/agents/${encodeURIComponent(id)}/open`, "POST");
        if (!mounted.current || sequence !== routeSequence.current) return;
        const saved = result.agent; currentAgent.current = id; setSelectedAgent(saved);
        setConfig(fromSaved(saved)); setDirty(false);
        const fresh = new URLSearchParams(search).has("new");
        applyConversation(fresh ? null : result.conversation);
        currentAgent.current = id; if (fresh) setText(""); else restoreText(currentThread.current || id);
        threadRequest.current = new URLSearchParams(search).get("new") || crypto.randomUUID();
      } else {
        const thread = reference.startsWith("thread:"), id = thread ? reference.slice(7) : reference;
        let result = await api(`/${thread ? "threads" : "conversations"}/${encodeURIComponent(id)}${thread ? "/open" : ""}`, ...(thread ? ["POST"] : []));
        if (result?.threadId && !thread) result = await api(`/threads/${result.threadId}/open`, "POST");
        if (!mounted.current || sequence !== routeSequence.current) return;
        applyConversation(result); restoreText(result.threadId || id);
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
      if (!sessionId && items.length && !rootRestored.current) {
        rootRestored.current = true; void restore(`agent:${items[0].id}`, routeSearch);
      }
    }).catch((e) => { if (mounted.current) setError(e.message); });
    return () => { mounted.current = false; generation.current?.abort(); preview.current?.pause(); void client.current?.stop(); onActiveChange?.(false); };
  }, []);
  useEffect(() => {
    const route = workspaceRoute(sessionId, routeSearch); setPanel(route.panel); setAssetTab(route.tab);
    if (sessionId) { rootRestored.current = true; void restore(sessionId, routeSearch); }
  }, [sessionId, routeSearch]);
  useEffect(() => { try { sessionStorage.setItem(`unispeaking.agent-draft.${userId || "local"}`, JSON.stringify({ config, dirty })); } catch {} }, [config, dirty, userId]);
  useEffect(() => { unsavedRef.current = unsaved; try { sessionStorage.setItem(pendingKey, JSON.stringify(unsaved)); } catch {} }, [unsaved, pendingKey]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [conversation?.messages?.length, busy]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!panel && !editing) return;
    const trigger = document.activeElement; (editing ? settingsElement : panelElement).current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [panel, editing]);
  useEffect(() => {
    const warn = (event) => { if (active.current || dirty || unsavedRef.current.length) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function retryTranscripts() {
    await run("retrying", async () => {
      for (const item of unsavedRef.current) {
        await api(`/conversations/${item.sessionId}/transcripts`, "POST", { eventId: item.itemId, owner: item.owner, text: item.text });
        setUnsaved((items) => items.filter((x) => x.itemId !== item.itemId || x.sessionId !== item.sessionId));
      }
      await refresh(); flash("消息已保存");
    });
  }
  async function endVoice() {
    if (!client.current) return;
    await client.current.stop(); client.current = null; setActive(false); setMuted(false);
    notifyCompletion(await refresh());
  }
  async function leave(action, discard = false) {
    if (busy) return;
    if (active.current) {
      if (!window.confirm("结束当前语音对话并离开？已保存的消息和词句会保留。")) return;
      await run("ending", endVoice); if (active.current) return;
    }
    if (unsavedRef.current.length) { setError("还有消息未保存，请先重试保存。"); return; }
    if (discard && dirty && !window.confirm("当前 Agent 有未保存的修改，仍要切换吗？")) return;
    rememberText(); setSuggestions(null); setSelection(null); setError(""); action();
  }
  function choose(next) {
    if (next.id && currentAgent.current === next.id && view === "chat") return;
    void leave(() => {
      generation.current?.abort(); revision.current += 1; setGenerated(false); setOpening(""); setEditing(false);
      if (next.id) { onNavigate(`/conversation/agents/${next.id}`); void restore(`agent:${next.id}`); }
      else {
        currentAgent.current = null; currentThread.current = null; currentId.current = null;
        setSelectedAgent(null); setConfig({ ...next }); setDirty(false); setView("editor"); setPanel(null); setConversation(null); restoreText("new");
        rootRestored.current = true; if (sessionId) onNavigate("/conversation");
      }
    }, true);
  }
  function newConversation(saved = selectedAgent) {
    void leave(() => {
      currentThread.current = null; currentId.current = null; setConversation(null); setConversationError(""); setLoadingConversation(false);
      threadRequest.current = crypto.randomUUID(); turnRequest.current = null; setText(""); setView("chat"); setHistoryOpen(false);
      if (saved) { setSelectedAgent(saved); currentAgent.current = saved.id; setConfig(fromSaved(saved)); setDirty(false); onNavigate(`/conversation/agents/${saved.id}?new=${threadRequest.current}`); }
    });
  }
  function editSettings() {
    if (busy || conversation?.legacy) return;
    const latest = agentsRef.current.find((a) => a.id === currentAgent.current) || selectedAgent;
    setConfig(latest ? fromSaved(latest) : { ...conversation?.config || config }); setDirty(false); setGenerated(false); setOpening(""); setEditing(true);
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
      setOpening(result.opening); setGenerated(true); setDirty(true); flash("提示词已生成，可以直接编辑");
    });
  }
  async function save(copy = false) {
    if (!config.prompt.trim() || !config.purpose.trim()) { setError("请先填写目的和提示词。"); return; }
    await run("saving", async () => {
      const input = copy ? { ...config, id: null, version: null, name: `${config.name.slice(0,58)} 副本` } : config;
      const result = await api(config.id && !copy ? `/agents/${config.id}` : "/agents", config.id && !copy ? "PUT" : "POST", input);
      const items = [result, ...agentsRef.current.filter((item) => item.id !== result.id)]; agentsRef.current = items; setAgents(items);
      setConfig(fromSaved(result)); setDirty(false); setSelectedAgent(result); currentAgent.current = result.id;
      if (editing && !copy) { setEditing(false); flash("已保存，下一段新对话生效"); }
      else { currentThread.current = null; currentId.current = null; setConversation(null); setView("chat"); setEditing(false); setLoadingConversation(false); threadRequest.current = crypto.randomUUID(); onNavigate(`/conversation/agents/${result.id}?new=${threadRequest.current}`); flash(copy ? "副本已保存，可以开始聊天" : "Agent 已保存，可以开始聊天"); }
    });
  }
  async function start(channel) {
    const snapshot = conversation?.config || (selectedAgent ? fromSaved(selectedAgent) : config);
    if (!snapshot.prompt?.trim() || !snapshot.purpose?.trim()) { setError("请先生成或填写对话提示词。"); return; }
    if (channel === "text") { setView("chat"); setConversation(null); currentThread.current = null; currentId.current = null; setLoadingConversation(false); setConfig(snapshot); return; }
    await run("starting", async () => {
      turnRequest.current = null; setSuggestions(null);
      client.current = createRealtimeClient({
        apiBase: import.meta.env.VITE_BACKEND_URL || "", sceneType: "free-chat",
        onRemoteStream: (stream) => { if (audio.current) { audio.current.srcObject = stream; void audio.current.play().catch(() => setError("点击播放按钮以听到对方声音。")); } },
        onEvent: (event) => {
          if (!mounted.current) return;
          if (event.type === "local.connected") {
            currentId.current = event.sessionId; setView("chat"); setActive(true);
            void refresh(event.sessionId).then((result) => { if (result?.threadId) onNavigate(`/conversation/threads/${result.threadId}`); }).catch((e) => setError(e.message));
          }
          if (event.type === "local.transcript.final") setUnsaved((items) => items.some((x) => x.itemId === event.itemId && x.sessionId === event.sessionId) ? items : [...items, { itemId: event.itemId, sessionId: event.sessionId, owner: event.owner, text: event.text, saving: true }]);
          if (event.type === "local.transcript.failed") setUnsaved((items) => items.map((x) => x.itemId === event.itemId && x.sessionId === event.sessionId ? { ...x, saving: false } : x));
          if (event.type === "local.transcript.saved") { setUnsaved((items) => items.filter((x) => x.itemId !== event.itemId || x.sessionId !== event.sessionId)); void refresh().catch((e) => setError(e.message)); }
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
    await run("sending", async () => {
      if (!currentThread.current && !conversation) {
        const result = await api("/threads", "POST", { config: selectedAgent ? fromSaved(selectedAgent) : config, requestId: threadRequest.current });
        applyConversation(result);
      }
      const id = currentThread.current;
      const result = await api(id ? `/threads/${id}/messages` : `/conversations/${conversation.sessionId}/messages`, "POST", turnRequest.current);
      applyConversation(result); setText(""); try { sessionStorage.removeItem(draftKey(id || currentAgent.current)); } catch {} turnRequest.current = null;
      if (result.threadId) onNavigate(`/conversation/threads/${result.threadId}`);
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
    try { sessionStorage.removeItem(draftKey(currentThread.current || currentId.current)); } catch {}
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
      rootRestored.current = true; if (sessionId) onNavigate("/conversation"); flash("场景已带入聊天目的，调整后生成你的提示词");
    });
  }
  async function extract(message) {
    setSuggestions({ message, items: [] });
    await run("extracting", async () => { const items = await api(`/conversations/${message.segmentId || conversation.sessionId}/messages/${message.messageNo}/suggestions`, "POST"); setSuggestions({ message, items }); });
  }
  async function collect(item, messageNo, sourceId = conversation.sessionId) {
    await run("collecting", async () => {
      const items = await api(`/conversations/${sourceId}/learning`, "POST", { ...item, messageNo });
      if (currentThread.current) await refresh(); else setConversation((old) => ({ ...old, learning: items }));
      setSelection(null); flash("已加入词句训练，来源已保存在历史中");
    });
  }
  function selectedText(message, element) {
    const selected = window.getSelection();
    const value = selected?.toString().trim();
    if (value && element.contains(selected.anchorNode) && message.content.includes(value)) setSelection({ text: value, messageNo: message.messageNo, segmentId: message.segmentId || conversation.sessionId });
  }
  async function practice() {
    if (!answer.trim()) return;
    if (!attemptRequest.current || attemptRequest.current.answer !== answer) attemptRequest.current = { requestId: crypto.randomUUID(), answer };
    await run("practicing", async () => {
      const result = await api(`/learning/${exercise.id}/attempts`, "POST", attemptRequest.current);
      setFeedback(result.feedback); flash("练习和反馈已存入历史");
    });
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
  const savingDisabled = Boolean(busy) || !config.prompt.trim() || !config.purpose.trim() || !config.name.trim();

  const editor = (<div className="aw-editor-layout">
        <section className="aw-editor">
          <div className="aw-breadcrumb"><span>我的 Agent <span>/</span> {config.name}</span><button className="aw-outline aw-small" onClick={() => save(true)} disabled={savingDisabled}><Copy />复制</button></div>
          <header className="aw-editor-title"><span className="aw-symbol"><Suitcase /></span><div><div className="aw-edit-name"><input aria-label="Agent 名称" value={config.name} maxLength={64} onChange={(e) => update("name", e.target.value)} disabled={Boolean(busy)} /><PencilSimple /></div><p>说说你的目的，帮你展开成完整的聊天提示词。</p></div></header>
          <div className="aw-purpose"><label htmlFor="agent-purpose">这次想怎么聊</label><textarea id="agent-purpose" value={config.purpose} onChange={(e) => update("purpose", e.target.value)} maxLength={2000} disabled={busy === "generating"} placeholder="例如：想练去伦敦点餐，英语 B1。像朋友一样聊，别频繁打断我。" /><div className="aw-purpose-actions"><button className="aw-link" aria-expanded={inspiration} onClick={() => setInspiration(!inspiration)}><PencilSimple />从场景找灵感</button><button className="aw-primary" onClick={generate} disabled={Boolean(busy) || !config.purpose.trim()}>{busy === "generating" ? <Spinner /> : <Sparkle />} {busy === "generating" ? "正在展开你的想法…" : "生成详细提示词"}</button></div>
            {inspiration && <SceneSuggestions onUse={useScene} />}
          </div>
          <div className={`aw-prompt ${busy === "generating" ? "is-generating" : ""}`}><div className="aw-section-heading"><label htmlFor="agent-prompt">对话提示词</label><span>{dirty ? "有未保存的修改" : config.id ? "已保存" : "示例 · 可编辑"}{generated && <Check />}</span></div><textarea id="agent-prompt" key={generated ? "generated" : "draft"} value={config.prompt} onChange={(e) => update("prompt", e.target.value)} maxLength={12000} disabled={busy === "generating"} placeholder="写下目的，生成专属于你的对话提示词；也可以在这里直接编写。" /><div className="aw-prompt-foot"><span>角色、风格和话题，都可以直接写进提示词</span><button className="aw-link" onClick={generate} disabled={Boolean(busy) || !config.purpose.trim()}><ArrowClockwise />重新生成</button></div></div>
          <div className="aw-settings-grid">
            <div className="aw-setting"><label htmlFor="agent-voice"><SpeakerHigh />声音</label><div className="aw-voice-control"><select id="agent-voice" value={config.voice} disabled={Boolean(busy)} onChange={(e) => { preview.current?.pause(); setVoicePreview(false); update("voice", e.target.value); }}>{teachers.map((t) => <option key={t.voiceId} value={t.voiceId}>{t.name} · {t.accent.replace("口音", "")}</option>)}</select><button aria-label={voicePreview ? "停止试听" : "试听音色"} className={voicePreview ? "is-playing" : ""} onClick={playVoice}>{voicePreview ? <Stop weight="fill" /> : <Play weight="fill" />}</button></div></div>
            <div className="aw-setting"><label htmlFor="agent-correction"><PencilSimple />纠错</label><select id="agent-correction" value={config.correction} disabled={Boolean(busy)} onChange={(e) => update("correction", e.target.value)}>{Object.entries(corrections).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>
            <div className="aw-setting"><label htmlFor="agent-level"><SlidersHorizontal />对话难度</label><select id="agent-level" value={config.level} disabled={Boolean(busy)} onChange={(e) => update("level", e.target.value)}>{Object.entries(levels).map(([key, label]) => <option key={key} value={key}>{key} · {label}</option>)}</select></div>
            <button className="aw-setting aw-more" aria-expanded={settings} onClick={() => setSettings(!settings)}><span><SlidersHorizontal />更多设置</span><small>语速</small><CaretDown className={settings ? "is-rotated" : ""} /></button>
          </div>
          {settings && <div className="aw-speed"><label htmlFor="agent-speed">说话速度 <strong>{config.speed < 0.7 ? "慢速" : config.speed < 1 ? "舒缓" : config.speed > 1.15 ? "轻快" : "自然"}</strong></label><select id="agent-speed" value={config.speed} onChange={(e) => update("speed", Number(e.target.value))}><option value="0.6">慢速 · 清晰停顿</option><option value="0.9">舒缓 · 从容表达</option><option value="1">自然 · 日常节奏</option><option value="1.3">轻快 · 流畅交流</option></select><small>声音与语速用于语音聊天；交流风格由提示词决定。</small></div>}
          <footer className="aw-editor-footer"><span>本次提示词将用于新对话</span><div><button className="aw-outline" disabled={savingDisabled} onClick={() => save()}>{busy === "saving" ? <Spinner /> : null}{config.id ? "保存修改" : "保存为 Agent"}</button><button className="aw-primary aw-start" disabled={savingDisabled} onClick={() => start("voice")}>{busy === "starting" ? <Spinner /> : <Microphone />}用这段提示词开聊<ArrowRight /></button></div></footer>
        </section>
        <aside className="aw-preview"><header><h2>聊天预览</h2><p>先看开场，也可以直接开始聊天。</p></header><div className="aw-preview-content">{opening ? <div className="aw-example"><span className="aw-agent-symbol"><Suitcase /></span><div><small>{config.name} · 开场示例</small><p>{opening}</p><small>根据刚生成的提示词展示，正式回复会自然展开。</small></div></div> : <div className="aw-preview-empty"><span className="aw-orbit"><ChatCircleDots /></span><h3>你的下一段对话</h3><p>写一小段目的，生成提示词。<br />从你想聊的内容开始。</p></div>}</div><div className="aw-preview-bottom"><button className="aw-training-hint" onClick={() => openWorkspace("assets")}><BookOpenText /><span>聊天里的词汇和句子，随时加入训练</span><ArrowRight /></button><button className="aw-text-start" disabled={savingDisabled} onClick={() => start("text")}><ChatCircleDots /><span>想先打字？开始文字聊天</span><ArrowRight /></button><p>正式对话会自动保存在历史中。</p></div></aside>
      </div>);

  return <div className="agent-workspace aw-conversation-content">
    <audio ref={audio} autoPlay />
    <aside className="aw-agent-menu" aria-label="自由对话 Agent 列表">
      <div className="aw-nav-heading"><span>我的 Agent</span><button title="新建 Agent" aria-label="新建 Agent" onClick={() => choose(blankAgent())} disabled={Boolean(busy)}><Plus /></button></div>
      <nav aria-label="Agent 选择" className="aw-agents">
        {agents.map((agent, index) => <button key={agent.id} aria-label={`${agent.config.name} · ${agent.config.level}`} className={(currentAgent.current || config.id) === agent.id ? "is-selected" : ""} onClick={() => choose(fromSaved(agent))} disabled={Boolean(busy)}><span className="aw-agent-symbol"><Icon index={index} /></span><span><strong>{agent.config.name}</strong><small>{agent.config.level} · {corrections[agent.config.correction]}</small></span></button>)}
        {!agents.length && <p className="aw-nav-empty">保存你自己的对话伙伴，<br />也可以从下面的模板开始。</p>}
      </nav>
      <p className="aw-nav-caption">灵感模板</p>
      <nav className="aw-agents" aria-label="Agent 模板">{presets.map((preset, index) => <button key={preset.name} aria-label={`${preset.name} · ${preset.level}`} className={!config.id && config.name === preset.name ? "is-selected" : ""} disabled={Boolean(busy)} onClick={() => choose(preset)}><span className="aw-agent-symbol"><Icon index={index} /></span><span><strong>{preset.name}</strong><small>{preset.level} · 自由展开</small></span></button>)}</nav>
      <div className="aw-agent-tools"><button className="aw-agent-history" aria-label="词句训练" onClick={() => openWorkspace("assets", "all")}><BookOpenText /><span>词句训练</span></button><button className="aw-agent-history" aria-label="对话记录" onClick={() => setHistoryOpen(true)}><ClockCounterClockwise /><span>对话记录</span></button></div>
    </aside>
    <main className="aw-main">
      {error && !editing && <div className="aw-error" role="alert"><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X /></button></div>}
      {notice && <div className="aw-toast" role="status"><Check />{notice}</div>}
      {view === "editor" && editor}
      {view === "chat" && <div className="aw-chat-layout"><section className="aw-chat">
        <header className="aw-chat-header aw-thread-header"><span className="aw-agent-symbol"><Suitcase /></span>
          <div className="aw-thread-heading"><h2>{activeConfig.name}</h2><p>{activeConfig.level}{activeConfig.level ? " · " : ""}{live ? "正在聆听" : conversation?.messages?.length ? "聊天记录已保存" : "随时开始聊天"}</p></div>
          <div className="aw-thread-actions"><button className="aw-outline" onClick={() => setHistoryOpen(true)}><ClockCounterClockwise />历史记录</button><button className="aw-outline" disabled={Boolean(busy)} onClick={() => newConversation()}><Plus />新对话</button><button className="aw-outline" disabled={Boolean(busy) || readonly} onClick={editSettings}><SlidersHorizontal />修改设置</button></div>
        </header>
        <div className="aw-messages" aria-live="polite">
          {loadingConversation ? <div className="aw-empty"><Spinner /><p>正在读取对话…</p></div> : conversationError ? <div className="aw-empty"><h2>无法读取这段对话</h2><p>{conversationError}</p><button className="aw-outline" onClick={() => void restore(sessionId || `agent:${currentAgent.current}`, routeSearch)}>重新读取对话</button><button className="aw-link" onClick={() => { setConversationError(""); setLoadingConversation(false); newConversation(); }}>开始新对话</button></div> : <>
            {!conversation?.messages?.length && <div className="aw-chat-welcome"><span className={`aw-orbit ${live ? "is-listening" : ""}`}><ChatCircleDots /></span><p className="aw-eyebrow">{selectedAgent ? "YOUR CONVERSATION PARTNER" : "READY TO TALK"}</p><h2>{live ? "准备好了，开口吧" : `和${activeConfig.name}聊聊`}</h2><p>{selectedAgent ? "设置已经准备好。可以打字，也可以开始语音。" : "已经带上你的提示词，从一句 Hello 开始。"}</p></div>}
            {conversation?.messages?.map((message) => <article className={`aw-message ${message.owner === 1 ? "from-user" : "from-agent"}`} key={`${message.segmentId || conversation.sessionId}:${message.messageNo}`}><small>{message.owner === 1 ? "你" : activeConfig.name}</small><div className="aw-message-text" onMouseUp={(e) => selectedText(message, e.currentTarget)} onTouchEnd={(e) => selectedText(message, e.currentTarget)}>{message.content}</div>{!readonly && <div className="aw-message-actions"><button disabled={Boolean(busy)} onClick={() => extract(message)}><Sparkle />提取词句</button><button disabled={Boolean(busy) || message.content.length > 2000} onClick={() => collect({ kind: "sentence", text: message.content }, message.messageNo, message.segmentId || conversation.sessionId)}><Plus />整句加入训练</button></div>}</article>)}
            {unsaved.filter((item) => (conversation?.segments || [{ sessionId: currentId.current }]).some((part) => part.sessionId === item.sessionId)).map((item) => <article className={`aw-message ${item.owner === 1 ? "from-user" : "from-agent"} aw-pending-message`} key={item.itemId}><small>{item.owner === 1 ? "你" : activeConfig.name} · {item.saving ? "保存中" : "未保存"}</small><div className="aw-message-text">{item.text}</div></article>)}
            {busy === "sending" && <div className="aw-thinking"><span /><span /><span /><small>{activeConfig.name} 正在回复</small></div>}
          </>}
          <div ref={bottom} />
        </div>
        {unsaved.length > 0 && <div className="aw-save-status" role="status"><span>{unsaved.some((item) => !item.saving) ? "有消息尚未保存" : "正在保存语音消息…"}</span><button className="aw-link" disabled={Boolean(busy)} onClick={retryTranscripts}>重试保存</button></div>}
        {selection && <div className="aw-selection"><span>“{selection.text}”</span><button disabled={Boolean(busy)} onClick={() => collect({ text: selection.text, kind: "word" }, selection.messageNo, selection.segmentId)}>存为词汇</button><button disabled={Boolean(busy)} onClick={() => collect({ text: selection.text, kind: "sentence" }, selection.messageNo, selection.segmentId)}>存为句子</button><button aria-label="取消选取" onClick={() => setSelection(null)}><X /></button></div>}
        {!readonly && !loadingConversation && !conversationError && <>
          {live ? <div className="aw-voice-bar"><span className={`aw-wave ${muted ? "is-muted" : ""}`}><i /><i /><i /><i /><i /></span><span>{muted ? "麦克风已静音" : "自由说话，对方会自然回应"}</span><button aria-label={muted ? "取消静音" : "静音"} onClick={() => { client.current?.setMuted(!muted); setMuted(!muted); }}>{muted ? <MicrophoneSlash /> : <Microphone />}</button><button aria-label="播放对方声音" onClick={() => void audio.current?.play().catch((e) => setError(e.message))}><SpeakerHigh /></button><button className="aw-outline" onClick={end} disabled={Boolean(busy)}>结束语音</button></div> : <div className="aw-thread-composer"><form className="aw-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}><textarea aria-label="聊天消息" placeholder="说说你想聊的内容…" value={text} maxLength={4000} disabled={Boolean(busy)} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button className="aw-send" type="submit" aria-label="发送消息" disabled={Boolean(busy) || !text.trim()}>{busy === "sending" ? <Spinner /> : <PaperPlaneTilt weight="fill" />}</button></form><div className="aw-thread-composer-foot"><span>{conversation?.messages?.length ? "接着聊，之前的消息会保留" : "消息和有用的表达会保存在这里"}</span><div>{conversation?.sessionId && !["COMPLETED", "FAILED", "INTERRUPTED"].includes(conversation.status) && <button className="aw-link" disabled={Boolean(busy)} onClick={end}>结束本次练习</button>}<button className="aw-primary" disabled={Boolean(busy)} onClick={() => start("voice")}>{busy === "starting" ? <Spinner /> : <Microphone />}{busy === "starting" ? "正在连接…" : conversation?.messages?.length ? "继续语音" : "开始语音"}</button></div></div></div>}
        </>}
        {readonly && <p className="aw-history-note">这条旧版记录缺少 Agent 设置，原始消息已保留。你可以在左侧选择一个 Agent 开始新对话。</p>}
      </section>
<aside className="aw-chat-learning"><header><BookOpenText /><h2>把表达留下来</h2></header><p>选中消息中的词或句子，直接加入训练；也可以让 AI 帮你提取。</p>{suggestions && <section className="aw-suggestions"><div className="aw-section-heading"><strong>本条消息的表达</strong><button aria-label="关闭词句建议" onClick={() => setSuggestions(null)}><X /></button></div>{busy === "extracting" ? <p><Spinner />正在整理原文中的词句…</p> : !suggestions.items.length ? <p>暂无可提取内容，可直接选中原文添加。</p> : suggestions.items.map((item, index) => <div className="aw-learning-card" key={index}><small>{item.kind === "word" ? "词汇" : "句子"}</small><strong>{item.text}</strong><p>{item.meaning}</p><button disabled={Boolean(busy) || collected(item, suggestions.message.messageNo, suggestions.message.segmentId || conversation.sessionId)} onClick={() => collect(item, suggestions.message.messageNo, suggestions.message.segmentId || conversation.sessionId)}>{collected(item, suggestions.message.messageNo) ? <><Check />已加入</> : <><Plus />加入训练</>}</button></div>)}</section>}
        <h3>本次收藏 <span>{conversation?.learning?.length || 0}</span></h3>{conversation?.learning?.length ? conversation.learning.map((item) => <div className="aw-learning-card" key={item.id}><small>{item.kind === "word" ? "词汇" : "句子"}</small><strong>{item.text}</strong><p>{item.meaning}</p><button onClick={() => { setExercise(item); setAnswer(""); setFeedback(""); attemptRequest.current = null; }}><Play />练习这句表达</button></div>) : <div className="aw-collection-empty"><Plus /><span>有用的表达，从这次对话开始。</span></div>}<details className="aw-snapshot"><summary>查看本次提示词</summary><p>{conversation?.config?.prompt}</p><small>{conversation?.config?.level} · {corrections[conversation?.config?.correction]}</small></details></aside></div>}
      {editing && <div className="aw-settings-backdrop" onClick={closeSettings}><aside ref={settingsElement} tabIndex={-1} className="aw-settings-drawer" role="dialog" aria-modal="true" aria-label="修改 Agent 设置" onClick={(e) => e.stopPropagation()} onKeyDown={drawerKeys}><header className="aw-drawer-header"><div><h2>修改 Agent 设置</h2><p>保存后从下一段新对话生效，当前聊天保持原设置。</p></div><button className="aw-icon-button" aria-label="关闭 Agent 设置" onClick={closeSettings}><X /></button></header>{error && <p className="aw-inline-error" role="alert">{error}</p>}{editor}</aside></div>}
      {historyOpen && <AgentConversationHistory agentId={currentAgent.current} agentName={selectedAgent?.config?.name || activeConfig.name} onClose={() => setHistoryOpen(false)} onOpen={openHistory} onRemoved={historyRemoved} currentThreadId={currentThread.current} currentSessionId={currentId.current} deleteBlocked={live ? "请先结束语音，再删除当前对话" : busy ? "请等当前操作完成，再删除对话" : unsaved.length ? "请先保存未保存的语音消息" : ""} />}
      {panel && <aside ref={panelElement} tabIndex={-1} className="aw-workspace-panel" aria-label="学习资产面板" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); openWorkspace(); } }}>
        <button className="aw-panel-close" aria-label="收起工作台面板" onClick={() => openWorkspace()}><X /></button>
        <AgentLearningAssets initialTab={assetTab} onTabChange={(tab) => openWorkspace("assets", tab)} onOpenConversation={openHistory} onUseScene={useScene} />
      </aside>}
    </main>
    {exercise && <div className="aw-modal-backdrop" onClick={() => { if (!busy) setExercise(null); }}><section className="aw-modal" role="dialog" aria-modal="true" aria-label="词句训练" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape" && !busy) setExercise(null); }}><button className="aw-modal-close" aria-label="关闭词句训练" disabled={Boolean(busy)} onClick={() => setExercise(null)}><X /></button><p className="aw-eyebrow">PRACTICE AN EXPRESSION</p><h2>{exercise.text}</h2><p>{exercise.meaning || "回想它在原对话中的意思。"}</p><details><summary>回看原句</summary><p>{exercise.sourceText}</p></details><label htmlFor="practice-answer">试着用这个表达说一句话</label><textarea id="practice-answer" autoFocus value={answer} maxLength={4000} onChange={(e) => { setAnswer(e.target.value); setFeedback(""); }} placeholder="Write your own sentence…" disabled={Boolean(busy)} /><button className="aw-primary" onClick={practice} disabled={Boolean(busy) || !answer.trim()}>{busy === "practicing" ? <Spinner /> : <Sparkle />}获得表达建议</button>{error && <p className="aw-modal-error" role="alert">{error}</p>}{feedback && <div className="aw-feedback"><Check /><p>{feedback}</p><small>已保存到历史 · 词句练习</small></div>}</section></div>}
  </div>;
}
