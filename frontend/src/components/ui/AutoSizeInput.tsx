import { forwardRef, useLayoutEffect, useRef, useState } from "react";

/** Input que redimensiona conforme o texto, medindo via span oculto. */
export const AutoSizeInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function AutoSizeInput(
    { value, onChange, onKeyDown, onBlur, onClick, className = "", style, ...props },
    ref
  ) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(16);

  useLayoutEffect(() => {
    if (measureRef.current) {
      const w = measureRef.current.getBoundingClientRect().width;
      setWidth(Math.max(16, Math.ceil(w) + 4));
    }
  }, [value]);

  const displayValue = typeof value === "string" ? value : String(value ?? "");

  return (
    <span className="relative inline-block">
      <span
        ref={measureRef}
        className="invisible absolute left-0 top-0 whitespace-pre [font:inherit]"
        aria-hidden
      >
        {displayValue || "\u00A0"}
      </span>
      <input
        ref={ref}
        type="text"
        value={displayValue}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onClick={onClick}
        className={className}
        style={{ width: `${width}px`, maxWidth: "12rem", ...style }}
        {...props}
      />
    </span>
  );
});
