import Link from "next/link";

import { ErrorNotice, errorLinkClasses } from "@/components/error-notice";

export const metadata = {
  title: "Stránka nenalezena — Stavba webu",
};

/**
 * Bez dynamického renderu by se stránka prerenderovala při buildu, kdy ještě
 * není znám nonce — a strict-dynamic v CSP by pak zablokoval všechny skripty.
 */
export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <ErrorNotice
      title="Stránka neexistuje"
      description="Odkaz je patrně neplatný nebo už byla stránka odstraněna."
      action={
        <Link href="/projects" className={errorLinkClasses}>
          Na přehled zakázek
        </Link>
      }
    />
  );
}
