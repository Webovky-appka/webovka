# Mitsov Web

Nástroj pro správu klientů a webových zakázek. Spojuje CRM, vedení zakázky po
fázích, klientský portál, přípravu smluv a asistenta na e-maily.

Zadání a rozsah jsou v [REQUIREMENTS.md](REQUIREMENTS.md), pravidla pro práci na
projektu v [CONTRIBUTING.md](CONTRIBUTING.md), nasazení v
[DEPLOYMENT.md](DEPLOYMENT.md).

## Co aplikace umí

**Zakázky a fáze.** Každá zakázka má vlastní fáze — jeden web zvládne tři, e-shop
jich potřebuje osm. Nová zakázka se předvyplní z předlohy. Fáze má termín a úkoly,
progres měří hotové fáze, ne odškrtané úkoly.

**Komunikace.** Zápisy z telefonátů, schůzek a e-mailů u klienta. Automatické
události (ukončení fáze, schválení klientem) se zapisují samy a nedají se mazat,
protože slouží jako doklad.

**Klientský portál.** Klient nemá účet, dostane odkaz a šestimístný PIN. Vidí
fáze, poznámku k dění, náhled nového webu a soubory, které jste zpřístupnil. Může
fázi schválit a poslat připomínku. Schválení se zaznamenává i s IP adresou
a zmrazeným stavem, který v tu chvíli viděl.

**Soubory.** Přílohy u klienta, u zakázky nebo u úkolu. Nikdy se nevydávají
veřejnou adresou, vždy přes `/api/attachments/[id]`, který ověřuje přístup. Velké
fotky se před nahráním zmenší v prohlížeči.

**Smlouvy.** Smlouva o dílo k zakázce, kde fáze jsou platebními milníky: záloha
při podpisu, zbytek po fázích. Text je šablona v repozitáři, model ho jen upravuje
podle pokynu a má zakázáno oslabit ochranná ustanovení. Vypadne z toho Word, který
se sám přidá do souborů zakázky. **Šablonu musí před prvním použitím projít
právník** — není to právní služba.

**Asistent na e-maily.** Z dat zakázky složí návrh e-mailu klientovi. Přesné
zadání pro model je v aplikaci vidět, aby bylo jasné, co odchází do OpenAI.
Odeslat jde přímo z Gmailu přihlášeného uživatele.

**Dokumenty a repozitáře.** Zakládání dokumentů v Google Docs z předloh a přehled
repozitáře zakázky z GitHubu.

**Právní stránky.** Zásady ochrany osobních údajů a podmínky užívání na
`/privacy` a `/terms`. V Nastavení je vidět, které údaje provozovatele v nich
ještě chybí.

## Stack

| Vrstva    | Volba                             |
| --------- | --------------------------------- |
| Framework | Next.js 16 (App Router), React 19 |
| Jazyk     | TypeScript                        |
| Styly     | Tailwind CSS 4                    |
| Databáze  | PostgreSQL 17 + Prisma 7          |
| Hesla     | argon2                            |
| Validace  | Zod                               |
| Testy     | Vitest                            |
| Word      | docx                              |

Autentizace je vlastní (e-mail + heslo, podepsaná httpOnly cookie), bez knihovny —
interní část má jen dva účty a klient se do portálu dostává odkazem a PIN kódem,
tedy bez účtu.

Napojení na OpenAI, Gmail, Google Docs a GitHub jsou volitelná. Bez klíčů
aplikace funguje dál, jen příslušná záložka řekne, co chybí.

## Rozjezd lokálně

Potřebujete Node 20.9+ a Docker.

```bash
npm install
cp .env.example .env
```

Do `.env` doplňte `SESSION_SECRET`:

```bash
openssl rand -base64 32
```

Nastartujte databázi, proveďte migrace a nasypte ukázková data:

```bash
npm run db:up && npm run db:migrate && npm run db:seed
```

Spusťte aplikaci:

```bash
npm run dev
```

Aplikace běží na http://localhost:3000.

### Přihlašovací údaje ze seedu

Seed zakládá dva účty s hesly pro lokální vývoj. Pro jiné hodnoty nastavte
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEV_EMAIL` a `SEED_DEV_PASSWORD`.

| Role    | E-mail                  | Heslo       |
| ------- | ----------------------- | ----------- |
| Admin   | admin@web-appka.local   | admin1234   |
| Vývojář | vyvojar@web-appka.local | vyvojar1234 |

Tato hesla platí výhradně pro lokální databázi v Dockeru. Do produkce se účty
zakládají zvlášť, s vlastními hesly — viz DEPLOYMENT.md, sekce 2.

## Užitečné příkazy

| Příkaz                | Co dělá                                  |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Vývojový server                          |
| `npm run build`       | Produkční build                          |
| `npm run lint`        | ESLint                                   |
| `npm run typecheck`   | Kontrola typů bez buildu                 |
| `npm test`            | Testy (Vitest)                           |
| `npm run db:up`       | Nastartuje Postgres v Dockeru            |
| `npm run db:down`     | Zastaví Postgres                         |
| `npm run db:migrate`  | Vytvoří a aplikuje migraci               |
| `npm run db:seed`     | Nasype ukázková data                     |
| `npm run db:studio`   | Prisma Studio nad databází               |
| `npm run user:create` | Založí nebo přehesluje interní účet      |
| `npm run db:reset`    | Smaže databázi a přehraje migrace i seed |

## Struktura

```
prisma/           Schéma databáze, migrace, seed
src/app/
  (internal)/     Interní část — vyžaduje přihlášení
    projects/     Přehled zakázek s hledáním a filtrem
    clients/      Detail klienta: fáze, úkoly, komunikace, soubory, e-mail
    contracts/    Příprava smluv a export do Wordu
    docs/         Dokumenty v Google Docs
    settings/     Účet, naše údaje do smluv, napojení, předloha fází
  (legal)/        Zásady ochrany údajů a podmínky užívání
  portal/         Klientský portál (odkaz + PIN, bez účtu)
  login/          Přihlášení
  api/            Přílohy, smlouva jako Word, OAuth s Googlem
  actions/        Server Actions
  icon.svg        Ikona v panelu záložek
src/components/   Sdílené UI prvky
src/lib/          Databáze, session, portál, úložiště, šablony, formátování
src/proxy.ts      Bezpečnostní hlavičky a odklon nepřihlášených (dřív middleware.ts)
```

## Testy

```bash
npm test
```

Pokrývají záměrně jen logiku, jejíž rozbití se nepozná z aplikace: podpis session
cookie, portálové tokeny a PIN se zamykáním, šifrování uložených tokenů, kódování
hlaviček e-mailu, sanitizaci názvů nahrávaných souborů, rozpočet ceny ve smlouvě,
chybové stavy volání OpenAI a práci s daty a časovými zónami.

## Nasazení

Postup je v [DEPLOYMENT.md](DEPLOYMENT.md) — Vercel pro aplikaci, Neon pro
databázi, Vercel Blob pro přílohy, Resend pro notifikace. Migrace se v produkci
aplikují samy při nasazení. Účty se v produkci zakládají skriptem, seed
s vývojovými hesly tam nepatří.
