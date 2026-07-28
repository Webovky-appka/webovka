"use client";

import Link from "next/link";
import { useEffect } from "react";

import {
  ErrorNotice,
  errorButtonClasses,
  errorLinkClasses,
} from "@/components/error-notice";

export default function InternalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorNotice
      title="Něco se pokazilo"
      description="Stránku se nepodařilo načíst. Pokud potíže trvají, zkontrolujte, že běží databáze."
      digest={error.digest}
      action={
        <>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className={errorButtonClasses}
          >
            Zkusit znovu
          </button>
          <Link href="/projects" className={errorLinkClasses}>
            Na přehled zakázek
          </Link>
        </>
      }
    />
  );
}
