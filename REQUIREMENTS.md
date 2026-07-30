# Mitsov Web — správa klientů a zakázek

Značení priorit u jednotlivých bodů:
- **[v1]** — součást první verze
- **[v2]** — automatizace a rozšíření, až po ověření v1
- **[nápad]** — k diskuzi, zatím nezávazné

## 0. Stav k 30. 7. 2026

**Fáze 1 je hotová a v produkci.** Postavené je i několik věcí, které v původním
zadání nebyly:

| Hotovo | Kde |
| --- | --- |
| Klienti, komunikace, fáze, úkoly, přílohy | interní část |
| Klientský portál s odkazem a PIN, schvalování a připomínky | `/portal/[token]` |
| Vlastní fáze u každé zakázky, předloha pro nové | zakázka, Nastavení |
| E-mailové notifikace přes Resend | automaticky |
| Úplné smazání klienta podle GDPR | Nastavení u klienta |
| Smlouva o dílo s platbami po milnících a exportem do Wordu | `/contracts` |
| Asistent na e-maily klientovi (OpenAI) a odesílání z Gmailu | záložka Napsat e-mail |
| Dokumenty v Google Docs z předloh | `/docs` |
| Přehled repozitáře zakázky z GitHubu | záložka GitHub |
| Zásady ochrany osobních údajů a podmínky užívání | `/privacy`, `/terms` |
| Fakturační údaje klienta i naše, do smluv | u klienta a v Nastavení |

**Z fáze 2 zbývá:** automatický import e-mailů do komunikace a platby (Stripe).
Odesílání e-mailů z Gmailu už funguje, čtení a import ne.

Otevřené otázky ze sekce 11 jsou rozhodnuté: klient schvaluje průběžně po každé
fázi, klient může mít víc zakázek, termíny v portálu vidí, databáze je
PostgreSQL od začátku.

## 1. Cíl projektu

Nástroj pro freelancera/malé studio tvořící weby pro malé firmy. Řeší tři věci na jednom místě:

1. **CRM** — kontakty a chronologická historie komunikace s klientem
2. **Projektový management** — v jaké fázi je zakázka, co je hotové, co zbývá
3. **Klientský portál** — klient vidí progres a může schválit/okomentovat fázi (vazba na platby)

Hlavní hodnota: konec dohledávání v e-mailech a poznámkách. Vše o klientovi na jedné obrazovce a klient má jasno, kdy je co na něm (schválení, podklady).

