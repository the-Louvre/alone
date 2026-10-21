import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, BookOpenText, BriefcaseBusiness, Headphones, LayoutDashboard, MessagesSquare, Plus, Settings2 } from "lucide-react";
import "./landing.css";

const stages = [
  { title: "创建你的陪练", description: "从你想说好的那件事开始。" },
  { title: "开口，让对话继续", description: "让练习发生在真实交流中。" },
  { title: "把收获带走", description: "原话留在原位，下一次练什么由你决定。" },
];
const questions = [
  ["需要先准备好要说的话吗？", "不用。写下练习目标，选择或创建陪练，再从一次自然对话开始。"],
  ["IELTS 和面试也是普通陪练对话吗？", "不是。它们有独立的题目、材料、会话与反馈流程。"],
  ["转写消息和表达建议有什么不同？", "转写消息来自语音识别，也可能识别出错；词句训练中的建议不会覆盖原消息。发音疑问需要结合自己的原话核对。"],
  ["练过的词句会保存在哪里？", "从对话中提取的词句和后续练习记录，可以在学习资产中查看。"],
];

function Brand() {
  return <a className="landing-brand" href="#top" aria-label="UniSpeaking 首页"><img src="/brand/unispeaking-mark-next.svg" alt="" /><span><strong>Uni</strong>Speaking</span></a>;
}

function DashboardPreview({ playing }) {
  return <div className={`landing-dashboard${playing ? " is-playing" : ""}`} aria-label="UniSpeaking 工作台界面演示">
    <div className="landing-dashboard__body">
      <aside className="landing-dashboard__rail" aria-hidden="true"><img src="/brand/unispeaking-mark-next.svg" alt="" /><span className="is-current"><LayoutDashboard /></span><span><BookOpenText /></span><span><BriefcaseBusiness /></span><span><Settings2 /></span></aside>
      <aside className="landing-dashboard__agents" aria-hidden="true"><div><strong>我的陪练</strong><Plus /></div><span className="is-current">职场沟通搭档 <ArrowRight /></span><span>日常表达</span><span>旅行交流</span></aside>
      <div className="landing-dashboard__main"><div className="landing-dashboard__top"><span>我的陪练 <ArrowRight /> 职场沟通搭档</span><span>预览</span></div><div className="landing-dashboard__content">
        <div className="landing-dashboard__heading"><div><small>你的陪练</small><h2>职场沟通搭档</h2></div><span>开始练习 <ArrowUpRight /></span></div>
        <div className="landing-dashboard__editor"><div className="landing-dashboard__editor-main"><label>练习目标</label><p>在英文会议中，更清楚地解释自己的观点。</p><label>陪练设定</label><div className="landing-dashboard__prompt">围绕工作中的真实讨论，追问我的想法。让我把观点说完整，再给出自然的表达建议。</div></div><div className="landing-dashboard__editor-side"><span>声音 <b>自然对话</b></span><span>纠错方式 <b>平衡纠错</b></span><span>当前水平 <b>B1 · 中级</b></span></div></div>
        <div className="landing-dashboard__preview-line"><MessagesSquare /><span>从一次真实对话开始</span><AudioLines /></div>
      </div></div>
    </div>
  </div>;
}

