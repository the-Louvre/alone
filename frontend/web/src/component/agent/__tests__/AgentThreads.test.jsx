import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn(), start: vi.fn(), stop: vi.fn(), factory: vi.fn() }));
vi.mock("../agentApi.js", async (original) => ({ ...await original(), agentRequest: mocks.api }));
vi.mock("../../../websocket/realtimeClient.js", () => ({ createRealtimeClient: mocks.factory }));
import AgentWorkspace from "../AgentWorkspace.jsx";
import { presets } from "../agentApi.js";
const agent = { id: "agent-tony", version: 1, config: { ...presets[0], name: "托尼", purpose: "练习理发", prompt: "Old haircut prompt." } };
const thread = { threadId: "thread-tony", agentId: agent.id, config: { ...agent.config, id: agent.id, version: 1 }, sessionId: "voice-one", channel: "voice", status: "COMPLETED", segments: [{ sessionId: "voice-one", channel: "voice", status: "COMPLETED" }], messages: [{ segmentId: "voice-one", messageNo: 1, owner: 0, content: "How short would you like it?" }], learning: [] };
let saved;
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); Element.prototype.scrollIntoView = vi.fn(); window.confirm = vi.fn(() => true); saved = structuredClone(agent);
  mocks.start.mockResolvedValue({}); mocks.stop.mockResolvedValue({}); mocks.factory.mockReturnValue({ start: mocks.start, stop: mocks.stop, setMuted: vi.fn() });
  mocks.api.mockImplementation(async (path, method, input) => {
    if (path === "/agents") return [saved];
    if (path === "/agents/agent-tony/open") return { agent: saved, conversation: structuredClone(thread) };
    if (path === "/conversations/voice-one" || path === "/threads/thread-tony" || path === "/threads/thread-tony/open") return structuredClone(thread);
    if (path === "/agents/agent-tony" && method === "PUT") { saved = { id: agent.id, version: 2, config: input }; return saved; }
    if (path.startsWith("/threads?")) return [{ ...thread, messageCount: 1, createdAt: "2026-10-19T13:30:00Z", preview: "How short would you like it?" }];
    return [];
  });
});
afterEach(cleanup);
it("opens a saved Agent directly in its latest meaningful conversation", async () => {
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  expect(await screen.findByText("How short would you like it?")).toBeInTheDocument();
  expect(screen.queryByLabelText("对话提示词")).toBeNull();
  expect(screen.queryByLabelText("聊天消息")).toBeNull();
  expect(screen.getByRole("button", { name: "继续语音" })).toBeInTheDocument();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.api.mock.calls.some(([path, method]) => path === "/threads" && method === "POST")).toBe(false);
});
it("clicking the selected Agent preserves messages and unsent input", async () => {
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  await screen.findByText("How short would you like it?"); fireEvent.click(screen.getByRole("button", { name: "文字", exact: true }));
  const composer = await screen.findByLabelText("聊天消息"); fireEvent.change(composer, { target: { value: "Keep the length, please." } });
  const calls = mocks.api.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "托尼 · B1" }));
  expect(screen.getByLabelText("聊天消息")).toBe(composer); expect(composer).toHaveValue("Keep the length, please.");
  expect(screen.getByText("How short would you like it?")).toBeInTheDocument(); expect(mocks.api).toHaveBeenCalledTimes(calls);
});
it("saves settings in a drawer while preserving the current snapshot and transcript", async () => {
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  await screen.findByText("How short would you like it?");
  fireEvent.click(screen.getByRole("button", { name: "更多操作" }));
  fireEvent.click(screen.getByRole("button", { name: "修改设置" }));
  const drawer = await screen.findByRole("dialog", { name: "修改 Agent 设置" });
  fireEvent.change(within(drawer).getByLabelText("对话提示词"), { target: { value: "New styling prompt." } });
  fireEvent.click(within(drawer).getByRole("button", { name: "保存修改" }));
  expect(await screen.findByText("已保存，下一段新对话生效")).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "修改 Agent 设置" })).toBeNull();
  expect(screen.getByText("How short would you like it?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "继续语音" }));
  await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "thread-tony", agentConfig: expect.objectContaining({ prompt: "Old haircut prompt.", version: 1 }) })));
});
it("new conversation uses the latest settings without creating an empty record", async () => {
  const navigate = vi.fn(); render(<AgentWorkspace userId="owner" onNavigate={navigate} />);
  await screen.findByText("How short would you like it?");
  fireEvent.click(screen.getByRole("button", { name: "更多操作" }));
  fireEvent.click(screen.getByRole("button", { name: "新对话" }));
  expect(screen.queryByText("How short would you like it?")).toBeNull();
  expect(screen.queryByLabelText("聊天消息")).toBeNull();
  expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/conversation\/agents\/agent-tony\?new=/));
  expect(mocks.api.mock.calls.some(([path, method]) => path === "/threads" && method === "POST")).toBe(false);
});
it("history is scoped to the selected Agent and does not erase a message draft", async () => {
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  await screen.findByText("How short would you like it?"); fireEvent.click(screen.getByRole("button", { name: "文字", exact: true }));
  const composer = await screen.findByLabelText("聊天消息");fireEvent.change(composer, { target: { value: "My draft" } });
  fireEvent.click(screen.getByRole("button", { name: "历史记录", exact: true }));
  const drawer = await screen.findByRole("dialog", { name: "对话历史记录" });
  await waitFor(() => expect(mocks.api.mock.calls.some(([path]) => path.includes("/threads?") && path.includes("agentId=agent-tony"))).toBe(true));
  fireEvent.click(within(drawer).getByRole("button", { name: "关闭对话历史" }));
  expect(composer).toHaveValue("My draft");expect(screen.getByText("How short would you like it?")).toBeInTheDocument();
});
it("a failed new message retains its text and retries the same thread and request", async () => {
  let turns = 0; const inputs = []; const original = mocks.api.getMockImplementation();
  mocks.api.mockImplementation(async (path, method, input) => {
    if (path === "/threads/thread-tony/messages") { inputs.push(input);if(turns++===0)throw new Error("网络中断");return { ...thread, messages: [...thread.messages, { segmentId: "text-two", messageNo: 1, owner: 1, content: input.text }] }; }
    return original(path, method, input);
  });
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  await screen.findByText("How short would you like it?");fireEvent.click(screen.getByRole("button", { name: "文字", exact: true }));
  fireEvent.change(await screen.findByLabelText("聊天消息"), { target: { value: "Just a trim." } });fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("网络中断");expect(screen.getByLabelText("聊天消息")).toHaveValue("Just a trim.");
  fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
  expect(await screen.findByText("Just a trim.")).toBeInTheDocument();expect(inputs[0].requestId).toBe(inputs[1].requestId);
});

