import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks=vi.hoisted(()=>({api:vi.fn(),speech:vi.fn()}));
vi.mock("../agentApi.js",()=>({agentRequest:mocks.api,agentSpeech:mocks.speech}));
import AgentMessageTools from "../AgentMessageTools.jsx";
import AgentReplyHint from "../AgentReplyHint.jsx";
beforeEach(()=>{vi.clearAllMocks();mocks.api.mockResolvedValue({text:"你好",meaning:"你好"});mocks.speech.mockResolvedValue(new Blob(["audio"]));});
afterEach(cleanup);
const props={message:{messageNo:2,content:"Hello there."},sessionId:"voice-original",live:false,collecting:false};
it("only requests assistance on demand and caches translation and speech for the source message",async()=>{
  const read=vi.fn();render(<AgentMessageTools {...props} onRead={read}/>);
  expect(mocks.api).not.toHaveBeenCalled();expect(mocks.speech).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"翻译",exact:true}));await screen.findByText("你好");
  expect(mocks.api).toHaveBeenCalledWith("/conversations/voice-original/messages/2/translation","POST",undefined,expect.any(AbortSignal));
  fireEvent.click(screen.getByRole("button",{name:"收起翻译"}));fireEvent.click(screen.getByRole("button",{name:"翻译",exact:true}));
  expect(mocks.api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button",{name:"听这句"}));await waitFor(()=>expect(read).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button",{name:"听这句"}));await waitFor(()=>expect(read).toHaveBeenCalledTimes(2));
  expect(mocks.speech).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledWith("voice-original:2",expect.any(Blob));
});
it("shows provider errors beside the message and allows retry without affecting collection",async()=>{
  const collect=vi.fn();mocks.api.mockRejectedValueOnce(new Error("翻译暂不可用"));
  render(<AgentMessageTools {...props} live onCollect={collect}/>);
  expect(screen.getByRole("button",{name:"听这句"})).toBeDisabled();
  fireEvent.click(screen.getByRole("button",{name:"翻译",exact:true}));expect(await screen.findByRole("alert")).toHaveTextContent("翻译暂不可用");
  fireEvent.click(screen.getByRole("button",{name:"收藏词句"}));expect(collect).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button",{name:"翻译",exact:true}));await screen.findByText("你好");expect(screen.queryByRole("alert")).toBeNull();
});
it("inserts a hint only after the user chooses it and invalidates it when context changes",async()=>{
  const use=vi.fn();mocks.api.mockResolvedValue({text:"Just a trim, please.",meaning:"请稍微修剪一下。"});
  const view=render(<AgentReplyHint threadId="thread-original" contextKey="one" onUse={use}/>);
  expect(mocks.api).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"接话建议"}));
  await screen.findByText("Just a trim, please.");expect(use).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"带入输入框"}));expect(use).toHaveBeenCalledWith("Just a trim, please.");
  fireEvent.click(screen.getByRole("button",{name:"关闭接话提示"}));fireEvent.click(screen.getByRole("button",{name:"接话建议"}));
  expect(mocks.api).toHaveBeenCalledTimes(1);
  view.rerender(<AgentReplyHint threadId="thread-original" contextKey="two" onUse={use}/>);
  expect(screen.queryByText("Just a trim, please.")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"接话建议"}));await screen.findByText("Just a trim, please.");expect(mocks.api).toHaveBeenCalledTimes(2);
});
it("aborts a hint request on context change and ignores its late result",async()=>{
  let resolve;mocks.api.mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const view=render(<AgentReplyHint threadId="thread-original" contextKey="one" onUse={vi.fn()}/>);
  fireEvent.click(screen.getByRole("button",{name:"接话建议"}));const signal=mocks.api.mock.calls[0][3];
  view.rerender(<AgentReplyHint threadId="thread-original" contextKey="two" onUse={vi.fn()}/>);expect(signal.aborted).toBe(true);
  resolve({text:"outdated",meaning:"过期"});await waitFor(()=>expect(screen.queryByText("outdated")).toBeNull());
});
