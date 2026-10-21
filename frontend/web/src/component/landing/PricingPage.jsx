import { ArrowLeft, ArrowUpRight, Check } from "lucide-react";
import { plans } from "../../domain/content/data.js";
import "./landing.css";

export function PricingPage({ onStart, onLogin, onChoosePaid, signedIn = false }) {
  return <main className="landing-page landing-pricing-page">
    <header className="landing-header"><div className="landing-header__inner">
      <a className="landing-brand" href="/" aria-label="UniSpeaking 首页"><img src="/brand/unispeaking-mark-next.svg" alt="" /><span><strong>Uni</strong>Speaking</span></a>
      <div className="landing-header__actions"><button type="button" className="landing-text-button" onClick={onLogin}>{signedIn ? "我的工作区" : "登录"}</button><button type="button" className="landing-button landing-button--dark" onClick={onStart}>开始创建 <ArrowUpRight /></button></div>
    </div></header>
    <div className="landing-container landing-pricing-page__body">
      <a className="landing-pricing-page__back" href="/"><ArrowLeft />返回首页</a>
      <div className="landing-pricing-page__intro"><h1>选择适合你的<br />练习节奏。</h1><p>从每天开口，到持续练习，再到专项备考。方案与额度沿用当前产品设置。</p></div>
      <div className="landing-pricing-page__plans">{plans.map((plan) => <article key={plan.id} className={plan.id === "pro" ? "is-featured" : ""}>
        <div className="landing-pricing-page__plan-top"><h2>{plan.name}</h2>{plan.id === "pro" && <span>常用选择</span>}</div>
        <p className="landing-pricing-page__description">{plan.desc}</p>
        <p className="landing-pricing-page__price"><small>¥</small><strong>{plan.price}</strong><span>{plan.suffix || "永久免费"}</span></p>
        <ul>{plan.features.map((feature) => <li key={feature}><Check />{feature}</li>)}</ul>
        <button type="button" className={`landing-button ${plan.id === "pro" ? "landing-button--dark" : ""}`} onClick={plan.id === "free" ? onStart : onChoosePaid}>{plan.id === "free" ? "免费开始" : signedIn ? "查看会员权益" : "注册后查看"}<ArrowUpRight /></button>
      </article>)}</div>
      <p className="landing-pricing-page__notice">当前会员支付为产品演示，不会产生真实扣款。具体可用权益以登录后的会员页面为准。</p>
    </div>
    <footer className="landing-footer landing-container"><span>UniSpeaking</span><nav aria-label="页脚导航"><a href="/">首页</a><a href="/about">关于产品</a><a href="/help">帮助中心</a></nav></footer>
  </main>;
}
