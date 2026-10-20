export function sentences(text = "") {
  if (typeof Intl.Segmenter === "function") return [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)].map(({ segment }) => segment.trim()).filter(Boolean);
  return (text.match(/[^.!?。！？]+(?:[.!?。！？]+["'”’)]*|$)/g) || [text]).map((part) => part.trim()).filter(Boolean);
}
export function learningScope(item) {
  return item.scope || (item.kind === "word" ? "word" : sentences(item.text).length > 1 ? "passage" : "sentence");
}
export const learningLabel = (item) => ({ word: "词汇 / 词组", sentence: "句子", passage: "收藏内容" }[learningScope(item)]);
