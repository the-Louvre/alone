import React from "react";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import AgentWorkspace from "../AgentWorkspace.jsx";
import { agentRequest, presets } from "../agentApi.js";
import { getDailyPicks, getLearningAssets, getLearningAsset } from "../../../infrastructure/http/apiClient.js";

vi.mock("../agentApi.js", async (original) => ({ ...await original(), agentRequest: vi.fn() }));
vi.mock("../../../infrastructure/http/apiClient.js", async (original) => ({ ...await original(), getDailyPicks: vi.fn(), getLearningAssets: vi.fn(), getLearningAsset: vi.fn() }));
const api = vi.mocked(agentRequest);
const conversation = { sessionId: "session-one", config: { ...presets[0] }, channel: "text", status: "CREATED", messages: [], learning: [] };
beforeEach(() => {
  vi.clearAllMocks(); Element.prototype.scrollIntoView = vi.fn(); window.confirm = vi.fn(() => true);
  sessionStorage.clear(); window.history.replaceState({}, "", "/conversation");
  vi.mocked(getDailyPicks).mockResolvedValue({ picks: [] });
  vi.mocked(getLearningAssets).mockResolvedValue([]);
  api.mockImplementation(async (path) => path === "/conversations/session-one" ? conversation : []);
});
afterEach(cleanup);

it("generates an editable prompt and starts real chat with the edited text", async () => {
  api.mockImplementation(async (path) => {
    if (path === "/generate") return {name:"陶艺聊友",prompt:"Talk about pottery.",opening:"What do you make?"};
    if (path === "/conversations") return conversation;
    return [];
  });
  const user=userEvent.setup(); render(<AgentWorkspace onNavigate={vi.fn()} />);
  await user.clear(screen.getByLabelText("这次想怎么聊"));
  await user.type(screen.getByLabelText("这次想怎么聊"),"我想用英语聊陶艺");
  await user.click(screen.getByRole("button",{name:"生成详细提示词"}));
  await waitFor(()=>expect(screen.getByLabelText("对话提示词")).toHaveValue("Talk about pottery."));
  await user.clear(screen.getByLabelText("对话提示词"));
  await user.type(screen.getByLabelText("对话提示词"),"Discuss pottery; ask about glazing first.");
  expect(screen.queryByText("What do you make?")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:"想先打字？开始文字聊天"}));
  expect(api).toHaveBeenCalledWith("/conversations","POST",{config:expect.objectContaining({prompt:"Discuss pottery; ask about glazing first."})});
  expect(await screen.findByLabelText("聊天消息")).toBeInTheDocument();
  expect(document.querySelector('input[type="file"]')).toBeNull();
  expect(screen.queryByText(/评测|评分/)).toBeNull();
});

