import { requestAuthenticated } from "../../infrastructure/http/apiClient.js";

const base = "/api/agent-workspace";
export function agentRequest(path, method = "GET", body, signal) {
  return requestAuthenticated(`${base}${path}`, {
    method, ...(body ? { body: JSON.stringify(body) } : {}), ...(signal ? { signal } : {}),
  });
}

export function agentSpeech(sessionId, messageNo, signal) {
  return requestAuthenticated(`${base}/conversations/${encodeURIComponent(sessionId)}/messages/${messageNo}/speech`, { method: "POST", responseType: "blob", signal });
}

export const presets = [
  {
    presetKey: "travel", name: "旅行搭子", purpose: "我下个月去伦敦，英语 B1，想练点餐和问路。像朋友一样聊天，别频繁打断我。",
    prompt: "你是我在伦敦的当地朋友，用自然、轻松的语气与我用英语交流。\n\n使用适合 B1 水平的常用词和短句，围绕餐厅点餐、问路和出行展开，每次只问一个问题。\n\n可以扮演店员或路人，给我表达的时间。我卡住时先提供简短线索，不直接替我回答。\n\n从一起在咖啡馆点餐开始，也可以跟随我的兴趣自然延伸话题。",
    level: "B1", voice: "Katerina", speed: 1, correction: "after",
  },
  {
    presetKey: "daily", name: "日常聊友", purpose: "聊聊生活、电影和周末计划，轻松幽默，我英语 A2，帮我慢慢开口。",
    prompt: "像一位自然、幽默的朋友，陪我用英语聊生活。使用 A2 难度的短句，每次只问一个问题。给我思考的时间，可以提示一个词，但不要替我说完。先问问我最近有什么开心的小事，顺着我的回答自然展开。",
    level: "A2", voice: "Tina", speed: 0.9, correction: "gentle",
  },
  {
    presetKey: "debate", name: "观点对练", purpose: "英语 B2，想讨论科技与生活。用开放问题追问，帮我把观点说清楚。",
    prompt: "作为有好奇心的讨论伙伴，和我用 B2 英语讨论科技与生活。尊重不同意见，温和地提出另一种视角。每次追问一个具体例子，让我有时间阐述理由。先问我科技改变了生活中的哪一件小事。",
    level: "B2", voice: "Harvey", speed: 1, correction: "on-request",
  },
];
export const blankAgent = () => ({ name: "新的对话伙伴", purpose: "", prompt: "", level: "B1", voice: "Katerina", speed: 1, correction: "after" });
export const fromSaved = (agent) => ({ ...agent.config, id: agent.id, version: agent.version });

export function readAgentDraft(userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(`unispeaking.agent-draft.${userId || "local"}`));
    if (typeof value?.config?.prompt === "string" && typeof value.config.purpose === "string") return value;
  } catch { /* Draft recovery is optional when browser storage is unavailable. */ }
  return { config: { ...presets[0] }, dirty: false };
}
