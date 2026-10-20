import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../agentApi.js", () => ({ agentRequest: api }));
import Assets from "../AgentLearningAssets.jsx";
const word = { id: "word-one", sessionId: "session-one", kind: "word", text: "trim", meaning: "修剪" };
const attempt = { id: "attempt-one", sessionId: "session-one", text: "trim", answer: "I need a trim.", feedback: "A natural expression.", createdAt: "2026-10-20T01:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  api.mockImplementation(async (path) => path === "/learning" ? [word] : []);
});
afterEach(cleanup);
const setup = (props = {}) => render(<Assets onOpenConversation={vi.fn()} {...props} />);
it("shows collected words even if the practice history endpoint fails", async () => {
  const original = api.getMockImplementation();
  api.mockImplementation((path) => path === "/attempts" ? Promise.reject(new Error("服务器内部错误")) : original(path));
  setup();
  expect(await screen.findByText("trim")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "练习记录", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("练习记录读取失败：服务器内部错误");
  expect(screen.queryByText("完成一次词句练习，反馈会保存在这里。")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "词汇", exact: true }));
  expect(await screen.findByText("trim")).toBeInTheDocument();expect(screen.queryByRole("alert")).toBeNull();
});
it("retries only the failed section and clears its error after recovery", async () => {
  let calls = 0;const original = api.getMockImplementation();
  api.mockImplementation((path) => path === "/attempts" ? calls++ === 0 ? Promise.reject(new Error("连接中断")) : Promise.resolve([attempt]) : original(path));
  setup({ initialTab: "practice" });
  expect(await screen.findByRole("alert")).toHaveTextContent("练习记录读取失败");
  fireEvent.click(screen.getByRole("button", { name: "重试读取" }));
  expect(await screen.findByText("你的表达：I need a trim.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(api.mock.calls.filter(([path]) => path === "/attempts")).toHaveLength(2);
  expect(api.mock.calls.filter(([path]) => path === "/learning")).toHaveLength(1);
});
it("a slow practice history request cannot keep words in a loading state", async () => {
  let complete;const pending = new Promise((resolve) => { complete = resolve; });
  const original = api.getMockImplementation();api.mockImplementation((path) => path === "/attempts" ? pending : original(path));
  setup();expect(await screen.findByText("trim")).toBeInTheDocument();
  expect(screen.queryByText("正在读取学习资产…")).toBeNull();
  await act(async () => complete([]));
});
it("shows a failed word request as an error with retry rather than an empty collection", async () => {
  api.mockImplementation((path) => path === "/learning" ? Promise.reject(new Error("暂不可用")) : Promise.resolve([]));
  const { unmount } = setup();
  expect(await screen.findByRole("alert")).toHaveTextContent("词句读取失败：暂不可用");
  expect(screen.queryByRole("heading", { name: "把有用的表达留下来" })).toBeNull();
  const signal = api.mock.calls.find(([path]) => path === "/learning")[3];
  expect(signal.aborted).toBe(false);unmount();expect(signal.aborted).toBe(true);
});
it("retains successful practice feedback even when refreshing history fails", async () => {
  let reads = 0;
  api.mockImplementation(async (path) => {
    if (path === "/learning") return [word];
    if (path === "/learning/word-one/attempts") return { feedback: "Your expression is natural." };
    if (path === "/attempts" && reads++ > 0) throw new Error("连接中断");
    return [];
  });
  setup();fireEvent.click(await screen.findByRole("button", { name: "造句练习" }));
  fireEvent.change(screen.getByLabelText("用这个表达造一句话"), { target: { value: "I need a trim." } });
  fireEvent.click(screen.getByRole("button", { name: "提交造句" }));
  expect(await screen.findByText("Your expression is natural.")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "关闭造句练习" })).toBeEnabled());
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "关闭造句练习" }));
  fireEvent.click(screen.getByRole("button", { name: "练习记录", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("练习记录读取失败");
});
it("opens an old passage collection with sentence selection before practice", async () => {
  api.mockImplementation(async (path) => path === "/learning" ? [{...word,id:"old-passage",kind:"sentence",text:"Keep the length. Tidy up the ends."}] : []);
  setup();fireEvent.click(await screen.findByRole("button",{name:"造句练习"}));
  expect(await screen.findByRole("button",{name:"Keep the length."})).toBeInTheDocument();
  expect(screen.queryByLabelText("用相同句式表达你的想法")).toBeNull();
  expect(api.mock.calls.some(([path,method])=>path.includes("/learning/")&&method==="POST")).toBe(false);
});
