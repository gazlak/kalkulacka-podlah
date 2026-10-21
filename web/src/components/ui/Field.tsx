import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label, htmlFor, error, hint, optional, flush, children,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  optional?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="field" style={flush ? { margin: 0 } : undefined}>
      <label htmlFor={htmlFor}>
        {label}
        {optional && <> <span className="opt">{optional}</span></>}
      </label>
      {children}
      {hint && <div className="hint">{hint}</div>}
      <div className="err">{error}</div>
    </div>
  );
}

const inv = (error?: string, cls?: string) => [cls, error ? "invalid" : ""].filter(Boolean).join(" ") || undefined;

export function Input({ error, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return <input {...p} className={inv(error, className)} aria-invalid={error ? true : undefined} />;
}
export function Select({ error, className, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return <select {...p} className={inv(error, className)} aria-invalid={error ? true : undefined} />;
}
export function Textarea({ error, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return <textarea {...p} className={inv(error, className)} aria-invalid={error ? true : undefined} />;
}
