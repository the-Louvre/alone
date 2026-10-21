import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "../LandingPage.jsx";

afterEach(() => cleanup());

describe("LandingPage", () => {
  it("renders the approved landing flow and wires real app entry points", () => {
    const onStart = vi.fn();
    const onLogin = vi.fn();
    const onWeb = vi.fn();
    const onSpecialty = vi.fn();
    render(<LandingPage onStart={onStart} onLogin={onLogin} onWeb={onWeb} onSpecialty={onSpecialty} />);

    expect(screen.getByRole("heading", { name: /口语陪练.*由你定义/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /从一次对话.*走向下一次进步/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /AI 老师/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始创建" }));
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    fireEvent.click(screen.getByRole("button", { name: "进入我的陪练" }));
    fireEvent.click(screen.getByRole("button", { name: "开始体验 IELTS 口语" }));
    fireEvent.click(screen.getByRole("button", { name: "开始体验英文面试" }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onWeb).toHaveBeenCalledTimes(1);
    expect(onSpecialty).toHaveBeenNthCalledWith(1, "ielts");
    expect(onSpecialty).toHaveBeenNthCalledWith(2, "interview");
  });

  it("keeps the compact header, FAQ, and closing action usable", () => {
    const onStart = vi.fn();
    render(<LandingPage onStart={onStart} onLogin={vi.fn()} onWeb={vi.fn()} onSpecialty={vi.fn()} />);

    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#landing-main");
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();
    const questions = screen.getAllByRole("button", { name: /吗？|什么？/ });
    expect(questions[0]).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(questions[0]);
    expect(questions[0]).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(questions[1]);
    expect(questions[1]).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getAllByRole("button", { name: "创建我的陪练" })[1]);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("navigation", { name: "页脚导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "价格方案" })).toHaveAttribute("href", "/pricing");
  });

  it("shows three distinct product demonstrations inside the scrolling cards", () => {
    render(<LandingPage onStart={vi.fn()} onLogin={vi.fn()} onWeb={vi.fn()} onSpecialty={vi.fn()} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "第 1 步：创建你的陪练" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "第 2 步：开口，让对话继续" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "第 3 步：把收获带走" })).toBeInTheDocument();
    expect(screen.getByText("这次想练什么？")).toBeInTheDocument();
    expect(screen.getByText("你的转写消息")).toBeInTheDocument();
    expect(screen.getByText("提取的词句")).toBeInTheDocument();
  });
});
