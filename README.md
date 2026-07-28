# web-appka

Nástroj pro správu klientů a webových zakázek. Spojuje CRM, projektový management
po fázích a klientský portál, ve kterém klient schvaluje fáze a píše připomínky.

Zadání a rozsah jsou v [REQUIREMENTS.md](REQUIREMENTS.md), pravidla pro práci
na projektu v [CONTRIBUTING.md](CONTRIBUTING.md).

## Stack

| Vrstva    | Volba                             |
| --------- | --------------------------------- |
| Framework | Next.js 16 (App Router), React 19 |
| Jazyk     | TypeScript                        |
| Styly     | Tailwind CSS 4                    |
| Databáze  | PostgreSQL 17 + Prisma 7          |
| Hesla     | argon2                            |
| Validace  | Zod                               |

Autentizace je vlastní (e-mail + heslo, podepsaná httpOnly cookie), bez knihovny —
interní část má jen dva účty a klient se do portálu dostává odkazem a PIN kódem,
tedy bez účtu.

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
zakládají zvlášť, s vlastními hesly.

## Užitečné příkazy

| Příkaz               | Co dělá                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Vývojový server                          |
| `npm run build`      | Produkční build                          |
| `npm run lint`       | ESLint                                   |
| `npm run typecheck`  | Kontrola typů bez buildu                 |
| `npm test`           | Testy (Vitest)                           |
| `npm run db:up`      | Nastartuje Postgres v Dockeru            |
| `npm run db:down`    | Zastaví Postgres                         |
| `npm run db:migrate` | Vytvoří a aplikuje migraci               |
| `npm run db:seed`    | Nasype ukázková data                     |
| `npm run db:studio`  | Prisma Studio nad databází               |
| `npm run db:reset`   | Smaže databázi a přehraje migrace i seed |

## Struktura

```
prisma/         Schéma databáze, migrace, seed
src/app/        Stránky a Server Actions (App Router)
  (internal)/   Interní část — vyžaduje přihlášení
  login/        Přihlášení
  portal/       Klientský portál (odkaz + PIN, bez účtu)
  actions/      Server Actions
src/components/ Sdílené UI prvky
src/lib/        Databáze, session, formátování, pomocné funkce
src/proxy.ts    Optimistické přesměrování nepřihlášených (dříve middleware.ts)
```

## Nasazení

Zamýšlený cíl je Vercel s hostovaným Postgresem (Neon nebo Supabase).
Potřeba nastavit `DATABASE_URL`, `SESSION_SECRET`, `APP_URL` a pro přílohy
`STORAGE_DRIVER=blob` s `BLOB_READ_WRITE_TOKEN`. Účty admina a vývojáře se
v produkci zakládají samostatně, seed s vývojovými hesly tam nepatří.