it("preserves the existing prompt on generation failure and provides a retry", async () => {
  api.mockImplementation(async (path) => { if(path==="/generate") throw new Error("生成失败，请重试"); return []; });
  render(<AgentWorkspace onNavigate={vi.fn()} />);
  fireEvent.click(screen.getByRole("button",{name:"生成详细提示词"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("生成失败，请重试");
  expect(screen.getByLabelText("对话提示词")).toHaveValue(presets[0].prompt);
  expect(screen.getByRole("button",{name:"生成详细提示词"})).toBeEnabled();
});

it("saves separate Agents and sends optimistic versions on edits", async () => {
  let saved=[];
  api.mockImplementation(async (path,method,input) => {
    if(path==="/agents" && method==="POST") { const result={id:"agent-one",version:1,config:input};saved=[result];return result; }
    if(path==="/agents/agent-one") {const result={id:"agent-one",version:2,config:input};saved=[result];return result;}
    return saved;
  });
  const user=userEvent.setup();render(<AgentWorkspace onNavigate={vi.fn()} />);
  await user.click(screen.getByRole("button",{name:"保存为 Agent"}));
  await screen.findByRole("button",{name:"保存修改"});
  await user.clear(screen.getByLabelText("Agent 名称"));await user.type(screen.getByLabelText("Agent 名称"),"我的搭子");
  await user.click(screen.getByRole("button",{name:"保存修改"}));
  expect(api).toHaveBeenCalledWith("/agents/agent-one","PUT",expect.objectContaining({name:"我的搭子",version:1,id:"agent-one"}));
});

it("opens management for a saved Agent and prepares an unsaved copy", async () => {
  const saved = { id: "agent-one", version: 2, config: { ...presets[0], name: "旅行练习" } };
  api.mockImplementation(async (path) => path === "/agents" ? [saved] : []);
  const user = userEvent.setup();
  render(<AgentWorkspace onNavigate={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "管理 旅行练习" }));
  expect(screen.getByRole("menuitem", { name: "编辑设置" })).toBeInTheDocument();
  expect(screen.getByText(/删除需要服务端支持/)).toBeInTheDocument();
  await user.click(screen.getByRole("menuitem", { name: "复制为新 Agent" }));
  expect(screen.getByLabelText("Agent 名称")).toHaveValue("旅行练习 副本");
  expect(screen.getByRole("button", { name: "保存为 Agent" })).toBeInTheDocument();
  expect(api).not.toHaveBeenCalledWith(expect.stringMatching(/agents\/agent-one/), "DELETE", expect.anything());
});

it("retries a failed text turn with the same request id and keeps unsent input", async () => {
  let turn=0;const requests=[];
  api.mockImplementation(async (path,method,input) => {
    if(path==="/conversations/session-one") return conversation;
    if(path.endsWith("/messages")) { requests.push(input);if(turn++===0) throw new Error("连接中断");return {...conversation,messages:[{messageNo:1,owner:1,content:input.text},{messageNo:2,owner:0,content:"Hello there."}]}; }
    return [];
  });
  const user=userEvent.setup();render(<AgentWorkspace sessionId="session-one" onNavigate={vi.fn()} />);
  await user.type(await screen.findByLabelText("聊天消息"),"Hello");await user.click(screen.getByRole("button",{name:"发送消息"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("连接中断");
  expect(screen.getByLabelText("聊天消息")).toHaveValue("Hello");
  await user.click(screen.getByRole("button",{name:"发送消息"}));
  expect(await screen.findByText("Hello there.")).toBeInTheDocument();
  expect(requests[0].requestId).toBe(requests[1].requestId);
});

it("refreshes existing learning progress on completion without leaving the conversation window", async () => {
  const onSessionEnded = vi.fn(), navigate = vi.fn();
  api.mockImplementation(async (path) => path.endsWith("/end") ? { ...conversation, status: "COMPLETED" } : path === "/conversations/session-one" ? conversation : []);
  render(<AgentWorkspace sessionId="session-one" onNavigate={navigate} onSessionEnded={onSessionEnded} />);
  fireEvent.click(await screen.findByRole("button", { name: "结束对话" }));
  await screen.findByText("这段对话已保存在历史中。原提示词和收藏词句会一直保留。");
  expect(onSessionEnded).toHaveBeenCalledExactlyOnceWith("session-one");
  expect(navigate).not.toHaveBeenCalled();
});

it("collects a sentence with its source and restores completed history without starting a new session", async () => {
  const stored={...conversation,status:"COMPLETED",messages:[{messageNo:2,owner:0,content:"A cup of tea, please."}]};
  api.mockImplementation(async (path,method,input) => {
    if(path==="/conversations/session-one") return stored;
    if(path.endsWith("/learning")) return [{id:"word-one",...input,sessionId:"session-one",sourceText:input.text}];
    return [];
  });
  render(<AgentWorkspace sessionId="session-one" onNavigate={vi.fn()} />);
  await screen.findByText("A cup of tea, please.");
  fireEvent.click(screen.getByRole("button",{name:"整句加入训练"}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith("/conversations/session-one/learning","POST",expect.objectContaining({messageNo:2,text:"A cup of tea, please.",kind:"sentence"})));
  expect(screen.queryByLabelText("聊天消息")).toBeNull();
  expect(api.mock.calls.some(([path,method])=>path==="/conversations"&&method==="POST")).toBe(false);
});

it("does not introduce another app sidebar or an interview entry", () => {
  render(<AgentWorkspace onNavigate={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /面试/ })).toBeNull();
  expect(screen.queryByRole("navigation", { name: "自由对话导航" })).toBeNull();
  expect(screen.getByRole("navigation", { name: "Agent 选择" })).toBeInTheDocument();
});

it("opens scene inspiration inside the current editor without navigating and preserves the draft", async () => {
  vi.mocked(getDailyPicks).mockResolvedValue({ picks: [{ id: "cafe", title: "咖啡店点餐", goal: "说明口味偏好", sceneInput: "在咖啡店说明口味偏好" }] });
  const navigate = vi.fn(); const first = render(<AgentWorkspace userId="owner" onNavigate={navigate} />);
  fireEvent.click(screen.getByRole("combobox", { name: "对话难度" }));
  fireEvent.click(screen.getByRole("option", { name: /C1/ }));
  fireEvent.click(screen.getByRole("combobox", { name: "声音" }));
  fireEvent.click(screen.getByRole("option", { name: /James/ }));
  fireEvent.click(screen.getByRole("button", { name: "从场景找灵感" }));
  expect(await screen.findByRole("button", { name: /咖啡店点餐/ })).toBeInTheDocument();
  expect(navigate).not.toHaveBeenCalled();
  first.unmount();
  render(<AgentWorkspace userId="owner" onNavigate={navigate} />);
  expect(screen.getByRole("combobox", { name: "声音" })).toHaveTextContent("James");
  expect(screen.getByRole("combobox", { name: "对话难度" })).toHaveTextContent("C1");
  expect(screen.getByLabelText("对话提示词")).toHaveValue(presets[0].prompt);
});

it("keeps the current conversation and unsent text while checking history", async () => {
  const navigate = vi.fn(); render(<AgentWorkspace sessionId="session-one" onNavigate={navigate} />);
  const composer = await screen.findByLabelText("聊天消息");
  fireEvent.change(composer, { target: { value: "Keep this draft" } });
  fireEvent.click(screen.getByRole("button", { name: "对话记录", exact: true }));
  await screen.findByRole("heading", { name: "学习资产", exact: true });
  expect(navigate).not.toHaveBeenCalled();
  expect(composer).toHaveValue("Keep this draft");
  fireEvent.click(screen.getByRole("button", { name: "收起工作台面板" }));
  expect(screen.getByLabelText("聊天消息")).toBe(composer);
  expect(composer).toHaveValue("Keep this draft");
  expect(api.mock.calls.some(([path, method]) => path.endsWith("/end") && method === "POST")).toBe(false);
});

it("restores the asset tab and unsaved Agent after remount, without changing user data", async () => {
  const first = render(<AgentWorkspace userId="owner" onNavigate={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("对话提示词"), { target: { value: "My unsaved prompt" } });
  first.unmount();
  const second = render(<AgentWorkspace userId="owner" routeSearch="?section=assets&tab=practice" onNavigate={vi.fn()} />);
  expect(screen.getByLabelText("对话提示词")).toHaveValue("My unsaved prompt");
  expect(screen.getByRole("button", { name: "练习记录", exact: true })).toHaveAttribute("aria-current", "page");
  await screen.findByText("完成一次词句练习，反馈会保存在这里。");
  second.unmount();
  render(<AgentWorkspace userId="another-owner" onNavigate={vi.fn()} />);
  expect(screen.getByLabelText("对话提示词")).toHaveValue(presets[0].prompt);
});

it("reads previous scene assets in place and brings their context into the Agent", async () => {
  vi.mocked(getLearningAssets).mockResolvedValue([{ sceneId: "old-scene", title: "旧的旅行场景" }]);
  vi.mocked(getLearningAsset).mockResolvedValue({ title: "旧的旅行场景", background: "办理酒店入住", wordList: [{ contentId: "word", englishText: "reservation", chineseText: "预订" }] });
  const navigate = vi.fn(); render(<AgentWorkspace routeSearch="?section=assets&tab=existing" onNavigate={navigate} />);
  fireEvent.click(await screen.findByRole("button", { name: /旧的旅行场景/ }));
  expect(await screen.findByText("reservation")).toBeInTheDocument();
  expect(getLearningAsset).toHaveBeenCalledWith("old-scene");
  fireEvent.click(screen.getByRole("button", { name: "带入 Agent 聊天" }));
  expect(screen.getByLabelText("这次想怎么聊").value).toContain("办理酒店入住");
  expect(navigate).not.toHaveBeenCalled();
});

it("shows source-linked expressions, conversations and practice feedback in one asset panel", async () => {
  api.mockImplementation(async (path) => {
    if (path === "/learning") return [{ id: "word", kind: "word", text: "wonderful", sessionId: "session-one" }];
    if (path === "/conversations") return [{ ...conversation, createdAt: "2026-10-19T10:00:00Z" }];
    if (path === "/attempts") return [{ id: "attempt", text: "wonderful", answer: "A wonderful day.", feedback: "表达自然", createdAt: "2026-10-19T10:00:00Z", sessionId: "session-one" }];
    return [];
  });
  const navigate = vi.fn(); render(<AgentWorkspace routeSearch="?section=assets" onNavigate={navigate} />);
  expect(await screen.findByText("wonderful")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "练习记录", exact: true }));
  expect(await screen.findByText("表达自然")).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("navigation", { name: "学习资产分类" })).getByRole("button", { name: "对话记录", exact: true }));
  const panel = screen.getByRole("complementary", { name: "学习资产面板" });
  fireEvent.click(within(panel).getByRole("button", { name: /旅行搭子/ }));
  expect(navigate).toHaveBeenLastCalledWith("/conversation/session-one");
});
