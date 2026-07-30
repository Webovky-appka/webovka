import Link from "next/link";

import {
  IncompleteNotice,
  LegalList,
  LegalParagraph,
  LegalSection,
  LegalValue,
} from "@/components/legal";
import { EFFECTIVE_DATE, OPERATOR, SERVICE_NAME } from "@/lib/legal";

export const metadata = {
  title: `Podmínky užívání — ${SERVICE_NAME}`,
  description:
    "Kdo aplikaci smí užívat, co se od uživatele očekává a jaká je odpovědnost provozovatele.",
};

export default function TermsPage() {
  return (
    <>
      <IncompleteNotice />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Podmínky užívání
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Účinné od {EFFECTIVE_DATE}
        </p>
      </div>

      <LegalSection title="1. Kdo aplikaci provozuje">
        <LegalParagraph>
          Aplikaci {SERVICE_NAME} provozuje <LegalValue value={OPERATOR.name} />,
          IČO <LegalValue value={OPERATOR.ico} />, se sídlem{" "}
          <LegalValue value={OPERATOR.address} />. Kontaktní adresa je{" "}
          <LegalValue value={OPERATOR.privacyEmail} />.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. K čemu aplikace slouží">
        <LegalParagraph>
          Jde o interní nástroj na vedení klientů a webových zakázek — úkoly,
          fáze, komunikace, podklady. Klient do své zakázky vidí přes klientský
          portál, kam se dostane odkazem zabezpečeným PIN kódem. Aplikace není
          veřejná služba a registrace není otevřená.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="3. Přístup a účty">
        <LegalList
          items={[
            "Interní účty zakládá výhradně správce. Účet je osobní a nesmí se sdílet.",
            "Odkaz do klientského portálu i PIN kód patří jen dané zakázce a jsou určené pro klienta a jím určené osoby.",
            "Přístup je možné kdykoli zneplatnit, zejména při ukončení spolupráce nebo při podezření, že se dostal k nepovolané osobě.",
            "Zjištěné vyzrazení hesla nebo PIN kódu nám prosím oznamte, ať můžeme přístup okamžitě zrušit.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Pravidla užívání">
        <LegalParagraph>
          Aplikaci lze používat jen k účelu, ke kterému slouží. Zakázané je
          zejména obcházet zabezpečení, zkoušet cizí PIN kódy, zatěžovat provoz
          automatizovanými dotazy nebo nahrávat obsah, ke kterému nemáte práva
          nebo jehož šíření je nezákonné.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="5. Obsah a odpovědnost za data">
        <LegalParagraph>
          Data v aplikaci — podklady, texty, přílohy — zůstávají tomu, komu
          patřila předtím. Za správnost údajů o klientovi a za obsah, který do
          aplikace vloží, odpovídá ten, kdo je vložil.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Dostupnost">
        <LegalParagraph>
          Aplikaci se snažíme držet dostupnou, ale nezaručujeme nepřerušovaný
          provoz. Kvůli aktualizacím, údržbě nebo poruše u dodavatelů hostingu a
          databáze může být krátce nedostupná. Sjednanou dostupnost ani reakční
          dobu tyto podmínky nezakládají.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Omezení odpovědnosti">
        <LegalParagraph>
          Neodpovídáme za škodu vzniklou nedostupností aplikace, ztrátou dat
          zaviněnou dodavatelem hostingu nebo databáze, ani za následky použití
          přístupů osobou, které je uživatel svěřil. Tím nejsou dotčena práva
          spotřebitele ani odpovědnost za škodu způsobenou úmyslně nebo z hrubé
          nedbalosti.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="8. Osobní údaje">
        <LegalParagraph>
          Jak s osobními údaji zacházíme, komu je předáváme a jak dlouho je
          držíme, popisují{" "}
          <Link
            href="/privacy"
            className="text-sky-700 underline hover:text-sky-900"
          >
            zásady ochrany osobních údajů
          </Link>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="9. Změny podmínek">
        <LegalParagraph>
          Podmínky můžeme upravit, když se změní rozsah aplikace nebo způsob jejího
          provozu. Vždy platí verze zveřejněná na této adrese; datum účinnosti je
          uvedené nahoře.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Rozhodné právo">
        <LegalParagraph>
          Vztahy z těchto podmínek se řídí právem České republiky. K rozhodování
          sporů jsou příslušné české soudy.
        </LegalParagraph>
      </LegalSection>
    </>
  );
}
