import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn(), factory: vi.fn(), start: vi.fn(), stop: vi.fn() }));
vi.mock("../agentApi.js", async (original) => ({ ...await original(), agentRequest: mocks.api }));
vi.mock("../../../websocket/realtimeClient.js", () => ({ createRealtimeClient: mocks.factory }));
import AgentWorkspace from "../AgentWorkspace.jsx";
import AgentPracticeDialog from "../AgentPracticeDialog.jsx";
import { presets } from "../agentApi.js";
const config = { ...presets[0], id: "tony", version: 1, name: "托尼", purpose: "理发需求练习" };
const agent = { id: "tony", version: 1, config };
const thread = { threadId: "old-thread", agentId: "tony", sessionId: "old-voice", config, channel: "voice", status: "COMPLETED", messages: [{ segmentId: "old-voice", messageNo: 1, owner: 0, content: "Keep the length. Tidy up the ends." }], learning: [] };
let saved;
beforeEach(() => {
  vi.clearAllMocks();localStorage.clear();sessionStorage.clear();window.history.replaceState({},"","/conversation");
  Element.prototype.scrollIntoView=vi.fn();window.confirm=vi.fn(()=>true);saved=structuredClone(agent);
  mocks.start.mockResolvedValue({});mocks.stop.mockResolvedValue({});mocks.factory.mockReturnValue({start:mocks.start,stop:mocks.stop});
  mocks.api.mockImplementation(async(path,method,input)=>{
    if(path==="/agents")return [saved];
    if(path==="/agents/tony/open")return {agent:saved,conversation:structuredClone(thread)};
    if(path==="/threads/old-thread"||path==="/threads/old-thread/open")return structuredClone(thread);
    if(path==="/agents/tony"&&method==="PUT"){saved={id:"tony",version:2,config:input};return saved;}
    if(path==="/presets/daily")return {id:"daily-saved",presetKey:"daily",version:1,config:input.config};
    if(path==="/threads"&&method==="POST")return {...thread,threadId:"new-thread",config:input.config,messages:[]};
    if(path==="/threads/new-thread/messages")return {...thread,threadId:"new-thread",messages:[{segmentId:"new-text",messageNo:1,owner:1,content:input.text}]};
    return [];
  });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("restores an unsent existing-chat draft and its mode after unmount without sending it",async()=>{
  let view=render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));fireEvent.change(screen.getByLabelText("聊天消息"),{target:{value:"A draft after refresh"}});view.unmount();
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);
  expect(await screen.findByLabelText("聊天消息")).toHaveValue("A draft after refresh");
  expect(mocks.api.mock.calls.some(([path,method])=>path.endsWith("/messages")&&method==="POST")).toBe(false);
});
it("keeps the old draft when starting a new conversation and returns in one step",async()=>{
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));fireEvent.change(screen.getByLabelText("聊天消息"),{target:{value:"Old input"}});
  fireEvent.click(screen.getByRole("button",{name:"新对话",exact:true}));fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));fireEvent.change(screen.getByLabelText("聊天消息"),{target:{value:"New input"}});
  fireEvent.click(screen.getByRole("button",{name:"继续上一段对话"}));expect(await screen.findByLabelText("聊天消息")).toHaveValue("Old input");
  fireEvent.click(screen.getByRole("button",{name:"新对话",exact:true}));expect(await screen.findByLabelText("聊天消息")).toHaveValue("New input");
  expect(mocks.api.mock.calls.some(([path,method])=>path==="/threads"&&method==="POST")).toBe(false);
});
it("uses a real modal for notes in a narrow workspace and returns focus on close",async()=>{
  vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({width:740,height:800,top:0,left:0,bottom:800,right:740,x:0,y:0,toJSON:()=>({})});
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  const trigger=screen.getByRole("button",{name:"本次随手记"});trigger.focus();fireEvent.click(trigger);
  expect(await screen.findByRole("dialog",{name:"随手记"})).toHaveAttribute("aria-modal","true");
  expect(screen.queryByRole("button",{name:"继续语音"})).toBeNull();
  fireEvent.keyDown(document,{key:"Escape"});expect(screen.queryByRole("dialog",{name:"随手记"})).toBeNull();expect(trigger).toHaveFocus();
});
it("chooses a preset without configuration, then saves it only once when sending",async()=>{
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"发现更多对话伙伴"}));fireEvent.click(screen.getByRole("button",{name:/日常聊友 聊聊生活/}));
  expect(screen.queryByLabelText("对话提示词")).toBeNull();expect(mocks.api.mock.calls.some(([p])=>p==="/presets/daily")).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));fireEvent.change(screen.getByLabelText("聊天消息"),{target:{value:"Hello there"}});fireEvent.click(screen.getByRole("button",{name:"发送消息"}));
  await screen.findByText("Hello there");expect(mocks.api.mock.calls.filter(([p])=>p==="/presets/daily")).toHaveLength(1);
  expect(mocks.api).toHaveBeenCalledWith("/threads","POST",expect.objectContaining({config:expect.objectContaining({id:"daily-saved"})}));
});
it("a failed preset registration retains the input and retries the same creation ID",async()=>{
  const original=mocks.api.getMockImplementation();let attempts=0;
  mocks.api.mockImplementation(async(path,...args)=>{if(path==="/presets/daily"&&attempts++===0)throw new Error("保存伙伴失败");return original(path,...args);});
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"发现更多对话伙伴"}));fireEvent.click(screen.getByRole("button",{name:/日常聊友 聊聊生活/}));fireEvent.click(screen.getByRole("button",{name:"文字",exact:true}));
  fireEvent.change(screen.getByLabelText("聊天消息"),{target:{value:"Keep my input"}});fireEvent.click(screen.getByRole("button",{name:"发送消息"}));await screen.findByText("保存伙伴失败");
  expect(screen.getByLabelText("聊天消息")).toHaveValue("Keep my input");expect(mocks.api.mock.calls.some(([p])=>p==="/threads")).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"发送消息"}));await screen.findByText("Keep my input");
  const calls=mocks.api.mock.calls.filter(([p])=>p==="/presets/daily");expect(calls[0][2].requestId).toBe(calls[1][2].requestId);
});
it("collects an exact sentence using its original segment instead of the latest session",async()=>{
  const original=mocks.api.getMockImplementation();mocks.api.mockImplementation(async(path,method,input)=>{if(path==="/conversations/old-voice/learning")return [{id:"item",sessionId:"old-voice",messageNo:1,...input}];return original(path,method,input);});
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"收藏词句"}));fireEvent.click(await screen.findByRole("checkbox",{name:"Keep the length."}));fireEvent.click(screen.getByRole("button",{name:"确认收藏"}));
  await waitFor(()=>expect(mocks.api).toHaveBeenCalledWith("/conversations/old-voice/learning","POST",{kind:"sentence",scope:"sentence",text:"Keep the length.",messageNo:1}));
});
it("asks for one sentence from an old whole collection and saves the selected practice target",async()=>{
  mocks.api.mockResolvedValue({feedback:"表达自然"});const item={id:"collected",kind:"sentence",scope:null,text:"Keep the length. Tidy up the ends.",sessionId:"old-voice",messageNo:1,sourceText:thread.messages[0].content};
  render(<AgentPracticeDialog item={item} userId="owner" onRead={vi.fn()} onClose={vi.fn()}/>);
  expect(screen.queryByLabelText("用相同句式表达你的想法")).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Keep the length."}));
  fireEvent.change(await screen.findByLabelText("用相同句式表达你的想法"),{target:{value:"Please keep the length."}});fireEvent.click(screen.getByRole("button",{name:"提交造句"}));
  await screen.findByText("表达自然");expect(mocks.api).toHaveBeenCalledWith("/learning/collected/attempts","POST",expect.objectContaining({targetText:"Keep the length.",answer:"Please keep the length."}),expect.any(AbortSignal));
});
it("saving settings keeps the old snapshot until explicitly opening a new conversation",async()=>{
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"声音与语速设置"}));
  fireEvent.change(await screen.findByLabelText("声音"),{target:{value:"Harvey"}});
  fireEvent.click(screen.getByRole("button",{name:"保存修改"}));
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:"修改 Agent 设置"})).toBeNull());
  expect(screen.getByText(thread.messages[0].content)).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"声音与语速设置"})).toHaveTextContent("Clara");
  fireEvent.click(screen.getByRole("button",{name:"新开一段"}));
  expect(screen.getByRole("button",{name:"声音与语速设置"})).toHaveTextContent("James");
  expect(screen.getByRole("button",{name:"继续上一段对话"})).toBeInTheDocument();
});
it("saving and starting a new conversation uses the new config without creating an empty server chat",async()=>{
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"声音与语速设置"}));
  fireEvent.change(await screen.findByLabelText("声音"),{target:{value:"Harvey"}});
  fireEvent.click(screen.getByRole("button",{name:"保存并新开对话"}));
  await screen.findByRole("button",{name:"继续上一段对话"});
  expect(screen.getByRole("button",{name:"声音与语速设置"})).toHaveTextContent("James");
  expect(mocks.api.mock.calls.some(([p,m])=>p==="/threads"&&m==="POST")).toBe(false);
  expect(mocks.start).not.toHaveBeenCalled();
});
it("restores an unsubmitted practice answer after closing and reopening",async()=>{
  const item={id:"saved-sentence",kind:"sentence",text:"Keep the length.",sessionId:"old-voice",messageNo:1};
  const view=render(<AgentPracticeDialog item={item} userId="owner" onClose={vi.fn()}/>);
  fireEvent.change(await screen.findByLabelText("用相同句式表达你的想法"),{target:{value:"Please keep it longer."}});view.unmount();
  render(<AgentPracticeDialog item={item} userId="owner" onClose={vi.fn()}/>);
  expect(await screen.findByLabelText("用相同句式表达你的想法")).toHaveValue("Please keep it longer.");
  expect(mocks.api).not.toHaveBeenCalled();
});
it("changes the reading preference immediately without saving or changing a conversation snapshot",async()=>{
  const view=render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  fireEvent.click(screen.getByRole("button",{name:"更多操作"}));fireEvent.click(screen.getByRole("button",{name:"修改设置"}));
  const dialog=await screen.findByRole("dialog",{name:"修改 Agent 设置"});
  fireEvent.change(within(dialog).getByLabelText("聊天字号"),{target:{value:"22"}});
  expect(document.querySelector(".aw-conversation-content").style.getPropertyValue("--aw-chat-font-size")).toBe("22px");
  expect(screen.getByText(thread.messages[0].content)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button",{name:"关闭 Agent 设置"}));expect(window.confirm).not.toHaveBeenCalled();
  expect(mocks.api.mock.calls.some(([,method])=>method==="PUT")).toBe(false);
  view.unmount();render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText(thread.messages[0].content);
  expect(document.querySelector(".aw-conversation-content").style.getPropertyValue("--aw-chat-font-size")).toBe("22px");
});
it("keeps all same-speaker messages and collection sources while grouping repeated metadata",async()=>{
  const original=mocks.api.getMockImplementation();
  const messages=[{segmentId:"old-voice",messageNo:1,owner:0,content:"First sentence.",createdAt:"2026-10-20T01:00:00Z"},{segmentId:"old-voice",messageNo:2,owner:0,content:"Another sentence.",createdAt:"2026-10-20T01:00:10Z"},{segmentId:"next-voice",messageNo:1,owner:0,content:"A new segment.",createdAt:"2026-10-20T01:00:15Z"}];
  mocks.api.mockImplementation(async(path,...args)=>path==="/agents/tony/open"?{agent:saved,conversation:{...thread,messages}}:original(path,...args));
  render(<AgentWorkspace userId="owner" onNavigate={vi.fn()}/>);await screen.findByText("Another sentence.");
  expect(document.querySelectorAll(".aw-message.is-continuation")).toHaveLength(1);
  expect(screen.getAllByRole("button",{name:"收藏词句"})).toHaveLength(3);
  expect(document.querySelectorAll(".aw-message" )).toHaveLength(3);
  expect(document.querySelector(".aw-thread-context")).toHaveTextContent("理发需求练习");
  expect(document.querySelector(".aw-context-level")).toHaveTextContent("B1");
});
