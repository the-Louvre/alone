import { useEffect, useState } from "react";

export const CHAT_FONT_SIZES = [16, 18, 20, 22];
const DEFAULT_SIZE = 18;
function read(key) {
  try { const size = JSON.parse(localStorage.getItem(key))?.fontSize; return CHAT_FONT_SIZES.includes(size) ? size : DEFAULT_SIZE; }
  catch { return DEFAULT_SIZE; }
}

/** Reading is a browser preference, separate from immutable conversation snapshots. */
export default function useReadingPreferences(userId) {
  const key = `unispeaking.reading.v1.${userId || "local"}`;
  const [record, setRecord] = useState(() => ({ key, fontSize: read(key), error: false }));
  const current = record.key === key ? record : { key, fontSize: read(key), error: false };
  function setFontSize(fontSize) {
    if (!CHAT_FONT_SIZES.includes(fontSize)) return;
    let error = false;
    try { localStorage.setItem(key, JSON.stringify({ fontSize })); } catch { error = true; }
    setRecord({ key, fontSize, error });
  }
  useEffect(() => {
    setRecord((previous) => previous.key === key ? previous : { key, fontSize: read(key), error: false });
    const receive = (event) => { if (event.key === key || event.key === null) setRecord({ key, fontSize: read(key), error: false }); };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, [key]);
  return { fontSize: current.fontSize, setFontSize, error: current.error };
}
