import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PricingPage } from "../PricingPage.jsx";

afterEach(() => cleanup());

describe("PricingPage", () => {
  it("shows the existing plans and connects the public actions", () => {
    const onStart = vi.fn();
    const onLogin = vi.fn();
    const onChoosePaid = vi.fn();
    render(<PricingPage onStart={onStart} onLogin={onLogin} onChoosePaid={onChoosePaid} />);

    expect(screen.getByRole("heading", { name: /选择适合你的.*练习节奏/ })).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument();
    expect(screen.getByText(/不会产生真实扣款/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
    fireEvent.click(screen.getByRole("button", { name: "免费开始" }));
    fireEvent.click(screen.getAllByRole("button", { name: "注册后查看" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onChoosePaid).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("labels the signed-in route to the existing membership screen", () => {
    const onChoosePaid = vi.fn();
    render(<PricingPage onStart={vi.fn()} onLogin={vi.fn()} onChoosePaid={onChoosePaid} signedIn />);
    expect(screen.getByRole("button", { name: "我的工作区" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "查看会员权益" })[0]);
    expect(onChoosePaid).toHaveBeenCalledTimes(1);
  });
});