### Měřítka úspěchu [nápad]
- Každá komunikace s klientem je do 24 h zaznamenaná v systému
- Klient schvaluje fáze přes portál, ne e-mailem („schváleno" je dohledatelné na jednom místě)
- Nová zakázka se založí do 2 minut (šablona úkolů per fáze)

## 2. Uživatelé / role

- **Admin (majitel studia)** — plný přístup, spravuje klienty, úkoly, komunikaci
- **Vývojář (kolega)** — přístup ke kódu na GitHubu, v appce druhý admin
- **Klient** — přístup pouze přes sdílený odkaz (magic link + PIN, bez nutnosti účtu), vidí jen svůj projekt

### Oprávnění (přehled) [v1]

| Akce | Admin | Vývojář | Klient |
|---|---|---|---|
| Správa klientů (CRUD) | ano | ano | ne |
| Zápis komunikace | ano | ano | jen připomínka přes portál |
| Úkoly (CRUD, odškrtávání) | ano | ano | ne (jen vidí souhrn fáze) |
| Změna fáze zakázky | ano | ano | ne |
| Schválení fáze | ne | ne | ano (přes portál) |
| Generování/rušení portálových odkazů | ano | ano | ne |
| Přílohy — nahrávání a mazání | ano | ano | ne (v1; nahrávání podkladů klientem viz [nápad] níže) |

Pozn.: v1 nerozlišuje admin vs. vývojář oprávněními — oba jsou plnohodnotní admini. Oddělené role (např. „vývojář nevidí fakturační údaje") případně později [nápad].

## 3. Fáze vývoje

### Fáze 1 — v1 (interní správa + klientský portál)
- Seznam klientů (karta: kontakt, poznámky, aktuální fáze)
- Chronologická historie zpráv/poznámek u klienta (ruční zápis, ne automatický import e-mailu)
- Nástěnka úkolů po fázích: Zadání → Návrh → Vývoj → Schválení → Live
- Přihlášení jen pro admina/vývojáře do interní části
- Přílohy/soubory u klienta (smlouvy, loga, faktury, screenshoty schválených verzí)
- **Klientský portál** — sdílený odkaz + PIN kód
  - Klient vidí: aktuální fázi, poznámku od dodavatele, náhled webu (odkaz/screenshot)
  - Klient může: schválit fázi / napsat připomínku (uloží se do historie komunikace)

### Fáze 2 — automatizace (později)
- Napojení na e-mail (Gmail API) — automatický import komunikace ke klientovi
  — **odesílání hotové, import zbývá**
- Platby (Stripe) — vazba schválení fáze → výzva k platbě milníku — **zbývá**
- Notifikace (e-mail adminovi při schválení/připomínce klienta, e-mail klientovi
  při změně fáze) — **hotovo**

## 4. Funkční požadavky do detailu

### 4.1 Správa klientů [v1]
- Karta klienta: název firmy, kontaktní osoba, e-mail, telefon, IČO [nápad], web, poznámky
- **Stav klienta** (nezaměňovat s fází zakázky): `poptávka | aktivní | dokončeno | archivováno` — dashboard defaultně ukazuje jen aktivní
- Fulltextové vyhledávání (název firmy, kontaktní osoba, e-mail)
- Řazení a filtrování: podle fáze, podle posledního kontaktu, podle stavu
- Zvýraznění „dlouho bez kontaktu" (např. > 14 dní od poslední zprávy) [nápad]
- Archivace místo mazání — smazání klienta jen jako „soft delete", aby nešla omylem ztratit historie
- Štítky/tagy u klienta (např. „e-shop", „údržba", „doporučení") [nápad]

### 4.2 Komunikace (timeline) [v1]
- Chronologický feed u klienta, nejnovější nahoře
- Každý záznam: autor (admin/vývojář/klient), datum a čas, text
- **Typ záznamu**: `poznámka | e-mail | telefonát | schůzka | připomínka z portálu | systémová událost`
  - Systémové události se zapisují automaticky: změna fáze, schválení fáze klientem, vygenerování portálového odkazu — timeline pak slouží i jako audit log
- Editace/smazání vlastního záznamu (s uloženým časem poslední úpravy); záznamy z portálu a systémové události editovat nelze
- Připnutí důležitého záznamu nahoru (např. shrnutí zadání) [nápad]
- Možnost přiložit soubor přímo k záznamu (propojení s přílohami) [nápad]

### 4.3 Úkoly a nástěnka [v1]
- Úkoly seskupené podle fází: Zadání → Návrh → Vývoj → Schválení → Live
- Úkol: název, fáze, hotovo (bool), pořadí v rámci fáze
- Rozšíření úkolu: popis, termín (deadline), přiřazení (admin/vývojář) [nápad — jen pokud to nezkomplikuje UI; při dvou lidech možná stačí název]
- **Šablona úkolů** [nápad, doporučuji už do v1]: při založení klienta se předvyplní standardní checklist per fáze (např. Zadání: „podepsat smlouvu", „získat podklady", „získat přístupy k doméně"). Šablona je editovatelná na jednom místě.
- Progres fáze = hotové/všechny úkoly fáze — zobrazit jako ukazatel na kartě klienta i v portálu
- Přesun úkolu mezi fázemi (drag & drop nebo výběrem) [nápad]

### 4.4 Fáze zakázky [v1]
- Enum: `zadani | navrh | vyvoj | schvaleni | live`
- Fázi mění admin/vývojář ručně (žádný automat) — ale systém upozorní, pokud ve fázi zbývají nehotové úkoly
- **Historie fází**: u každé změny se ukládá kdo, kdy, z jaké do jaké fáze (potřeba pro zpětné dohledání i pro portál „schváleno dne…")
- Otázka k rozhodnutí: je „Schválení" jedna fáze na konci, nebo klient schvaluje průběžně (návrh zvlášť, hotový web zvlášť)? Viz §11. Doporučení: schválení jako akce dostupná v každé fázi, ne jen jako jedna fáze v řadě.

### 4.5 Přílohy a soubory [v1]
- Nahrání souboru ke klientovi: název, typ (`smlouva | logo | faktura | screenshot | jiné`), kdo nahrál, kdy
- Limity: max. velikost souboru (návrh 25 MB), povolené formáty (obrázky, PDF, ZIP, DOC/XLS)
- Úložiště mimo databázi (S3-kompatibilní / Supabase Storage / Vercel Blob) — v DB jen metadata
- Náhled obrázků a PDF přímo v appce [nápad]
- Screenshoty schválených verzí: při schválení fáze klientem možnost „zmrazit" aktuální screenshot jako důkaz, co přesně bylo schváleno [nápad, ale cenný — řeší spory „tohle jsme si neodsouhlasili"]
- Nahrávání podkladů klientem přes portál (loga, texty, fotky) [nápad — šetří e-maily, ale vyžaduje antivir/limity, spíš v2]

### 4.6 Klientský portál [v1]
- Přístup: unikátní URL s tokenem (`/portal/<token>`) + zadání PIN
- Klient vidí:
  - Název projektu, aktuální fázi a vizuální progres (kroky 1–5)
  - Poznámku od dodavatele („co se teď děje, co potřebujeme od vás")
  - Náhled webu — odkaz na staging a/nebo screenshot
  - Historii svých připomínek a schválení
- Klient může:
  - **Schválit fázi** — potvrzovací dialog, uloží se čas, IP adresa a verze schvalovaného obsahu
  - **Napsat připomínku** — text, uloží se do timeline komunikace jako záznam typu „připomínka z portálu"
- Klient NEVIDÍ: interní poznámky, úkoly v plném detailu, ostatní klienty, přílohy typu smlouva/faktura (pokud mu je admin explicitně nenasdílí [nápad])
- Poznámka od dodavatele viditelná v portálu je oddělené pole — interní poznámky se do portálu nikdy nepropisují

### 4.7 Zabezpečení portálu [v1]
- Token: dlouhý náhodný řetězec (min. 32 znaků), v DB uložený jako hash
- PIN: 6 číslic, v DB jen hash (bcrypt/argon2), generuje appka (ne admin ručně)
- **Rate limiting**: max. 5 pokusů o PIN za 15 minut na token i na IP; poté dočasné zablokování + záznam do timeline
- Expirace odkazu: volitelná platnost (např. 90 dní), možnost admina odkaz kdykoli zneplatnit a vygenerovat nový
- Po X měsících neaktivity odkaz automaticky expiruje [nápad]
- Session klienta po zadání PIN: krátkodobá cookie (např. 7 dní), ne trvalá
- Portál nesmí být indexovatelný (noindex, robots.txt)

### 4.8 Přihlášení do interní části [v1]
- E-mail + heslo pro admina a vývojáře (2 účty), hesla hashovaná
- Bez veřejné registrace — účty se zakládají seedem/ručně v DB, případně pozvánkou [nápad]
- 2FA (TOTP) [nápad — vzhledem k tomu, že uvnitř jsou smlouvy a kontakty klientů, zvážit brzy]
- Automatické odhlášení po delší neaktivitě

## 5. Datový model (rozšířený návrh)

Všechny tabulky: `id`, `created_at`, `updated_at`. Mazání klienta jako soft delete (`archived_at`).

**User** (nové oproti původnímu návrhu)
- email, password_hash, jméno, role (`admin`) — v1 bez rozlišení rolí, sloupec připraven

**Client**
- název firmy, kontaktní osoba, e-mail, telefon, web, IČO [nápad]
- stav (`poptavka | aktivni | dokonceno | archivovano`)
- aktuální fáze (enum: `zadani | navrh | vyvoj | schvaleni | live`)
- interní poznámky (nikdy se nezobrazují v portálu)
- poznámka pro portál („co se teď děje")
- odkaz na staging/náhled webu

**Message**
- client_id, autor (`user_id` nebo `client`), typ (`poznamka | email | telefonat | schuzka | pripominka_portal | system`), datum, text, edited_at
- attachment_id [nápad — příloha u záznamu]

**Task**
- client_id, název, fáze (stejný enum), hotovo (bool), pořadí, popis [nápad], termín [nápad]

**TaskTemplate** [nápad]
- název, fáze, pořadí — kopíruje se do Task při založení klienta

**PhaseChange** (nové)
- client_id, user_id, z fáze, do fáze, datum

**Approval** (nové — schválení oddělené od Message, kvůli dokazatelnosti)
- client_id, fáze, datum, IP adresa, portal_link_id, případně odkaz na „zmrazený" screenshot

**PortalLink**
- client_id, token_hash, pin_hash, vytvořeno, expirace, naposledy navštíveno, aktivní (bool), počet neúspěšných pokusů o PIN, zablokováno_do

**Attachment**
- client_id, název souboru, typ (`smlouva | logo | faktura | screenshot | jine`), velikost, mime type, cesta v úložišti, nahrál (user_id), viditelné v portálu (bool) [nápad]

## 6. Klíčové obrazovky (detailněji)

1. **Dashboard** — seznam klientů: název, kontaktní osoba, aktuální fáze (barevný badge), progres úkolů, datum posledního kontaktu, stav. Filtr podle stavu a fáze, vyhledávání. Defaultně jen aktivní klienti.
2. **Detail klienta** — hlavička (kontakt, fáze, tlačítko změny fáze, správa portálového odkazu) + záložky:
   - *Komunikace* — timeline se zápisem nového záznamu nahoře
   - *Úkoly* — sloupce/sekce po fázích, odškrtávání, přidání úkolu
   - *Soubory* — tabulka příloh, upload, filtr podle typu
   - *Portál* [nápad] — náhled toho, co přesně vidí klient („view as client"), správa odkazu a PIN
3. **Vstup do portálu** — zadání PIN, srozumitelná chybová hláška, informace o zablokování po X pokusech
4. **Klientský portál** — progres 1–5, poznámka dodavatele, náhled webu, tlačítko „Schválit", pole pro připomínku, historie schválení/připomínek
5. **Nastavení** [nápad] — šablona úkolů, změna hesla, správa účtů

### UX poznámky
- Responzivní design — admin i klient budou často na telefonu; portál musí být primárně mobilní [v1]
- Čeština jako jediný jazyk UI [v1]; texty držet na jednom místě pro případnou pozdější lokalizaci [nápad]
- Tmavý režim [nápad]
- Prázdné stavy s návodem („Zatím žádný klient — přidejte prvního") [v1]

## 7. Nefunkční požadavky

### Bezpečnost [v1]
- HTTPS všude, security headers (CSP, HSTS)
- Hesla i PIN pouze hashované, tokeny hashované
- Ochrana proti CSRF/XSS (formuláře, escapování výstupu — zejména text připomínek z portálu!)
- Přístup k souborům přes podepsané URL s expirací, ne veřejné odkazy
- Žádné tajné klíče v repozitáři — `.env.example` s placeholdery

### GDPR a data [v1]
- Zpracovávají se osobní údaje klientů (jméno, e-mail, telefon) — připravit možnost úplného smazání klienta na žádost (hard delete včetně příloh)
- Zálohy databáze (denní, retence min. 14 dní) a příloh
- Export dat klienta (JSON/CSV) [nápad]

### Provoz
- Cíl v1: jednotky až desítky klientů, 2 interní uživatelé — žádná optimalizace výkonu předem
- Logování chyb (např. Sentry free tier) [nápad]
- Uptime monitoring portálu (UptimeRobot apod.) [nápad]

## 8. Technické poznámky (k doladění s vývojářem)

- Doporučený směr: webová appka (Next.js App Router, TypeScript), databáze Postgres (např. Supabase — má i autentizaci a storage zdarma)
- Alternativa pro rychlý start: Prisma + SQLite lokálně, přechod na Postgres až při nasazení [nápad]
- Hosting: Vercel (jednoduché nasazení, zdarma pro začátek)
- Úložiště souborů: Supabase Storage nebo Vercel Blob — rozhodnout společně s volbou DB
- Repo: GitHub — README, CONTRIBUTING.md (jak spustit lokálně, konvence větví a commitů), `.env.example`
- Základní CI (lint + build na PR) [nápad]
- Seed skript s ukázkovými daty pro lokální vývoj [nápad]

## 9. Co zatím není
- Automatický import e-mailu (fáze 2)
- Platby (fáze 2)
- Vícejazyčnost, mobilní aplikace, pokročilé reporty
- Rozlišení oprávnění admin vs. vývojář — role v databázi je, ale nic neomezuje
- Nahrávání souborů klientem přes portál

## 10. Nápady do budoucna (backlog, neřazeno)
- Fakturace nebo napojení na fakturační službu (Fakturoid API) — vazba milník → faktura
- Časové výkazy u úkolů (strávený čas → podklad pro vyúčtování víceprací)
- Šablony celých projektů (typ „vizitkový web" vs. „e-shop" → jiná sada úkolů) — částečně: předloha fází existuje, ale je jen jedna
- Kalendář/připomínky („ozvat se klientovi za týden")
- Přehledová stránka: kolik zakázek v jaké fázi, průměrná doba fáze
- Notifikace do mobilu (Telegram/Slack webhook) při připomínce klienta
- Údržbový režim po Live: opakované úkoly (prodloužení domény, aktualizace, zálohy) pro klienty v režimu údržby
- Veřejný stavový widget „na čem pracujeme" pro klienta k vložení do e-mailu [nápad]

## 11. Otevřené otázky k rozhodnutí
1. Schvaluje klient jen jednou (fáze „Schválení"), nebo průběžně po každé fázi? (Doporučení: průběžně — schválení návrhu má jinou váhu než schválení hotového webu.)
2. Jeden klient = jedna zakázka, nebo může mít klient více zakázek (redesign po roce)? Datový model by na to šel připravit oddělením entity **Project** od **Client** — rozhodnout před začátkem implementace, dodatečně se to mění špatně.
3. Má klient v portálu vidět i termíny („návrh bude do 15. 8."), nebo jen fáze bez dat?
4. Supabase od začátku, nebo SQLite lokálně a Postgres až při nasazení?
5. Kdo je „vlastník" produkčního nasazení (Vercel účet, doména, Supabase projekt) — nastavit sdílený přístup pro oba.
