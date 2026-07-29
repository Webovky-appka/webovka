"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Políčka, která se ukládají sama, bez tlačítka Uložit. Cena za to je, že bez
 * JavaScriptu se neuloží nic — proto to používáme jen u drobností (název fáze,
 * termín, stav), ne u formulářů, kde by se dala ztratit rozepsaná práce.
 */

/** Ukazuje, že se ukládá. Musí být uvnitř formuláře, čte jeho stav. */
export function SaveIndicator({ className = "" }: { className?: string }) {
  const { pending } = useFormStatus();
  const [saved, setSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;

    wasPending.current = false;
    setSaved(true);
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <span
      aria-live="polite"
      className={`shrink-0 text-xs whitespace-nowrap text-slate-400 ${className}`}
    >
      {pending ? "Ukládám…" : saved ? "Uloženo" : ""}
    </span>
  );
}

/**
 * Text, který se uloží po opuštění políčka nebo Enterem. Prázdná hodnota se
 * neukládá — vrátí se poslední uložená, aby se název nedal smazat omylem.
 * S allowEmpty se prázdné pole uloží; to je pro nepovinné údaje, které má jít
 * zrušit vymazáním.
 */
export function AutoSaveInput({
  name,
  defaultValue,
  ariaLabel,
  className,
  placeholder,
  allowEmpty = false,
}: {
  name: string;
  defaultValue: string;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const lastSaved = useRef(defaultValue);

  return (
    <input
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      className={className}
      placeholder={placeholder}
      onBlur={(event) => {
        const input = event.currentTarget;
        const value = input.value.trim();

        if (value === "" && !allowEmpty) {
          input.value = lastSaved.current;
          return;
        }
        if (value === lastSaved.current) return;

        lastSaved.current = value;
        input.value = value;
        input.form?.requestSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.currentTarget.value = lastSaved.current;
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** Rozbalovátko, které se uloží hned po změně. */
export function AutoSubmitSelect({
  name,
  defaultValue,
  ariaLabel,
  className,
  options,
}: {
  name: string;
  defaultValue: string;
  ariaLabel: string;
  className?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Datum, které se uloží hned po vybrání. Vymazání uloží prázdný termín. */
export function AutoSubmitDate({
  id,
  name,
  defaultValue,
  className,
}: {
  id?: string;
  name: string;
  defaultValue: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(event) => {
        const input = event.currentTarget;
        // Rozepsané datum prohlížeč hlásí jako prázdnou hodnotu. Ukládáme jen
        // hotové datum nebo výslovné vymazání, ne stav při psaní.
        if (input.value !== "" && Number.isNaN(Date.parse(input.value))) return;
        input.form?.requestSubmit();
      }}
    />
  );
}
