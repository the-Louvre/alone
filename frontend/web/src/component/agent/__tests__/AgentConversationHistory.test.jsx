import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("../agentApi.js", () => ({ agentRequest: api }));
import History from "../AgentConversationHistory.jsx";
const record = { threadId: "thread-one", config: { name: "托尼" }, createdAt: "2026-10-19T13:30:00Z", messageCount: 7, preview: "Just a trim, please." };
let deleted;
beforeEach(() => {
  deleted = false; vi.clearAllMocks();
  api.mockImplementation(async (path, method) => {
    if (path === "/threads/thread-one" && method === "DELETE") { deleted = true; return { deleted: true }; }
    if (path === "/threads/thread-one/restore") { deleted = false; return { restored: true }; }
    if (path.startsWith("/threads?")) return path.includes("deleted=true") === deleted ? [record] : [];
    return [];
  });
});
afterEach(cleanup);
const setup = (props = {}) => render(<History agentId="agent-one" agentName="托尼" onClose={vi.fn()} onOpen={vi.fn()} {...props} />);
const remove = async () => fireEvent.click(await screen.findByRole("button", { name: /^删除托尼的对话/ }));
it("requires confirmation and cancellation never calls delete", async () => {
  setup(); await remove();
  expect(screen.getByRole("heading", { name: "删除这段对话？" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(false);
  expect(await screen.findByRole("button", { name: /^删除托尼的对话/ })).toHaveFocus();
});
it("removes only after success and restores the same conversation from trash", async () => {
  const removed = vi.fn(); setup({ onRemoved: removed }); await remove();
  fireEvent.click(screen.getByRole("button", { name: "移入回收站", exact: true }));
  expect(await screen.findByText("已移入回收站，可随时恢复。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^删除托尼的对话/ })).toBeNull();
  expect(removed).toHaveBeenCalledWith(record);
  fireEvent.click(screen.getByRole("button", { name: "回收站", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: /^恢复托尼的对话/ }));
  expect(await screen.findByText("已恢复，可在对话记录中打开。")).toBeInTheDocument();
  expect(api).toHaveBeenCalledWith("/threads/thread-one/restore", "POST");
  fireEvent.click(screen.getByRole("button", { name: "返回记录" }));
  expect(await screen.findByRole("button", { name: /^删除托尼的对话/ })).toBeInTheDocument();
});
it("keeps the record and confirmation when deletion fails", async () => {
  const original = api.getMockImplementation();
  api.mockImplementation((path, method) => method === "DELETE" ? Promise.reject(new Error("网络中断")) : original(path, method));
  const removed = vi.fn(); setup({ onRemoved: removed }); await remove();
  fireEvent.click(screen.getByRole("button", { name: "移入回收站", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("网络中断");
  expect(removed).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "取消" }));
  expect(await screen.findByRole("button", { name: /^删除托尼的对话/ })).toBeInTheDocument();
});
it("blocks current history deletion while voice or message saving is active", async () => {
  setup({ currentThreadId: "thread-one", deleteBlocked: "请先结束语音，再删除当前对话" });
  const button = await screen.findByRole("button", { name: /^删除托尼的对话/ });
  expect(button).toBeDisabled(); expect(button).toHaveAttribute("title", "请先结束语音，再删除当前对话");
  fireEvent.click(button); expect(api.mock.calls.some(([, method]) => method === "DELETE")).toBe(false);
});
it("supports deleting legacy recordings independently of Agent threads", async () => {
  api.mockImplementation(async (path) => path.startsWith("/legacy-conversations") ? [{ sessionId: "legacy-one", createdAt: record.createdAt, messageCount: 1 }] : []);
  setup(); fireEvent.click(screen.getByRole("button", { name: "全部 Agent" }));
  fireEvent.click(await screen.findByRole("button", { name: /^删除旧版语音对话的对话/ }));
  fireEvent.click(screen.getByRole("button", { name: "移入回收站", exact: true }));
  await waitFor(() => expect(api).toHaveBeenCalledWith("/legacy-conversations/legacy-one", "DELETE"));
});
