"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("auth");
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
          aria-label={show ? t("hidePasswordAria") : t("showPasswordAria")}
        >
          {show ? t("hidePassword") : t("showPassword")}
        </button>
      </div>
    </div>
  );
}