function JourneyPanel({ stage, playing }) {
  return <article className={`landing-journey-screen landing-journey-screen--${stage}${playing ? " is-playing" : ""}`} aria-label={`第 ${stage + 1} 步：${stages[stage].title}`}>
    <header className="landing-journey-screen__heading"><span>0{stage + 1}</span><h3>{stages[stage].title}</h3></header>
    {stage === 0 && <div className="landing-journey-builder"><div className="landing-journey-fields"><div><strong>这次想练什么？</strong><span>在英文会议中更清楚地解释自己的观点。</span></div><div><strong>对话方式</strong><span>平衡纠错 · 保持对话流畅</span></div><p><b>职场沟通</b><b>B1 · 中级</b></p></div><div className="landing-journey-output"><small>你的陪练</small><div className="landing-journey-output__skeleton" aria-hidden="true"><i /><i /><i /></div><div className="landing-journey-output__result"><strong>职场沟通搭档</strong><p>围绕英文会议，练习观点解释与追问。</p><span>开始练习 <ArrowRight /></span></div></div></div>}
    {stage === 1 && <div className="landing-journey-conversation"><div className="landing-dialogue-line"><span>陪练</span><p>What would you change about your team's meetings?</p></div><div className="landing-dialogue-line"><span>你的转写消息</span><p>I want to explain my ideas more clearly.</p></div><div className="landing-audio-line"><AudioLines /><span>正在倾听</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /></div></div>}
    {stage === 2 && <div className="landing-journey-review"><div className="landing-review-line"><span>转写消息</span><p>I want to make my point more <mark>clear</mark>.</p></div><div className="landing-review-line"><span>提取的词句</span><p>make my point <small>表达我的观点</small></p></div><div className="landing-review-line"><span>接下来</span><p>用自己的句子再练一次。<strong>加入词句训练 <ArrowRight /></strong></p></div></div>}
  </article>;
}

export function LandingPage({ onStart, onLogin, onWeb, onSpecialty }) {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState({ hero: false, journey: false, evidence: false });
  const [openQuestion, setOpenQuestion] = useState(-1);
  const heroRef = useRef(null);
  const journeyRef = useRef(null);
  const evidenceRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    if (!window.IntersectionObserver || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const targets = [[heroRef, "hero"], [journeyRef, "journey"], [evidenceRef, "evidence"]];
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      const name = entry.target.dataset.motion;
      setPlaying((current) => current[name] === entry.isIntersecting ? current : { ...current, [name]: entry.isIntersecting });
    }), { threshold: 0.3 });
    targets.forEach(([ref, name]) => { if (ref.current) { ref.current.dataset.motion = name; observer.observe(ref.current); } });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const threshold = Math.min(220, window.innerHeight * 0.34);
      let current = 0;
      cardsRef.current.forEach((card, index) => {
        if (card?.getBoundingClientRect().top <= threshold) current = index;
      });
      setStage(current);
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) window.cancelAnimationFrame(frame); };
  }, []);

  return <main className="landing-page" id="top">
    <a className="landing-skip" href="#landing-main">跳到主要内容</a>
    <header className="landing-header"><div className="landing-header__inner"><Brand /><div className="landing-header__actions"><button type="button" className="landing-text-button" onClick={onLogin}>登录</button><button type="button" className="landing-button landing-button--dark" onClick={() => onStart()}>开始创建 <ArrowUpRight /></button></div></div></header>
    <div id="landing-main">
      <section className="landing-hero" aria-labelledby="landing-title"><div className="landing-container landing-hero__content"><h1 id="landing-title">口语陪练，<br />由你定义。</h1><button type="button" className="landing-button landing-button--dark landing-button--large" onClick={() => onStart()}>创建我的陪练 <ArrowUpRight /></button></div><div className="landing-hero__preview" ref={heroRef}><DashboardPreview playing={playing.hero} /></div></section>

      <section className="landing-journey" id="journey" ref={journeyRef} aria-labelledby="landing-journey-title"><div className="landing-container landing-journey__content"><div className="landing-journey__intro"><h2 id="landing-journey-title">从一次对话，<br />走向下一次进步。</h2></div><div className="landing-journey__stack">{stages.map((item, index) => <div className="landing-journey__card" key={item.title} ref={(node) => { cardsRef.current[index] = node; }}><JourneyPanel stage={index} playing={playing.journey && stage === index} /></div>)}</div></div></section>

      <section className="landing-directions" id="directions"><div className="landing-container landing-directions__heading"><h2>想练什么，<br />就从哪里开始。</h2><p>日常口语从自己的陪练出发。IELTS 和模拟面试保留各自的题目、材料与反馈流程。</p></div><div className="landing-directions__list"><button type="button" onClick={onWeb}><small>01 /</small><span><AudioLines /></span><strong>英语口语<em>日常交流 · 场景表达 · 角色扮演</em></strong><p>按你的目标与兴趣，选择持续练习的陪练。</p><ArrowUpRight /></button><button type="button" aria-label="开始体验 IELTS 口语" onClick={() => onSpecialty("ielts")}><small>02 /</small><span><BookOpenText /></span><strong>IELTS 口语<em>Part 1 / 2 / 3 · 专项练习</em></strong><p>按考试阶段和题目节奏练习，而非普通聊天。</p><ArrowUpRight /></button><button type="button" aria-label="开始体验英文面试" onClick={() => onSpecialty("interview")}><small>03 /</small><span><BriefcaseBusiness /></span><strong>模拟面试<em>岗位准备 · 问答追问 · 复盘</em></strong><p>围绕岗位与材料，把回答练得更清楚。</p><ArrowUpRight /></button></div></section>

      <section className="landing-evidence" id="evidence" ref={evidenceRef}><div className="landing-container landing-evidence__layout"><div><h2>字幕是记录，<br />建议是建议。</h2><p>语音识别可能听错，模型也可能凭上下文猜对你的意思。练习时把转写消息、模型回答和表达建议分开看，才更容易发现问题。</p><div className="landing-evidence__note"><Headphones /><span>发音存疑时，结合自己的原话核对；转写不自动改写。</span></div></div><div className={`landing-evidence-sheet${playing.evidence ? " is-playing" : ""}`} aria-label="对话与词句训练界面演示"><div className="landing-evidence-sheet__top"><span>一次练习 / 转写与词句</span><span>界面演示</span></div><div className="landing-evidence-sheet__question">“What would you change about the way your team works?”</div><div className="landing-evidence-sheet__row"><span>转写消息</span><strong>I want to make my point more <mark>clear</mark>.</strong></div><div className="landing-evidence-sheet__row"><span>提取词句</span><strong>make my point · 表达我的观点</strong></div><div className="landing-evidence-sheet__row"><span>表达建议</span><strong>在词句训练中查看，不会替换原始转写。</strong></div><div className="landing-evidence-sheet__footer"><AudioLines /><span>原话、词句与后续建议各有位置。</span></div></div></div></section>

      <section className="landing-assets" id="assets"><div className="landing-container landing-assets__layout"><div><h2>下一次练什么，<br />由你决定。</h2><p>从对话中挑出值得巩固的词句，按自己的节奏继续练。来源对话和练习记录都能在学习资产里找到。</p><button type="button" className="landing-inline-link" onClick={onWeb}>进入我的陪练 <ArrowUpRight /></button></div><div className="landing-assets__preview"><div><span>学习资产</span><small>你的词句</small></div><p>make my point</p><span>来自一次职场话题对话</span><div><span>来源对话</span><strong>开始练习 <ArrowRight /></strong></div></div></div></section>

      <section className="landing-faq" id="questions"><div className="landing-container landing-faq__layout"><h2>开始之前，<br />你可能想知道。</h2><div className="landing-faq__list">{questions.map(([question, answer], index) => <div key={question}><button type="button" aria-expanded={openQuestion === index} onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)}>{question}<Plus /></button>{openQuestion === index && <p>{answer}</p>}</div>)}</div></div></section>

      <section className="landing-closing"><div className="landing-container"><div className="landing-closing__brand"><img src="/brand/unispeaking-mark-next.svg" alt="" /><span>UniSpeaking</span></div><h2>从下一句开始，<br />练成自己的表达。</h2><button type="button" className="landing-button landing-button--dark landing-button--large" onClick={() => onStart()}>创建我的陪练 <ArrowUpRight /></button></div></section>
    </div>
    <footer className="landing-footer landing-container"><Brand /><span>越说，越会说。</span><nav aria-label="页脚导航"><a href="/pricing">价格方案</a><a href="/about">关于产品</a><a href="/help">帮助中心</a><a href="/about/privacy-policy">隐私政策</a><a href="/about/user-agreement">用户协议</a></nav></footer>
  </main>;
}
