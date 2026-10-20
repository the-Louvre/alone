import { renderHook, act, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import useConversationDraft from "../useConversationDraft.js";
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("persists text, explicit mode and request IDs immediately and restores them after remount", () => {
  let first = renderHook(() => useConversationDraft("owner"));
  act(() => { first.result.current.activate("thread:one"); first.result.current.setMode("text"); first.result.current.setText("Keep the length."); first.result.current.patch({request:{requestId:"same-request",text:"Keep the length."}}); });
  first.unmount(); const second = renderHook(() => useConversationDraft("owner"));
  act(() => second.result.current.activate("thread:one"));
  expect(second.result.current.text).toBe("Keep the length.");expect(second.result.current.mode).toBe("text");expect(second.result.current.request.requestId).toBe("same-request");
});
it("keeps empty text-mode preference and separates users, threads and new drafts", () => {
  const {result}=renderHook(()=>useConversationDraft("one"));
  act(()=>{result.current.activate("thread:a");result.current.setMode("text");result.current.setText("Old draft");result.current.activate("new:a");result.current.setText("New draft");result.current.activate("thread:b");});
  expect(result.current.text).toBe("");act(()=>result.current.activate("thread:a"));expect(result.current.text).toBe("Old draft");
  act(()=>{result.current.clearSent("Old draft");result.current.activate("new:a");});expect(result.current.text).toBe("New draft");
  act(()=>result.current.activate("thread:a"));expect(result.current.mode).toBe("text");expect(result.current.text).toBe("");
  const other=renderHook(()=>useConversationDraft("two"));act(()=>other.result.current.activate("thread:a"));expect(other.result.current.text).toBe("");
});
it("promotes an unsent draft without losing retry identity, then clears only the sent revision",()=>{
  const {result}=renderHook(()=>useConversationDraft("owner"));let id;
  act(()=>{id=result.current.activate("new:agent").creationId;result.current.setText("First");result.current.patch({request:{requestId:"retry"}});result.current.promote("thread:real");});
  expect(result.current.creationId).toBe(id);expect(result.current.request.requestId).toBe("retry");expect(result.current.read("new:agent")).toBeNull();
  act(()=>{result.current.setText("A newer input");result.current.clearSent("First");});expect(result.current.text).toBe("A newer input");
});
it("preserves the previous storage entry when promotion fails, and reports the unavailable store",()=>{
  const {result}=renderHook(()=>useConversationDraft("owner"));act(()=>{result.current.activate("new:agent");result.current.setText("Never lose this");});
  const original=Storage.prototype.setItem;vi.spyOn(Storage.prototype,"setItem").mockImplementation(function(key,value){if(key.includes("thread:real"))throw new DOMException("full","QuotaExceededError");return original.call(this,key,value);});
  act(()=>result.current.promote("thread:real"));expect(result.current.text).toBe("Never lose this");expect(result.current.storageError).toBe(true);expect(result.current.read("new:agent").text).toBe("Never lose this");
});
it("retains both versions when another tab edits the active draft",()=>{
  const {result}=renderHook(()=>useConversationDraft("owner"));act(()=>{result.current.activate("thread:one");result.current.setText("This tab");});
  const key="unispeaking.draft.v2.owner.chat.thread:one";
  const remote={...JSON.parse(localStorage.getItem(key)),text:"Other tab",writer:"other",revision:"remote"};localStorage.setItem(key,JSON.stringify(remote));
  act(()=>window.dispatchEvent(new StorageEvent("storage",{key,newValue:JSON.stringify(remote)})));
  expect(result.current.text).toBe("This tab");expect(result.current.alternate.text).toBe("Other tab");
  act(()=>result.current.recoverAlternate());expect(result.current.text).toBe("Other tab");expect(result.current.alternate.text).toBe("This tab");
  act(()=>result.current.recoverAlternate());expect(result.current.text).toBe("This tab");
});
it("migrates the previous tab draft without allowing an initial empty render to overwrite it",()=>{
  sessionStorage.setItem("unispeaking.chat-draft.owner.original","Legacy draft");
  const {result}=renderHook(()=>useConversationDraft("owner"));act(()=>result.current.activate("thread:original","voice",{legacyKey:"original"}));expect(result.current.text).toBe("Legacy draft");
});
