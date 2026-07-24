"use client";

import { useState } from "react";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
};

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  required,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relay-field">
      <label htmlFor={id}>{label}</label>
      <div className="relay-password">
        <input
          id={id}
          className="relay-input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="relay-password-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        >
          {show ? "Скрыть" : "Показать"}
        </button>
      </div>
    </div>
  );
}
