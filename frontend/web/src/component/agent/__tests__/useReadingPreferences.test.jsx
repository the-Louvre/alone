import { renderHook, act, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import useReadingPreferences from "../useReadingPreferences.js";
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("applies immediately, restores after remount, and isolates accounts", () => {
  const one=renderHook(()=>useReadingPreferences("one"));expect(one.result.current.fontSize).toBe(18);
  act(()=>one.result.current.setFontSize(22));expect(one.result.current.fontSize).toBe(22);one.unmount();
  const restored=renderHook(()=>useReadingPreferences("one"));expect(restored.result.current.fontSize).toBe(22);
  const other=renderHook(()=>useReadingPreferences("two"));expect(other.result.current.fontSize).toBe(18);
});
it("ignores corrupt saved data and unsupported input", () => {
  localStorage.setItem("unispeaking.reading.v1.one",'{"fontSize":999}');
  const {result}=renderHook(()=>useReadingPreferences("one"));expect(result.current.fontSize).toBe(18);
  act(()=>result.current.setFontSize(999));expect(result.current.fontSize).toBe(18);
});
it("keeps reading usable when browser storage fails and reports the limitation", () => {
  vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new DOMException("blocked","SecurityError")});
  const {result}=renderHook(()=>useReadingPreferences("one"));act(()=>result.current.setFontSize(20));
  expect(result.current.fontSize).toBe(20);expect(result.current.error).toBe(true);
});
it("synchronizes another tab's preference without writing default settings over it", () => {
  const {result}=renderHook(()=>useReadingPreferences("one"));
  const key="unispeaking.reading.v1.one";localStorage.setItem(key,'{"fontSize":16}');
  act(()=>window.dispatchEvent(new StorageEvent("storage",{key,newValue:'{"fontSize":16}'})));
  expect(result.current.fontSize).toBe(16);
  localStorage.removeItem(key);act(()=>window.dispatchEvent(new StorageEvent("storage",{key,newValue:null})));
  expect(result.current.fontSize).toBe(18);
});
