# Stavba webu — správa klientů a zakázek

## 1. Cíl projektu
Nástroj pro freelancera/malé studio tvořící weby pro malé firmy. Řeší tři věci na jednom místě:
1. CRM — kontakty a chronologická historie komunikace s klientem
2. Projektový management — v jaké fázi je zakázka, co je hotové, co zbývá
3. Klientský portál — klient vidí progres a může schválit/okomentovat fázi (vazba na platby)

## 2. Uživatelé / role
- **Admin (majitel studia)** — plný přístup, spravuje klienty, úkoly, komunikaci
- **Vývojář (kolega)** — přístup ke kódu na GitHubu, případně i k appce jako druhý admin
- **Klient** — přístup pouze přes sdílený odkaz (magic link, bez nutnosti účtu), vidí jen svůj projekt

## 3. Fáze vývoje

### Fáze 1 — v1 (interní správa + klientský portál)
- Seznam klientů (karta: kontakt, poznámky, aktuální fáze)
- Chronologická historie zpráv/poznámek u klienta (zatím ruční zápis, ne automatický import emailu)
- Nástěnka úkolů po fázích: Zadání → Návrh → Vývoj → Schválení → Live
- Přihlášení jen pro admina/vývojáře (žádný veřejný přístup) do interní části
- Přílohy/soubory u klienta (smlouvy, loga, faktury, screenshoty schválených verzí)
- **Klientský portál** — sdílený odkaz + PIN kód (klient zadá PIN a dostane se ke svému projektu)
  - Klient vidí: aktuální fázi, poznámku od dodavatele, náhled webu (odkaz/screenshot)
  - Klient může: schválit fázi / napsat připomínku (zpětná vazba se uloží do historie komunikace)

### Fáze 2 — automatizace (později)
- Napojení na email (Gmail API) — automatický import komunikace ke klientovi
- Platby (Stripe) — vazba schválení fáze → výzva k platbě milníku
- Notifikace (email adminovi při schválení/připomínce klienta)

## 4. Datový model (návrh)

**Client**
- id, název firmy, kontaktní osoba, email, telefon
- aktuální fáze (enum: zadani | navrh | vyvoj | schvaleni | live)
- poznámky

**Message**
- id, client_id, odesílatel (me | client), datum, text

**Task**
- id, client_id, název, fáze (enum stejný jako u klienta), hotovo (bool)

**PortalLink**
- id, client_id, token (pro odkaz), pin_kod, vytvořeno, naposledy navštíveno

**Attachment**
- id, client_id, název souboru, typ (smlouva | logo | faktura | screenshot | jiné), nahráno_kdy

## 5. Klíčové obrazovky
1. Dashboard — seznam klientů s aktuální fází a posledním kontaktem
2. Detail klienta — kontakt + záložky "Komunikace" / "Nástěnka úkolů" / "Soubory"
3. Vstup do klientského portálu (zadání PIN kódu)
4. Klientský portál (veřejná stránka, po zadání PIN kódu) — součást v1

## 6. Technické poznámky (k doladění s vývojářem)
- Doporučený směr: webová appka (Next.js nebo podobný framework), databáze Postgres (např. Supabase — má i autentizaci zdarma)
- Hosting: Vercel (jednoduché nasazení, zdarma pro začátek)
- Repo: GitHub, README + CONTRIBUTING.md, .env.example pro API klíče

## 7. Co NENÍ součástí v1
- Automatický import emailu (fáze 2)
- Platby (fáze 2)
- Vícejazyčnost, mobilní aplikace, pokročilé reporty
