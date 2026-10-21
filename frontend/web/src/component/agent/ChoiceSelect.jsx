import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

export function ChoiceSelect({ id, label, value, options, onChange, disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => String(option.value) === String(value)));

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    optionRefs.current[selectedIndex]?.focus();
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open, selectedIndex]);

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) { setOpen(true); return; }
    const focusedIndex = optionRefs.current.indexOf(document.activeElement);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (focusedIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return <div ref={rootRef} className={`aw-choice ${open ? "is-open" : ""} ${className}`} onKeyDown={onKeyDown}>
    <button ref={triggerRef} id={id} type="button" className="aw-choice__trigger" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-options`} disabled={disabled} onClick={() => setOpen(!open)}>
      <span>{options[selectedIndex]?.label}</span><CaretDown aria-hidden="true" />
    </button>
    {open && <div id={`${id}-options`} className="aw-choice__menu" role="listbox" aria-label={label}>
      {options.map((option, index) => <button ref={(node) => { optionRefs.current[index] = node; }} key={option.value} type="button" role="option" aria-selected={index === selectedIndex} className={index === selectedIndex ? "is-selected" : ""} onClick={() => choose(option)}><span>{option.label}</span>{index === selectedIndex && <Check aria-hidden="true" />}</button>)}
    </div>}
  </div>;
}
