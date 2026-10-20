import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenText,
  Briefcase,
  CaretDown,
  Check,
  ChatCircleDots,
  List,
  Microphone,
  Sparkle,
  SpeakerHigh,
  X,
} from "@phosphor-icons/react";
import { plans, teachers } from "../../domain/content/data.js";
import "./landing.css";

const navigation = [
  { label: "产品", href: "#product" },
  { label: "练习方式", href: "#practice" },
  { label: "专项", href: "#paths" },
  { label: "常见问题", href: "#questions" },
];

const stages = [
  { number: "01", title: "定义陪练", description: "写下这次想练什么，调整声音、难度和纠错方式。" },
  { number: "02", title: "开始对话", description: "从你的目标开始说，在真实的来回中练习表达。" },
  { number: "03", title: "查看反馈", description: "对照字幕、表达建议与练习反馈，继续巩固表达。" },
];

const questions = [
  {
    question: "需要先准备好要说的话吗？",
    answer: "不需要。先写下练习目标，选择或创建陪练，就可以从一次自然对话开始。",
  },
  {
    question: "IELTS 和模拟面试也是普通聊天吗？",
    answer: "不是。它们保留独立的题目、材料、会话和反馈流程。进入后会按各自的训练步骤进行。",
  },
  {
    question: "字幕和表达建议有什么不同？",
    answer: "字幕反映语音识别结果，表达建议来自后续分析。语音识别也可能出错，不应把建议当作你实际说过的话。",
  },
  {
    question: "AI 反馈能替代正式考试评分吗？",
    answer: "不能。UniSpeaking 提供练习和复盘支持，不代表考试官方评分或正式语言诊断。",
  },
];

const mobileDownloadUrl = "http://fir.qiniuapi.com/v1zyqajm?utm_source=fir&utm_medium=qr";

function Brand() {
  return (
    <a className="landing-brand" href="#top" aria-label="UniSpeaking 首页">
      <img src="/brand/unispeaking-mark-next.svg" alt="" />
      <span><strong>Uni</strong>Speaking</span>
    </a>
  );
}

