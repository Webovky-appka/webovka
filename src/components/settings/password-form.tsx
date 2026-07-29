"use client";

import { useActionState, useRef } from "react";

import { changePassword, type PasswordState } from "@/app/actions/account";
import { Field, FormError } from "@/components/field";

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    async (prevState, formData) => {
      const result = await changePassword(prevState, formData);
      if (result?.success) formRef.current?.reset();
      return result;
    },
    undefined,
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <Field
        label="Současné heslo"
        name="currentPassword"
        type="password"
        required
      />
      <Field
        label="Nové heslo"
        name="newPassword"
        type="password"
        required
        hint="Alespoň 10 znaků."
      />
      <Field
        label="Nové heslo znovu"
        name="confirmPassword"
        type="password"
        required
      />

      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Měním…" : "Změnit heslo"}
      </button>
    </form>
  );
}
