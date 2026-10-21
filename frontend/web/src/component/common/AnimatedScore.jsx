import { useEffect, useState } from "react";

export function AnimatedScore({ value, decimals = 0 }) {
  const numeric = Number(value);
  const valid = value !== null && value !== undefined && value !== "" && Number.isFinite(numeric);
  const [shown, setShown] = useState(valid ? 0 : null);

  useEffect(() => {
    if (!valid) { setShown(null); return; }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(numeric); return; }
    let frame;
    const duration = 650;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      setShown(numeric * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numeric, valid]);

  const exact = valid ? numeric.toFixed(decimals) : "--";
  return <span className="animated-score"><span className="animated-score__visual" aria-hidden="true">{shown === null ? "--" : shown.toFixed(decimals)}</span><span className="animated-score__accessible">{exact}</span></span>;
}
