/** Keep the user's own purpose as the title context; never generate a new topic. */
export function conversationContext(config) {
  const purpose = (config?.purpose || "").trim();
  const clauses = purpose.split(/[，,。！？!?；;\n]+/).map((part) => part.trim()).filter(Boolean);
  const first = (clauses[0] || "").replace(/^(?:我想模拟|我想练习|我希望|我想|想练习)\s*/, "").trim();
  if (!first) return config?.name || "历史对话";
  const pair = clauses[1] ? `${first} · ${clauses[1]}` : first;
  return Array.from(pair).length <= 24 ? pair : first;
}

export function continuesMessage(message, previous, fallbackSession) {
  if (!previous || previous.owner !== message.owner || (previous.segmentId || fallbackSession) !== (message.segmentId || fallbackSession)) return false;
  const current = Date.parse(message.createdAt), before = Date.parse(previous.createdAt);
  return Number.isFinite(current) && Number.isFinite(before) && current >= before && current - before <= 5 * 60 * 1000 && new Date(current).toDateString() === new Date(before).toDateString();
}