function ProductPreview({ stage }) {
  return (
    <div className="landing-preview" aria-label="UniSpeaking 产品界面演示">
      <div className="landing-preview__top">
        <span className="landing-preview__dots" aria-hidden="true"><i /><i /><i /></span>
        <span>UniSpeaking / 我的陪练</span>
        <span>界面演示</span>
      </div>
      <div className="landing-preview__body">
        <aside className="landing-preview__side" aria-hidden="true">
          <span className="landing-preview__side-brand">U</span>
          <span className="is-current">我的陪练</span>
          <span>英语口语</span>
          <span>IELTS 口语</span>
          <span>模拟面试</span>
          <span>学习资产</span>
        </aside>
        <div className="landing-preview__content" key={stage}>
          {stage === 0 && (
            <>
              <p className="landing-preview__crumb">我的陪练 / 创建陪练</p>
              <h3>把下一次对话，<br />练成你想要的样子。</h3>
              <div className="landing-preview__form">
                <label>这次想怎么聊<span>在英文会议中更清楚地表达观点</span></label>
                <label>对话提示词<span>追问具体例子，帮我把理由说明白。</span></label>
                <div className="landing-preview__options"><span>声音 · James</span><span>难度 · B2</span><span>纠错 · 聊完后</span></div>
              </div>
              <span className="landing-preview__action">用这段提示词开聊 <ArrowRight /></span>
            </>
          )}
          {stage === 1 && (
            <>
              <p className="landing-preview__crumb">我的陪练 / 观点对练</p>
              <h3>从一个问题，<br />开始真正的对话。</h3>
              <div className="landing-preview__dialogue">
                <p><small>陪练</small>What is one way technology has changed your daily life?</p>
                <p><small>你</small>It helps me stay in touch with my team, even when we work in different places.</p>
              </div>
              <div className="landing-preview__speaking"><span className="landing-preview__wave" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span><span>正在聆听</span><Microphone /></div>
            </>
          )}
          {stage === 2 && (
            <>
              <p className="landing-preview__crumb">本次练习 / 对话反馈</p>
              <h3>先看你说了什么，<br />再看怎样说得更好。</h3>
              <div className="landing-preview__review">
                <div><small>识别字幕</small><p>I want to make my point more clear.</p></div>
                <div><small>表达建议</small><p>I'd like to express my point more clearly.</p></div>
                <div><small>继续练习</small><p>试着用更清楚的句子再说一次。</p></div>
              </div>
              <span className="landing-preview__action">查看练习反馈 <ArrowRight /></span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function LandingPage({ onStart, onLogin, onWeb, onSpecialty }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [voiceId, setVoiceId] = useState(teachers[0]?.id);
  const [openQuestion, setOpenQuestion] = useState(0);
  const previewRef = useRef(null);
  const selectedTeacher = teachers.find((teacher) => teacher.id === voiceId) || teachers[0];

  useEffect(() => {
    document.body.classList.toggle("landing-menu-open", menuOpen);
    return () => document.body.classList.remove("landing-menu-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setPreviewVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setPreviewVisible(entry.isIntersecting), { threshold: 0.3 });
    if (previewRef.current) observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewVisible || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => setStage((current) => (current + 1) % stages.length), 4300);
    return () => window.clearInterval(timer);
  }, [previewVisible]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="landing-page" id="top">
      <header className="landing-header">
        <div className="landing-container landing-header__inner">
          <Brand />
          <nav className="landing-nav" aria-label="主导航">
            {navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          </nav>
          <div className="landing-header__actions">
            <button type="button" className="landing-text-button" onClick={onLogin}>登录</button>
            <button type="button" className="landing-button landing-button--dark" onClick={() => onStart()}>开始练习 <ArrowUpRight /></button>
          </div>
          <button type="button" className="landing-menu-toggle" aria-label={menuOpen ? "关闭菜单" : "打开菜单"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X /> : <List />}
          </button>
        </div>
        {menuOpen && (
          <div className="landing-mobile-menu">
            <nav aria-label="移动端主导航">{navigation.map((item) => <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>)}</nav>
            <button type="button" onClick={() => { closeMenu(); onLogin(); }}>登录</button>
            <button type="button" onClick={() => { closeMenu(); onStart(); }}>开始练习</button>
          </div>
        )}
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-container">
          <h1 id="landing-title">口语陪练，<br />由你定义。</h1>
          <div className="landing-hero__actions">
            <button type="button" className="landing-button landing-button--dark landing-button--large" onClick={() => onStart()}>创建我的陪练 <ArrowUpRight /></button>
          </div>
        </div>
      </section>

      <section className="landing-product landing-section" id="product" ref={previewRef}>
        <div className="landing-container">
          <div className="landing-section-heading">
            <div><span>UniSpeaking</span><h2>从你的目标开始，<br />把练习还给你。</h2></div>
            <p>定义对话方向，开口交流，回头核对自己的表达。每一步都在同一个练习空间里完成。</p>
          </div>
          <div className="landing-product__steps" role="group" aria-label="产品演示步骤">
            {stages.map((item, index) => (
              <button key={item.number} type="button" className={stage === index ? "is-active" : ""} aria-pressed={stage === index} onClick={() => setStage(index)}>
                <span>{item.number}</span><strong>{item.title}</strong><small>{item.description}</small>
              </button>
            ))}
          </div>
          <ProductPreview stage={stage} />
        </div>
      </section>

      <section className="landing-practice landing-section" id="practice">
        <div className="landing-container landing-practice__layout">
          <div><span className="landing-kicker">练习的节奏</span><h2>对话，不只是一句回答。</h2><p>从开始到复盘，围绕一个真实目标持续练习。你可以按自己的水平和习惯调整陪练。</p><button type="button" className="landing-inline-link" onClick={onWeb}>进入 Web <ArrowUpRight /></button></div>
          <ol>
            <li><Sparkle /><div><strong>选择或创建陪练</strong><span>写下目标，决定声音、难度与纠错方式。</span></div></li>
            <li><Microphone /><div><strong>自然开口</strong><span>用语音或文字开始，保持对话的真实来回。</span></div></li>
            <li><BookOpenText /><div><strong>核对并积累</strong><span>原始字幕与表达建议分开呈现，练习记录留在学习资产里。</span></div></li>
          </ol>
        </div>
      </section>

      <section className="landing-paths landing-section" id="paths">
        <div className="landing-container">
          <div className="landing-section-heading"><div><span>训练方向</span><h2>不同目标，<br />有不同的练法。</h2></div><p>日常交流、IELTS 口语与模拟面试各有自己的入口和训练过程。</p></div>
          <div className="landing-paths__list">
            <button type="button" onClick={onWeb}><span>01</span><ChatCircleDots /><strong>英语口语<small>日常交流 · 场景表达 · 自由对话</small></strong><ArrowUpRight /></button>
            <button type="button" aria-label="开始体验 IELTS 口语" onClick={() => onSpecialty("ielts")}><span>02</span><BookOpenText /><strong>IELTS 口语<small>Part 1 / 2 / 3 · 专项练习</small></strong><ArrowUpRight /></button>
            <button type="button" aria-label="开始体验英文面试" onClick={() => onSpecialty("interview")}><span>03</span><Briefcase /><strong>模拟面试<small>岗位准备 · 问答追问 · 复盘</small></strong><ArrowUpRight /></button>
          </div>
        </div>
      </section>

      <section className="landing-voices landing-section" id="voices">
        <div className="landing-container landing-voices__layout">
          <div><span className="landing-kicker">声音选择</span><h2>找到适合你的<br />对话声音。</h2><p>试听不同口音，再决定这次练习由谁与你对话。</p></div>
          <div className="landing-voices__selector">
            <div className="landing-voices__list" aria-label="AI 老师列表">
              {teachers.map((teacher) => (
                <button key={teacher.id} type="button" className={selectedTeacher?.id === teacher.id ? "is-active" : ""} aria-pressed={selectedTeacher?.id === teacher.id} onClick={() => setVoiceId(teacher.id)}>
                  <span>{teacher.name}</span><small>{teacher.accent}</small><ArrowRight />
                </button>
              ))}
            </div>
            {selectedTeacher && <div className="landing-voices__detail"><SpeakerHigh /><strong>{selectedTeacher.name} · {selectedTeacher.accent}</strong><audio controls preload="none" src={selectedTeacher.previewAudio} aria-label={`试听 ${selectedTeacher.name} 的声音`} /><button type="button" className="landing-button landing-button--dark" onClick={() => onStart(selectedTeacher.voiceId)}>用这个声音开始 <ArrowUpRight /></button></div>}
          </div>
        </div>
      </section>

      <section className="landing-pricing landing-section" id="pricing">
        <div className="landing-container">
          <div className="landing-section-heading"><div><span>会员方案</span><h2>先开始练习，<br />再选择自己的节奏。</h2></div><p>下面是当前产品中的方案展示；具体权益和价格以正式发布版本为准。</p></div>
          <div className="landing-pricing__grid">
            {plans.map((plan) => <article key={plan.id}><h3>{plan.name}</h3><p>{plan.desc}</p><div className="landing-pricing__price">{plan.price === "0" ? "免费" : `¥${plan.price}`}<small>{plan.suffix}</small></div><ul>{plan.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul><button type="button" className="landing-inline-link" onClick={() => onStart()}>{plan.id === "free" ? "免费开始" : "了解方案"} <ArrowUpRight /></button></article>)}
          </div>
          <p className="landing-pricing__note">会员支付尚未开放；此处不提供购买操作。</p>
        </div>
      </section>

      <section className="landing-faq landing-section" id="questions">
        <div className="landing-container landing-faq__layout">
          <div><span className="landing-kicker">常见问题</span><h2>开始之前，<br />你可能想知道。</h2><a className="landing-inline-link" href="/help">访问帮助中心 <ArrowUpRight /></a></div>
          <div className="landing-faq__list">{questions.map((item, index) => <article key={item.question}><button type="button" aria-expanded={openQuestion === index} onClick={() => setOpenQuestion(openQuestion === index ? -1 : index)}>{item.question}<CaretDown /></button>{openQuestion === index && <p>{item.answer}</p>}</article>)}</div>
        </div>
      </section>

      <section className="landing-closing"><div className="landing-container"><h2>从下一句开始，<br />练成自己的表达。</h2><button type="button" className="landing-button landing-button--light landing-button--large" onClick={() => onStart()}>创建我的陪练 <ArrowUpRight /></button></div></section>

      <footer className="landing-footer"><div className="landing-container"><Brand /><nav aria-label="页脚导航"><a href="/about">关于产品</a><a href="/help">帮助中心</a><a href="/about/privacy-policy">隐私政策</a><a href="/about/user-agreement">用户协议</a><a href={mobileDownloadUrl} target="_blank" rel="noreferrer">移动端下载</a></nav><small>© 2026 UniSpeaking</small></div></footer>
    </main>
  );
}
