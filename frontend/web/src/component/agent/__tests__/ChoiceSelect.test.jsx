import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChoiceSelect } from "../ChoiceSelect.jsx";

const options = [
  { value: "slow", label: "慢速" },
  { value: "normal", label: "正常" },
  { value: "fast", label: "快速" },
];

afterEach(cleanup);

describe("ChoiceSelect", () => {
  it("selects an option and closes the menu", () => {
    const onChange = vi.fn();
    render(<ChoiceSelect id="speed" label="语速" value="normal" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox", { name: "语速" }));
    fireEvent.click(screen.getByRole("option", { name: "快速" }));
    expect(onChange).toHaveBeenCalledWith("fast");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports keyboard navigation and escape", () => {
    render(<ChoiceSelect id="speed" label="语速" value="normal" options={options} onChange={vi.fn()} />);
    const trigger = screen.getByRole("combobox", { name: "语速" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "正常" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("option", { name: "正常" }), { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "快速" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("option", { name: "快速" }), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("does not open when disabled", () => {
    render(<ChoiceSelect id="speed" label="语速" value="normal" options={options} onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("combobox", { name: "语速" });
    fireEvent.click(trigger);
    expect(trigger).toBeDisabled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