it("keeps failed voice transcripts visible and retries saving them without a new model call", async () => {
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  await screen.findByText("How short would you like it?");fireEvent.click(screen.getByRole("button", { name: "继续语音" }));
  await waitFor(() => expect(mocks.factory).toHaveBeenCalled());
  const events=mocks.factory.mock.calls[0][0].onEvent;
  act(() => {
    events({ type: "local.transcript.final", sessionId: "voice-one", itemId: "1:retry-me", owner: 1, text: "Save this sentence." });
    events({ type: "local.transcript.failed", sessionId: "voice-one", itemId: "1:retry-me", owner: 1, text: "Save this sentence." });
  });
  expect(screen.getByText("Save this sentence.")).toBeInTheDocument();
  expect(screen.getByText("有消息尚未保存")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/conversations/voice-one/transcripts", "POST", { eventId: "1:retry-me", owner: 1, text: "Save this sentence." }));
  await waitFor(() => expect(screen.queryByText("有消息尚未保存")).toBeNull());
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it("deleting the displayed history clears its composer and opens the remaining Agent chat", async () => {
  let deleted=false; const original=mocks.api.getMockImplementation();
  mocks.api.mockImplementation(async (path,method,input) => {
    if(path === "/threads/thread-tony" && method === "DELETE") { deleted=true;return {deleted:true}; }
    if(path === "/agents/agent-tony/open" && deleted) return {agent:saved,conversation:null};
    return original(path,method,input);
  });
  const navigate=vi.fn();render(<AgentWorkspace userId="owner" onNavigate={navigate} />);
  await screen.findByText("How short would you like it?");fireEvent.click(screen.getByRole("button", { name: "文字", exact: true }));
  fireEvent.change(await screen.findByLabelText("聊天消息"),{target:{value:"Draft for deleted chat"}});
  fireEvent.click(screen.getByRole("button",{name:"历史记录",exact:true}));
  fireEvent.click(await screen.findByRole("button",{name:/^删除托尼的对话/}));
  fireEvent.click(screen.getByRole("button",{name:"移入回收站",exact:true}));
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"对话历史记录"})).toBeNull());
  await screen.findByRole("button",{name:"文字",exact:true});fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));
  expect(await screen.findByLabelText("聊天消息")).toHaveValue("");
  expect(screen.queryByText("How short would you like it?")).toBeNull();
  expect(navigate).toHaveBeenCalledWith("/conversation/agents/agent-tony");
  expect(mocks.api.mock.calls.some(([path,method])=>path === "/threads" && method === "POST")).toBe(false);
});

