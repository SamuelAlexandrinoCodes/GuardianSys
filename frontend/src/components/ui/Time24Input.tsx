import { useState, useCallback } from "react";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Formata dígitos em HH:mm (máx 4 dígitos): "12" -> "12", "123" -> "12:3", "1234" -> "12:34" */
function formatAsTyping(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  if (d.length === 3) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
}

/** Valida HH:mm em 00:00 - 23:59. Retorna null se inválido. */
function isValidHHMM(s: string): boolean {
  if (!s || !/^\d{1,2}:\d{1,2}$/.test(s)) return false;
  const [h, m] = s.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Normaliza para HH:mm (00:00 - 23:59). */
function normalizeHHMM(s: string): string {
  const digits = s.replace(/\D/g, "").slice(0, 4);
  const h = digits.length >= 2 ? parseInt(digits.slice(0, 2), 10) : parseInt(digits, 10) || 0;
  const m = digits.length >= 4 ? parseInt(digits.slice(2, 4), 10) : digits.length >= 3 ? parseInt(digits.slice(2), 10) : 0;
  return `${pad2(Math.min(23, Math.max(0, h)))}:${pad2(Math.min(59, Math.max(0, m)))}`;
}

export function Time24Input({
  value,
  onChange,
  className = "",
  onBlur,
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [invalid, setInvalid] = useState(false);
  const displayValue = value || "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInvalid(false);
      const raw = e.target.value;
      const formatted = formatAsTyping(raw);
      onChange(formatted);
    },
    [onChange]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const current = displayValue.trim();
      if (!current) {
        onChange("");
        setInvalid(false);
        onBlur?.(e);
        return;
      }
      if (isValidHHMM(current)) {
        const normalized = normalizeHHMM(current);
        onChange(normalized);
        setInvalid(false);
        onBlur?.(e);
      } else {
        setInvalid(true);
        onChange("");
      }
    },
    [displayValue, onChange, onBlur]
  );

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00:00"
        autoComplete="off"
        className={`font-mono tabular-nums ${className} ${
          invalid ? "!border-red-400 !ring-1 !ring-red-400/50 dark:!border-red-500 dark:!ring-red-500/50" : ""
        }`}
        aria-invalid={invalid}
        aria-describedby={invalid ? "time24-error" : undefined}
        {...rest}
      />
      {invalid && (
        <span
          id="time24-error"
          className="absolute left-0 top-full mt-0.5 text-[10px] font-medium text-red-500"
          role="alert"
        >
          Use formato 24h (00:00 - 23:59)
        </span>
      )}
    </div>
  );
}
