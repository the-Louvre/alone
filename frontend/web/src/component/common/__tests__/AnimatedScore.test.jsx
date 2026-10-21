import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedScore } from "../AnimatedScore.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AnimatedScore", () => {
  it("always exposes the exact score to assistive technology", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    render(<AnimatedScore value={7.5} decimals={1} />);
    expect(screen.getByText("7.5")).toBeInTheDocument();
    expect(screen.getByText("0.0")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows no score when evaluation is unavailable", () => {
    render(<AnimatedScore value={null} decimals={1} />);
    expect(screen.getByText("--", { selector: ".animated-score__accessible" })).toBeInTheDocument();
  });
});
