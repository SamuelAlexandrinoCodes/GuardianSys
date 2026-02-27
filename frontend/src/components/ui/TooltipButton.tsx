import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { createPortal } from "react-dom";

export const TooltipButton = forwardRef<
  HTMLButtonElement,
  { label: string; children: React.ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function TooltipButton({ label, children, className = "", ...props }, ref) {
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const innerRef = useRef<HTMLButtonElement | null>(null);

  const setRefs = useCallback((el: HTMLButtonElement | null) => {
    (innerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
  }, [ref]);

  const updateRect = useCallback(() => {
    const el = innerRef.current;
    if (el) setRect(el.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!hovered) return;
    updateRect();
  }, [hovered, updateRect]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setRect(null);
  }, []);

  const tooltipEl =
    hovered && rect && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[99999] pointer-events-none whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg dark:bg-zinc-700"
            style={{
              left: rect.left + rect.width / 2,
              top: rect.top - 6,
              transform: "translate(-50%, -100%)",
            }}
          >
            {label}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={setRefs}
        type="button"
        className={`flex items-center justify-center transition-colors ${className}`}
        aria-label={label}
        onMouseEnter={() => {
          setHovered(true);
          updateRect();
        }}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {children}
      </button>
      {tooltipEl}
    </>
  );
});