it("confirms voice-to-text, cancellation keeps voice, and confirmation continues in the same thread",async()=>{
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);
  await screen.findByText("How short would you like it?");fireEvent.click(screen.getByRole("button",{name:"继续语音"}));
  await waitFor(()=>expect(mocks.factory).toHaveBeenCalled());
  act(()=>mocks.factory.mock.calls[0][0].onEvent({type:"local.connected",sessionId:"voice-one"}));
  fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));
  let dialog=await screen.findByRole("dialog",{name:"结束语音并切换文字？"});
  fireEvent.click(within(dialog).getByRole("button",{name:"继续语音"}));expect(mocks.stop).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"结束语音",exact:true})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));dialog=await screen.findByRole("dialog",{name:"结束语音并切换文字？"});
  fireEvent.click(within(dialog).getByRole("button",{name:"结束语音并切换",exact:true}));
  expect(await screen.findByLabelText("聊天消息")).toHaveValue("");expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(screen.getByText("How short would you like it?")).toBeInTheDocument();
  expect(mocks.api.mock.calls.some(([path,method])=>path==="/threads"&&method==="POST")).toBe(false);
});
it("blocks switching to text if the final voice transcript cannot be saved",async()=>{
  const original=mocks.api.getMockImplementation();mocks.api.mockImplementation(async(path,...args)=>{if(path.endsWith("/transcripts"))throw new Error("save failed");return original(path,...args);});
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText("How short would you like it?");fireEvent.click(screen.getByRole("button",{name:"继续语音"}));
  await waitFor(()=>expect(mocks.factory).toHaveBeenCalled());const events=mocks.factory.mock.calls[0][0].onEvent;
  act(()=>events({type:"local.connected",sessionId:"voice-one"}));
  mocks.stop.mockImplementation(async()=>{events({type:"local.transcript.final",sessionId:"voice-one",itemId:"final",owner:1,text:"Keep this final sentence."});});
  fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));
  const dialog=await screen.findByRole("dialog",{name:"结束语音并切换文字？"});fireEvent.click(within(dialog).getByRole("button",{name:"结束语音并切换",exact:true}));
  await waitFor(()=>expect(within(dialog).getByRole("alert")).toHaveTextContent("还有消息未保存"));
  expect(screen.queryByLabelText("聊天消息")).toBeNull();expect(screen.getByText("Keep this final sentence.")).toBeInTheDocument();
  expect(mocks.api).toHaveBeenCalledWith("/conversations/voice-one/transcripts","POST",{eventId:"final",owner:1,text:"Keep this final sentence."});
});
it("opens all history from the sidebar while the header stays scoped to its Agent",async()=>{
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText("How short would you like it?");
  fireEvent.click(screen.getByRole("button",{name:"对话记录",exact:true}));
  const dialog=await screen.findByRole("dialog",{name:"对话历史记录"});expect(within(dialog).getByRole("heading",{name:"全部对话记录"})).toBeInTheDocument();
  await waitFor(()=>expect(mocks.api).toHaveBeenCalledWith("/threads?offset=0"));
});
