import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Plus, Copy, Check, Sparkle, Suitcase, ChatCircleDots, BookOpenText, ClockCounterClockwise, SpeakerHigh, Play, Stop, Microphone, MicrophoneSlash, PaperPlaneTilt, X, SlidersHorizontal, CaretDown, ArrowClockwise, CircleNotch, PencilSimple, DotsThree } from "@phosphor-icons/react";
import { teachers } from "../../domain/content/data.js";
import { createRealtimeClient } from "../../websocket/realtimeClient.js";
import { agentRequest as api, presets, blankAgent, fromSaved, readAgentDraft } from "./agentApi.js";
import AgentLearningAssets from "./AgentLearningAssets.jsx";
import { SceneSuggestions } from "./WorkspaceCollections.jsx";
import { ChoiceSelect } from "./ChoiceSelect.jsx";
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
  const [agentMenu, setAgentMenu] = useState(null);
  const [inspiration, setInspiration] = useState(false);
  const [config, setConfig] = useState(draft.config);
  const [dirty, setDirty] = useState(draft.dirty);
  const [view, setView] = useState(() => workspaceRoute(sessionId, routeSearch).view);
  const [panel, setPanel] = useState(() => workspaceRoute(sessionId, routeSearch).panel);
  const [conversation, setConversation] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opening, setOpening] = useState("");
  const [generated, setGenerated] = useState(false);
  const [settings, setSettings] = useState(false);
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
  const audio = useRef(null);
  const preview = useRef(null);
  const client = useRef(null);
  const currentId = useRef(sessionId);
  const mounted = useRef(true);
  const generation = useRef(null);
  const revision = useRef(0);
  const turnRequest = useRef(null);
  const attemptRequest = useRef(null);
  const bottom = useRef(null);
  const refreshSequence = useRef(0);
  const pending = useRef(false);
  const active = useRef(false);
  const panelElement = useRef(null);
  const completedSessions = useRef(new Set());

  function notifyCompletion(result) {
    if (result?.status !== "COMPLETED" || completedSessions.current.has(result.sessionId)) return;
    completedSessions.current.add(result.sessionId);
    onSessionEnded?.(result.sessionId);
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
    revision.current += 1; setConfig((old) => ({ ...old, [key]: value })); setDirty(true);
    if (["prompt", "purpose", "level"].includes(key)) setOpening("");
  };
  const setActive = (value) => { active.current = value; setLive(value); onActiveChange?.(value); };
  async function refresh(id = currentId.current) {
    if (!id) return;
    const sequence = ++refreshSequence.current;
    const result = await api(`/conversations/${encodeURIComponent(id)}`);
    if (mounted.current && currentId.current === id && sequence === refreshSequence.current) setConversation(result);
    return result;
  }
  useEffect(() => {
    mounted.current = true;
    api("/agents").then((items) => { if (mounted.current) setAgents(items); }).catch((e) => setError(e.message));
    return () => {
      mounted.current = false; generation.current?.abort(); preview.current?.pause();
      void client.current?.stop(); onActiveChange?.(false);
    };
  }, []);
  useEffect(() => {
    const route = workspaceRoute(sessionId, routeSearch);
    currentId.current = sessionId || null;
    setView(route.view); setPanel(route.panel); setAssetTab(route.tab);
    if (sessionId) {
      void refresh(sessionId).catch((e) => setError(e.message));
    }
  }, [sessionId, routeSearch]);
  useEffect(() => {
    try { sessionStorage.setItem(`unispeaking.agent-draft.${userId || "local"}`, JSON.stringify({ config, dirty })); }
    catch { /* Editing remains available when browser storage is full or disabled. */ }
  }, [config, dirty, userId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [conversation?.messages?.length, busy]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    if (!agentMenu) return;
    const close = (event) => { if (!event.target.closest?.(".aw-agent-item")) setAgentMenu(null); };
    const escape = (event) => { if (event.key === "Escape") setAgentMenu(null); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [agentMenu]);
  useEffect(() => {
    if (!panel) return;
    const trigger = document.activeElement;
    panelElement.current?.focus();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, [panel]);
  useEffect(() => {
    const warn = (event) => { if (active.current || dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function endVoice() {
    if (!client.current) return;
    await client.current.stop(); client.current = null; setActive(false); setMuted(false);
    notifyCompletion(await refresh());
  }
  async function leave(action, discard = false) {
    if (busy) return;
    if (active.current) {
      if (!window.confirm("结束当前语音对话并离开？已保存的消息和词句会保留。")) return;
      await run("ending", endVoice);
      if (active.current) return;
    }
    if (discard && dirty && !window.confirm("当前 Agent 有未保存的修改，仍要切换吗？")) return;
    setSuggestions(null); setSelection(null); setError(""); action();
  }
  function choose(next) {
    void leave(() => {
      generation.current?.abort(); revision.current += 1;
      setAgentMenu(null);
      setConfig({ ...next }); setDirty(false); setGenerated(false); setOpening("");
      setView("editor"); setPanel(null); setConversation(null); currentId.current = null;
      if (sessionId) onNavigate("/conversation");
    }, true);
  }
  function copyAgent(agent) {
    void leave(() => {
      generation.current?.abort(); revision.current += 1;
      setAgentMenu(null);
      setConfig({ ...agent.config, id: null, version: null, name: `${agent.config.name.slice(0, 58)} 副本` });
      setDirty(true); setGenerated(false); setOpening(""); setView("editor"); setPanel(null);
      setConversation(null); currentId.current = null;
      if (sessionId) onNavigate("/conversation");
      flash("副本尚未保存，检查设置后点击保存");
    }, true);
  }
  async function generate() {
    if (!config.purpose.trim()) { setError("先写下一小段你想聊天的目的。"); return; }
    const atRevision = revision.current;
    generation.current?.abort(); generation.current = new AbortController();
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
      setConfig(fromSaved(result)); setDirty(false); setAgents(await api("/agents")); flash(copy ? "副本已保存" : "Agent 已保存");
    });
  }
  async function start(channel) {
    if (!config.prompt.trim() || !config.purpose.trim()) { setError("请先生成或填写对话提示词。"); return; }
    await run("starting", async () => {
      setText(""); turnRequest.current = null; setSuggestions(null);
      if (channel === "text") {
        const result = await api("/conversations", "POST", { config });
        currentId.current = result.sessionId; setConversation(result); setView("chat"); onNavigate(`/conversation/${result.sessionId}`);
      } else {
        client.current = createRealtimeClient({
          apiBase: import.meta.env.VITE_BACKEND_URL || "", sceneType: "free-chat",
          onRemoteStream: (stream) => { if (audio.current) { audio.current.srcObject = stream; void audio.current.play().catch(() => setError("点击播放按钮以听到对方声音。")); } },
          onEvent: (event) => {
            if (!mounted.current) return;
            if (event.type === "local.connected") {
              currentId.current = event.sessionId; setView("chat"); setActive(true);
              onNavigate(`/conversation/${event.sessionId}`); void refresh().catch((e) => setError(e.message));
            }
            if (event.type === "local.transcript.saved") void refresh().catch((e) => setError(e.message));
            if (["local.backend_warning", "local.error", "local.mic_error", "local.provider_warning", "error"].includes(event.type)) setError(event.message || event.error?.message || "语音连接异常，请重试");
            if (event.type === "local.ended") { setActive(false); void refresh().then(notifyCompletion).catch((e) => setError(e.message)); }
          },
        });
        try { await client.current.start({ voice: config.voice, speechSpeed: config.speed < 0.7 ? "SLOWER" : config.speed < 1 ? "MODERATE" : config.speed > 1.15 ? "FASTER" : "NATURAL", agentConfig: config }); }
        catch (e) { await client.current?.stop(); client.current = null; setActive(false); throw e; }
      }
    });
  }
  async function send() {
    const content = text.trim(); if (!content || !conversation) return;
    if (!turnRequest.current || turnRequest.current.text !== content) turnRequest.current = { requestId: crypto.randomUUID(), text: content };
    await run("sending", async () => {
      const result = await api(`/conversations/${conversation.sessionId}/messages`, "POST", turnRequest.current);
      setConversation(result); setText(""); turnRequest.current = null;
    });
  }
  async function end() {
    await run("ending", async () => {
      if (live) await endVoice();
      else {
        const result = await api(`/conversations/${conversation.sessionId}/end`, "POST");
        setConversation(result); notifyCompletion(result);
      }
      flash("对话已保存到历史");
    });
  }
  function openHistory(id) {
    void leave(() => {
      currentId.current = id; setConversation(null); setView("chat"); setPanel(null);
      onNavigate(`/conversation/${id}`); void refresh(id).catch((e) => setError(e.message));
    });
  }
  function openWorkspace(target = null, tab = "all") {
    setPanel(target); setAssetTab(tab);
  }
  function useScene(scene) {
    void leave(() => {
      revision.current += 1;
      setConfig((old) => ({ ...old, purpose: `我想练习${scene.sceneInput || scene.title}。英语 ${old.level}，请围绕这个情境自然交流。`, prompt: "" }));
      setDirty(true); setOpening(""); setGenerated(false); setView("editor"); setConversation(null); currentId.current = null;
      openWorkspace(); setInspiration(false);
      if (sessionId) onNavigate("/conversation");
      flash("场景已带入聊天目的，调整后生成你的提示词");
    });
  }
  async function extract(message) {
    setSuggestions({ message, items: [] });
    await run("extracting", async () => {
      const items = await api(`/conversations/${conversation.sessionId}/messages/${message.messageNo}/suggestions`, "POST");
      setSuggestions({ message, items });
    });
  }
  async function collect(item, messageNo) {
    await run("collecting", async () => {
      const items = await api(`/conversations/${conversation.sessionId}/learning`, "POST", { ...item, messageNo });
      setConversation((old) => ({ ...old, learning: items })); setSelection(null); flash("已加入词句训练，来源已保存在历史中");
    });
  }
  function selectedText(message, element) {
    const selected = window.getSelection();
    const value = selected?.toString().trim();
    if (value && element.contains(selected.anchorNode) && message.content.includes(value)) setSelection({ text: value, messageNo: message.messageNo });
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
  const activeConfig = view === "chat" ? conversation?.config || config : config;
  const readonly = conversation && (conversation.channel === "voice" ? !live : ["COMPLETED", "FAILED"].includes(conversation.status));
  const collected = (item, no) => conversation?.learning?.some((x) => x.messageNo === no && x.text === item.text && x.kind === item.kind);
  const savingDisabled = Boolean(busy) || !config.prompt.trim() || !config.purpose.trim() || !config.name.trim();

  return <div className="agent-workspace aw-conversation-content">
    <audio ref={audio} autoPlay />
    <aside className="aw-agent-menu" aria-label="自由对话 Agent 列表">
      <div className="aw-nav-heading"><span>我的 Agent</span><button title="新建 Agent" aria-label="新建 Agent" onClick={() => choose(blankAgent())} disabled={Boolean(busy)}><Plus /></button></div>
      <nav aria-label="Agent 选择" className="aw-agents aw-select-list">
        {agents.map((agent, index) => <div className={`aw-agent-item ${config.id === agent.id ? "is-selected" : ""}`} key={agent.id}><button className="aw-agent-item__select" aria-label={`${agent.config.name} · ${agent.config.level}`} aria-current={config.id === agent.id ? "page" : undefined} onClick={() => choose(fromSaved(agent))} disabled={Boolean(busy)}><span className="aw-agent-symbol"><Icon index={index} /></span><span><strong>{agent.config.name}</strong><small>{agent.config.level} · {corrections[agent.config.correction]}</small></span></button><button className="aw-agent-item__more" aria-label={`管理 ${agent.config.name}`} aria-haspopup="menu" aria-expanded={agentMenu === agent.id} disabled={Boolean(busy)} onClick={() => setAgentMenu(agentMenu === agent.id ? null : agent.id)}><DotsThree weight="bold" /></button>{agentMenu === agent.id && <div className="aw-agent-item__menu" role="menu"><button role="menuitem" onClick={() => choose(fromSaved(agent))}><PencilSimple />编辑设置</button><button role="menuitem" onClick={() => copyAgent(agent)}><Copy />复制为新 Agent</button><span className="aw-agent-item__menu-note">删除需要服务端支持，当前不会移除你的数据。</span></div>}</div>)}
        {!agents.length && <p className="aw-nav-empty">保存你自己的对话伙伴，<br />也可以从下面的模板开始。</p>}
      </nav>
      <p className="aw-nav-caption">灵感模板</p>
      <nav className="aw-agents aw-select-list" aria-label="Agent 模板">{presets.map((preset, index) => <button key={preset.name} aria-label={`${preset.name} · ${preset.level}`} aria-current={!config.id && config.name === preset.name ? "page" : undefined} className={!config.id && config.name === preset.name ? "is-selected" : ""} disabled={Boolean(busy)} onClick={() => choose(preset)}><span className="aw-agent-symbol"><Icon index={index} /></span><span><strong>{preset.name}</strong><small>{preset.level} · 自由展开</small></span></button>)}</nav>
      <div className="aw-agent-tools"><button className="aw-agent-history" aria-label="词句训练" onClick={() => openWorkspace("assets", "all")}><BookOpenText /><span>词句训练</span></button><button className="aw-agent-history" aria-label="对话记录" onClick={() => openWorkspace("assets", "chat")}><ClockCounterClockwise /><span>对话记录</span></button></div>
    </aside>
    <main className="aw-main">
      {error && <div className="aw-error" role="alert"><span>{error}</span><button aria-label="关闭错误提示" onClick={() => setError("")}><X /></button></div>}
      {notice && <div className="aw-toast" role="status"><Check />{notice}</div>}
      {view === "editor" && <div className="aw-editor-layout">
        <section className="aw-editor">
          <div className="aw-breadcrumb"><span>我的 Agent <span>/</span> {config.name}</span><button className="aw-outline aw-small" onClick={() => save(true)} disabled={savingDisabled}><Copy />复制</button></div>
          <header className="aw-editor-title"><span className="aw-symbol"><Suitcase /></span><div><div className="aw-edit-name"><input aria-label="Agent 名称" value={config.name} maxLength={64} onChange={(e) => update("name", e.target.value)} disabled={Boolean(busy)} /><PencilSimple /></div></div></header>
          <div className="aw-purpose"><label htmlFor="agent-purpose">这次想怎么聊</label><textarea id="agent-purpose" value={config.purpose} onChange={(e) => update("purpose", e.target.value)} maxLength={2000} disabled={busy === "generating"} placeholder="例如：想练去伦敦点餐，英语 B1。像朋友一样聊，别频繁打断我。" /><div className="aw-purpose-actions"><button className="aw-link" aria-expanded={inspiration} onClick={() => setInspiration(!inspiration)}><PencilSimple />从场景找灵感</button><button className="aw-primary" onClick={generate} disabled={Boolean(busy) || !config.purpose.trim()}>{busy === "generating" ? <Spinner /> : <Sparkle />} {busy === "generating" ? "正在展开你的想法…" : "生成详细提示词"}</button></div>
            {inspiration && <SceneSuggestions onUse={useScene} />}
          </div>
          <div className={`aw-prompt ${busy === "generating" ? "is-generating" : ""}`}><div className="aw-section-heading"><label htmlFor="agent-prompt">对话提示词</label><span>{dirty ? "有未保存的修改" : config.id ? "已保存" : "示例 · 可编辑"}{generated && <Check />}</span></div><textarea id="agent-prompt" key={generated ? "generated" : "draft"} value={config.prompt} onChange={(e) => update("prompt", e.target.value)} maxLength={12000} disabled={busy === "generating"} placeholder="写下目的，生成专属于你的对话提示词；也可以在这里直接编写。" /><div className="aw-prompt-foot"><span>角色、风格和话题，都可以直接写进提示词</span><button className="aw-link" onClick={generate} disabled={Boolean(busy) || !config.purpose.trim()}><ArrowClockwise />重新生成</button></div></div>
          <div className="aw-settings-grid">
            <div className="aw-setting"><span><SpeakerHigh />声音</span><div className="aw-voice-control"><ChoiceSelect id="agent-voice" label="声音" value={config.voice} disabled={Boolean(busy)} options={teachers.map((t) => ({ value: t.voiceId, label: `${t.name} · ${t.accent.replace("口音", "")}` }))} onChange={(voice) => { preview.current?.pause(); setVoicePreview(false); update("voice", voice); }} /><button aria-label={voicePreview ? "停止试听" : "试听音色"} className={voicePreview ? "is-playing" : ""} onClick={playVoice}>{voicePreview ? <Stop weight="fill" /> : <Play weight="fill" />}</button></div></div>
            <div className="aw-setting"><span><PencilSimple />纠错</span><ChoiceSelect id="agent-correction" label="纠错" value={config.correction} disabled={Boolean(busy)} options={Object.entries(corrections).map(([key, label]) => ({ value: key, label }))} onChange={(correction) => update("correction", correction)} /></div>
            <div className="aw-setting"><span><SlidersHorizontal />对话难度</span><ChoiceSelect id="agent-level" label="对话难度" value={config.level} disabled={Boolean(busy)} options={Object.entries(levels).map(([key, label]) => ({ value: key, label: `${key} · ${label}` }))} onChange={(level) => update("level", level)} /></div>
            <button className="aw-setting aw-more" aria-expanded={settings} onClick={() => setSettings(!settings)}><span><SlidersHorizontal />更多设置</span><small>语速</small><CaretDown className={settings ? "is-rotated" : ""} /></button>
          </div>
          {settings && <div className="aw-speed"><div>说话速度 <strong>{config.speed < 0.7 ? "慢速" : config.speed < 1 ? "舒缓" : config.speed > 1.15 ? "轻快" : "自然"}</strong></div><ChoiceSelect id="agent-speed" label="说话速度" value={config.speed} options={[{ value: 0.6, label: "慢速 · 清晰停顿" }, { value: 0.9, label: "舒缓 · 从容表达" }, { value: 1, label: "自然 · 日常节奏" }, { value: 1.3, label: "轻快 · 流畅交流" }]} onChange={(speed) => update("speed", speed)} /><small>声音与语速用于语音聊天；交流风格由提示词决定。</small></div>}
          <footer className="aw-editor-footer"><span>本次提示词将用于新对话</span><div><button className="aw-outline" disabled={savingDisabled} onClick={() => save()}>{busy === "saving" ? <Spinner /> : null}{config.id ? "保存修改" : "保存为 Agent"}</button><button className="aw-primary aw-start" disabled={savingDisabled} onClick={() => start("voice")}>{busy === "starting" ? <Spinner /> : <Microphone />}用这段提示词开聊<ArrowRight /></button></div></footer>
        </section>
        <aside className="aw-preview"><header><h2>聊天预览</h2></header><div className="aw-preview-content">{opening ? <div className="aw-example"><span className="aw-agent-symbol"><Suitcase /></span><div><small>{config.name} · 开场示例</small><p>{opening}</p></div></div> : <div className="aw-preview-empty"><span className="aw-orbit"><ChatCircleDots /></span><h3>你的下一段对话</h3><p>生成提示词后，这里会出现开场示例。</p></div>}</div><div className="aw-preview-bottom"><button className="aw-training-hint" onClick={() => openWorkspace("assets")}><BookOpenText /><span>查看词句训练</span><ArrowRight /></button><button className="aw-text-start" aria-label="想先打字？开始文字聊天" disabled={savingDisabled} onClick={() => start("text")}><ChatCircleDots /><span>开始文字聊天</span><ArrowRight /></button></div></aside>
      </div>}
      {view === "chat" && <div className="aw-chat-layout"><section className="aw-chat"><header className="aw-chat-header"><button aria-label="返回 Agent 设置" className="aw-icon-button" onClick={() => void leave(() => { setView("editor"); onNavigate("/conversation"); })}><ArrowLeft /></button><span className="aw-agent-symbol"><Suitcase /></span><div><h2>{activeConfig.name}</h2><p>{activeConfig.level} · {conversation?.channel === "voice" ? "语音对话" : "文字对话"} · {live ? "正在聆听" : readonly ? "历史记录" : "自动保存"}</p></div>{conversation && !readonly && <button className="aw-outline" onClick={end} disabled={Boolean(busy)}>结束对话</button>}{readonly && <button className="aw-primary" onClick={() => choose({ ...conversation.config, id: null, version: null })}>用此设置新聊<ArrowRight /></button>}</header>
        <div className="aw-messages" aria-live="polite">{!conversation && <div className="aw-empty"><Spinner /><p>正在读取对话…</p></div>}{conversation?.messages?.length === 0 && <div className="aw-chat-welcome"><span className={`aw-orbit ${live ? "is-listening" : ""}`}><Microphone /></span><h2>{live ? "准备好了，开口吧" : "从一句 Hello 开始"}</h2><p>已经带上你的提示词。{live ? "转写完成后，消息会自动保存。" : "也可以直接说说你今天想聊的内容。"}</p></div>}{conversation?.messages?.map((message) => <article className={`aw-message ${message.owner === 1 ? "from-user" : "from-agent"}`} key={message.messageNo}><small>{message.owner === 1 ? "你" : activeConfig.name}</small><div className="aw-message-text" onMouseUp={(e) => selectedText(message, e.currentTarget)} onTouchEnd={(e) => selectedText(message, e.currentTarget)}>{message.content}</div><div className="aw-message-actions"><button disabled={Boolean(busy)} onClick={() => extract(message)}><Sparkle />提取词句</button><button disabled={Boolean(busy) || message.content.length > 2000} onClick={() => collect({ kind: "sentence", text: message.content }, message.messageNo)}><Plus />整句加入训练</button></div></article>)}{busy === "sending" && <div className="aw-thinking"><span /><span /><span /><small>{activeConfig.name} 正在回复</small></div>}<div ref={bottom} /></div>
        {selection && <div className="aw-selection"><span>“{selection.text}”</span><button disabled={Boolean(busy)} onClick={() => collect({ text: selection.text, kind: "word" }, selection.messageNo)}>存为词汇</button><button disabled={Boolean(busy)} onClick={() => collect({ text: selection.text, kind: "sentence" }, selection.messageNo)}>存为句子</button><button aria-label="取消选取" onClick={() => setSelection(null)}><X /></button></div>}
        {conversation && !readonly && (conversation.channel === "text" ? <form className="aw-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}><textarea aria-label="聊天消息" placeholder="说说你想聊的内容…" value={text} maxLength={4000} disabled={Boolean(busy)} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button className="aw-send" type="submit" aria-label="发送消息" disabled={Boolean(busy) || !text.trim()}>{busy === "sending" ? <Spinner /> : <PaperPlaneTilt weight="fill" />}</button></form> : <div className={`aw-voice-bar aw-voice-pill ${error ? "is-error" : muted ? "is-muted" : live ? "is-live" : "is-connecting"}`} role="status" aria-live="polite"><span className="aw-voice-pill__signal" aria-hidden="true">{muted ? <MicrophoneSlash /> : <span className="aw-wave"><i /><i /><i /><i /><i /></span>}</span><span className="aw-voice-pill__copy"><strong>{error ? "语音需要处理" : muted ? "麦克风已静音" : live ? "麦克风已连接" : "正在连接语音"}</strong><small>{error ? "查看上方提示" : muted ? "取消静音后继续练习" : live ? "开口后，转写会显示在对话中" : "请稍候"}</small></span><div className="aw-voice-pill__actions"><button aria-label={muted ? "取消静音" : "静音"} title={muted ? "取消静音" : "静音"} onClick={() => { client.current?.setMuted(!muted); setMuted(!muted); }}>{muted ? <MicrophoneSlash /> : <Microphone />}</button><button aria-label="播放对方声音" title="播放对方声音" onClick={() => void audio.current?.play().catch((e) => setError(e.message))}><SpeakerHigh /></button></div></div>)}{readonly && <p className="aw-history-note">这段对话已保存在历史中。原提示词和收藏词句会一直保留。</p>}
      </section><aside className="aw-chat-learning"><header><BookOpenText /><h2>把表达留下来</h2></header><p>选中消息中的词或句子，直接加入训练；也可以让 AI 帮你提取。</p>{suggestions && <section className="aw-suggestions"><div className="aw-section-heading"><strong>本条消息的表达</strong><button aria-label="关闭词句建议" onClick={() => setSuggestions(null)}><X /></button></div>{busy === "extracting" ? <p><Spinner />正在整理原文中的词句…</p> : !suggestions.items.length ? <p>暂无可提取内容，可直接选中原文添加。</p> : suggestions.items.map((item, index) => <div className="aw-learning-card" key={index}><small>{item.kind === "word" ? "词汇" : "句子"}</small><strong>{item.text}</strong><p>{item.meaning}</p><button disabled={Boolean(busy) || collected(item, suggestions.message.messageNo)} onClick={() => collect(item, suggestions.message.messageNo)}>{collected(item, suggestions.message.messageNo) ? <><Check />已加入</> : <><Plus />加入训练</>}</button></div>)}</section>}
        <h3>本次收藏 <span>{conversation?.learning?.length || 0}</span></h3>{conversation?.learning?.length ? conversation.learning.map((item) => <div className="aw-learning-card" key={item.id}><small>{item.kind === "word" ? "词汇" : "句子"}</small><strong>{item.text}</strong><p>{item.meaning}</p><button onClick={() => { setExercise(item); setAnswer(""); setFeedback(""); attemptRequest.current = null; }}><Play />练习这句表达</button></div>) : <div className="aw-collection-empty"><Plus /><span>有用的表达，从这次对话开始。</span></div>}<details className="aw-snapshot"><summary>查看本次提示词</summary><p>{conversation?.config?.prompt}</p><small>{conversation?.config?.level} · {corrections[conversation?.config?.correction]}</small></details></aside></div>}
      {panel && <aside ref={panelElement} tabIndex={-1} className="aw-workspace-panel" aria-label="学习资产面板" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); openWorkspace(); } }}>
        <button className="aw-panel-close" aria-label="收起工作台面板" onClick={() => openWorkspace()}><X /></button>
        <AgentLearningAssets initialTab={assetTab} onTabChange={(tab) => openWorkspace("assets", tab)} onOpenConversation={openHistory} onUseScene={useScene} />
      </aside>}
    </main>
    {exercise && <div className="aw-modal-backdrop" onClick={() => { if (!busy) setExercise(null); }}><section className="aw-modal" role="dialog" aria-modal="true" aria-label="词句训练" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape" && !busy) setExercise(null); }}><button className="aw-modal-close" aria-label="关闭词句训练" disabled={Boolean(busy)} onClick={() => setExercise(null)}><X /></button><p className="aw-eyebrow">PRACTICE AN EXPRESSION</p><h2>{exercise.text}</h2><p>{exercise.meaning || "回想它在原对话中的意思。"}</p><details><summary>回看原句</summary><p>{exercise.sourceText}</p></details><label htmlFor="practice-answer">试着用这个表达说一句话</label><textarea id="practice-answer" autoFocus value={answer} maxLength={4000} onChange={(e) => { setAnswer(e.target.value); setFeedback(""); }} placeholder="Write your own sentence…" disabled={Boolean(busy)} /><button className="aw-primary" onClick={practice} disabled={Boolean(busy) || !answer.trim()}>{busy === "practicing" ? <Spinner /> : <Sparkle />}获得表达建议</button>{error && <p className="aw-modal-error" role="alert">{error}</p>}{feedback && <div className="aw-feedback"><Check /><p>{feedback}</p><small>已保存到历史 · 词句练习</small></div>}</section></div>}
  </div>;
}
