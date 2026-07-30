import {
  IncompleteNotice,
  LegalList,
  LegalParagraph,
  LegalSection,
  LegalTable,
  LegalValue,
} from "@/components/legal";
import {
  EFFECTIVE_DATE,
  OPERATOR,
  PROCESSORS,
  SERVICE_NAME,
} from "@/lib/legal";

export const metadata = {
  title: `Zásady ochrany osobních údajů — ${SERVICE_NAME}`,
  description:
    "Jaké osobní údaje aplikace zpracovává, proč, komu je předává a jak dlouho je drží.",
};

export default function PrivacyPage() {
  return (
    <>
      <IncompleteNotice />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Zásady ochrany osobních údajů
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Účinné od {EFFECTIVE_DATE}
        </p>
      </div>

      <LegalSection title="1. Kdo údaje zpracovává">
        <LegalParagraph>
          Správcem osobních údajů je <LegalValue value={OPERATOR.name} />, IČO{" "}
          <LegalValue value={OPERATOR.ico} />, se sídlem{" "}
          <LegalValue value={OPERATOR.address} />
          {OPERATOR.vatId ? `, DIČ ${OPERATOR.vatId}` : ""}. Ve věcech ochrany
          osobních údajů se na nás obraťte na{" "}
          <LegalValue value={OPERATOR.privacyEmail} />.
        </LegalParagraph>
        <LegalParagraph>
          Aplikace {SERVICE_NAME} je náš interní nástroj na vedení klientů a
          webových zakázek. Součástí je klientský portál, do kterého klient vidí
          přes odkaz zabezpečený PIN kódem.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="2. Jaké údaje zpracováváme">
        <LegalTable
          head={["Údaje", "Proč je zpracováváme"]}
          rows={[
            [
              "Jméno, e-mail, role a heslo interních uživatelů. Heslo se ukládá jen jako nevratný hash.",
              "Přihlášení do aplikace a rozlišení, kdo záznam vytvořil.",
            ],
            [
              "Údaje o klientovi a jeho kontaktní osobě: firma, jméno, e-mail, telefon, adresa webu.",
              "Vedení zakázky a komunikace s klientem.",
            ],
            [
              "Interní poznámky k zakázce.",
              "Naše pracovní evidence. Klient je v portálu nikdy nevidí.",
            ],
            [
              "Komunikace: zprávy, odeslané e-maily, zpětná vazba klienta z portálu, automatické záznamy o postupu zakázky.",
              "Dohledatelnost toho, co bylo s klientem dojednáno.",
            ],
            [
              "Přílohy, které do aplikace nahrajeme — smlouvy, podklady, obrázky.",
              "Práce na zakázce a předání výstupů.",
            ],
            [
              "U schválení fáze klientem: čas, název fáze, IP adresa, z níž schválení přišlo, a text, který měl klient v portálu před sebou.",
              "Doklad, že klient danou fázi odsouhlasil.",
            ],
            [
              "PIN kód ke klientskému portálu, uložený jen jako nevratný hash, a počet neúspěšných pokusů.",
              "Ochrana portálu proti nepovolanému přístupu.",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Na jakém základě údaje zpracováváme">
        <LegalList
          items={[
            "Plnění smlouvy — bez údajů o klientovi a zakázce nelze zakázku odvést.",
            "Oprávněný zájem — evidence komunikace a doklad o schválení fáze; obojí chrání obě strany při pozdějším sporu.",
            "Plnění právních povinností — doklady, které musíme uchovat podle daňových a účetních předpisů.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Cookies">
        <LegalParagraph>
          Aplikace používá jen cookies nutné k provozu. Žádné analytické,
          reklamní ani profilovací cookies nenasazujeme a údaje nepředáváme
          reklamním sítím.
        </LegalParagraph>
        <LegalList
          items={[
            "Přihlašovací cookie interního uživatele. Platí 12 hodin, pak je nutné se přihlásit znovu.",
            "Cookie klientského portálu po zadání PIN kódu. Platí 7 dní a váže se jen na jeden konkrétní odkaz.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Komu údaje předáváme">
        <LegalParagraph>
          Údaje nikomu neprodáváme. Využíváme dodavatele, kteří pro nás
          zpracovávají údaje na náš pokyn a jsou vázáni smlouvou:
        </LegalParagraph>
        <LegalTable
          head={["Dodavatel", "Účel", "Co se k němu dostane"]}
          rows={PROCESSORS.map((processor) => [
            processor.name,
            processor.purpose,
            processor.data,
          ])}
        />
        <LegalParagraph>
          Návrh e-mailu jazykovým modelem je volitelný. Spouští se jen tehdy, když
          si ho uživatel v aplikaci vyžádá, a text, který se do modelu posílá, má
          před odesláním na obrazovce. Interní poznámka se přidává jen na
          výslovné zapnutí.
        </LegalParagraph>
        <LegalParagraph>
          Pokud je u zakázky uvedený repozitář na GitHubu, aplikace z něj čte
          seznam commitů, pull requestů a stav automatických testů. Žádné údaje o
          klientech se na GitHub neposílají.
        </LegalParagraph>
        <LegalParagraph>
          Část dodavatelů zpracovává údaje ve Spojených státech. Přenos se opírá o
          standardní smluvní klauzule Evropské komise, případně o účast dodavatele
          v rámci EU–US Data Privacy Framework.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="6. Napojení na účet Google">
        <LegalParagraph>
          Interní uživatel si může k aplikaci napojit svůj účet Google, aby šel
          e-mail klientovi odeslat z jeho vlastní adresy a aby se daly zakládat
          dokumenty v Google Docs. Napojení je dobrovolné a jde ho kdykoli zrušit
          v nastavení aplikace nebo v nastavení účtu Google.
        </LegalParagraph>
        <LegalList
          items={[
            "Aplikace má právo pouze odesílat poštu. Vaši doručenou poštu nečte a nemá k ní přístup.",
            "K souborům na Disku Google má aplikace přístup jen k těm, které sama vytvořila. Na ostatní obsah Disku nevidí a neumí ho vypsat.",
            "Přístupové tokeny jsou v databázi uložené zašifrované. V otevřené podobě se nikde nezobrazují ani nelogují.",
          ]}
        />
        <LegalParagraph>
          Použití a předávání informací získaných z rozhraní Google se řídí{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 underline hover:text-sky-900"
          >
            Google API Services User Data Policy
          </a>
          , včetně požadavků na omezené použití. Údaje z rozhraní Google
          používáme výhradně k funkcím popsaným výše. Nepředáváme je dál,
          nepoužíváme je k reklamě ani k trénování jazykových modelů a nikdo je
          nečte, s výjimkou nutného zásahu při řešení poruchy nebo tam, kde to
          ukládá zákon.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="7. Jak dlouho údaje držíme">
        <LegalList
          items={[
            "Údaje o klientovi, zakázce a komunikaci po dobu spolupráce a poté po dobu, po kterou se lze domáhat práv ze smlouvy.",
            "Doklady s daňovým nebo účetním významem po dobu stanovenou zákonem.",
            "Přílohy do jejich smazání v aplikaci; smazáním klienta se odstraní i jeho přílohy.",
            "Odkaz do klientského portálu je možné kdykoli zneplatnit; tím klient přístup okamžitě ztrácí.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Jak údaje chráníme">
        <LegalList
          items={[
            "Přístup mají jen účty, které založí správce. Registrace není otevřená.",
            "Hesla i PIN kódy se ukládají jako nevratné hashe, nikdy v čitelné podobě.",
            "Přístupové tokeny k účtu Google jsou zašifrované.",
            "Provoz je jen přes HTTPS a přílohy se nevydávají bez přihlášení.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Vaše práva">
        <LegalParagraph>
          Máte právo na přístup ke svým údajům, na jejich opravu, výmaz nebo
          omezení zpracování, na přenositelnost a právo vznést námitku proti
          zpracování založenému na oprávněném zájmu. Stačí napsat na{" "}
          <LegalValue value={OPERATOR.privacyEmail} />.
        </LegalParagraph>
        <LegalParagraph>
          Se stížností se můžete obrátit na Úřad pro ochranu osobních údajů,
          Pplk. Sochora 27, 170 00 Praha 7,{" "}
          <a
            href="https://www.uoou.cz"
            target="_blank"
            rel="noreferrer"
            className="text-sky-700 underline hover:text-sky-900"
          >
            uoou.cz
          </a>
          .
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="10. Změny těchto zásad">
        <LegalParagraph>
          Zásady můžeme upravit, když se změní způsob, jakým aplikace s údaji
          pracuje. Vždy platí verze zveřejněná na této adrese; datum účinnosti je
          uvedené nahoře.
        </LegalParagraph>
      </LegalSection>
    </>
  );
}
