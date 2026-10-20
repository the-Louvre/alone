import { it, expect } from "vitest";
import { conversationContext, continuesMessage } from "../conversationPresentation.js";
it("uses the saved purpose without inventing a different goal or reading the prompt",()=>{
  expect(conversationContext({name:"托尼",purpose:"我想模拟去理发店剪头发，跟理发店老板说明自己的需求并且回答理发师的问题",prompt:"another subject"})).toBe("去理发店剪头发");
  expect(conversationContext({name:"自定义",purpose:"聊聊电影"})).toBe("聊聊电影");
  expect(conversationContext({name:"旧伙伴"})).toBe("旧伙伴");
});
it("does not merge timestamps across different days, long pauses, missing times, or speakers",()=>{
  const before={owner:0,segmentId:"a",createdAt:"2026-10-20T01:00:00Z"};
  expect(continuesMessage({...before,createdAt:"2026-10-20T01:00:30Z"},before)).toBe(true);
  expect(continuesMessage({...before,createdAt:"2026-10-20T01:06:00Z"},before)).toBe(false);
  expect(continuesMessage({...before,owner:1},before)).toBe(false);
  expect(continuesMessage({...before,segmentId:"b"},before)).toBe(false);
  expect(continuesMessage({...before,createdAt:null},before)).toBe(false);
});
