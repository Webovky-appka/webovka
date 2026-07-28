import Link from "next/link";

import { ErrorNotice, errorLinkClasses } from "@/components/error-notice";

export default function ClientNotFound() {
  return (
    <ErrorNotice
      title="Klient nenalezen"
      description="Klient byl smazán, nebo je odkaz neplatný."
      action={
        <Link href="/clients" className={errorLinkClasses}>
          Na seznam klientů
        </Link>
      }
    />
  );
}
