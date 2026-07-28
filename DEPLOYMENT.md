# Nasazení do produkce

Cílová sestava je Vercel (aplikace) + Neon (PostgreSQL) + Vercel Blob (přílohy)
+ Resend (e-maily). Všechny mají bezplatnou úroveň, která na tento provoz stačí.

Postup předpokládá, že účty zakládá majitel studia, protože k nim patří
fakturace i doména.

## Kdo může projekt na Vercel připojit

**Repozitář může do Vercelu naimportovat jen jeho vlastník.** Spolupracovník
u osobního repozitáře to udělat nemůže, i když má právo psát. U repozitáře
vlastněného organizací to jde, ale jen jako Owner nebo Member organizace,
nikoli jako outside collaborator.

Tento repozitář je osobní a patří účtu `jakubsovadina`. Máme tedy tři cesty:

1. **Import provede vlastník repozitáře.** Nejjednodušší, ale správu nasazení
   pak má jen on. Hobby plán nezná členy týmu, takže druhý člověk k projektu
   přístup nedostane.
2. **Přesunout repozitář do GitHub organizace** a oba v ní být Members.
   Organizace je zdarma a importovat pak může kdokoli z nich. Pro dvoučlenný
   tým je to nejčistší řešení a vyřeší i sdílení minut pro GitHub Actions.
3. **Nasadit z příkazové řádky** pomocí `vercel --prod`. Kód se nahrává
   z lokálního stroje, takže na vlastnictví repozitáře nezáleží. Odpadá ale
   automatické nasazení po pushi, takže se to hodí spíš na první zkoušku
   než na trvalý provoz.

### Pozor na licenci Vercelu

Hobby plán je určen jen pro osobní nekomerční projekty. Nástroj, kterým se
řídí platené zakázky, komerční je. A pokud mají mít právo nasazovat dva lidé,
je potřeba plán Pro, který se platí za každého člena. Než se pro Vercel
rozhodnete, spočítejte si to — aplikace je běžný Next.js s Node runtime,
takže poběží i na malém VPS nebo na Railway či Renderu, kde se neplatí
za člena týmu.

## 1. Databáze (Neon)

1. Založte projekt na [neon.tech](https://neon.tech), region Frankfurt.
2. Zkopírujte connection string s `?sslmode=require`.
3. Volitelně si vytvořte druhou branch databáze pro vývoj, aby se testovací
   data nemíchala s produkčními.

Migrace se na produkční databázi spouští z lokálního stroje:

```bash
DATABASE_URL="<produkcni-url>" npx prisma migrate deploy
```

`migrate deploy` jen aplikuje existující migrace, nikdy nic nemaže. **Nikdy
nespouštějte `prisma migrate reset` ani `npm run db:seed` proti produkci** —
reset databázi vyprázdní a seed by založil účty s hesly z README.

## 2. Účty pro produkci

Seed s vývojovými hesly do produkce nepatří. Účty založte jednorázově skriptem
s vlastními hesly:

```bash
DATABASE_URL="<produkcni-url>" \
SEED_ADMIN_EMAIL="vas@email.cz" SEED_ADMIN_PASSWORD="<silne-heslo>" \
SEED_DEV_EMAIL="kolega@email.cz" SEED_DEV_PASSWORD="<silne-heslo>" \
npm run db:seed
```

Seed zakládá klienty jen do prázdné databáze, takže ukázková data v produkci
nevzniknou. Hesla si po prvním přihlášení každý změní v Nastavení.

## 3. Úložiště příloh (Vercel Blob)

Na Vercelu je souborový systém dočasný, takže `STORAGE_DRIVER=local` by
znamenal tichou ztrátu nahraných souborů. V produkci musí být `blob`.

1. Ve Vercel projektu otevřete Storage a vytvořte Blob store.
2. Vercel do projektu sám přidá `BLOB_READ_WRITE_TOKEN`.

## 4. E-maily (Resend)

1. Založte účet na [resend.com](https://resend.com).
2. Přidejte doménu, ze které budete odesílat, a potvrďte DNS záznamy.
3. Vytvořte API klíč.

Bez `RESEND_API_KEY` aplikace funguje dál, notifikace se jen zapíšou do logu.

## 5. Aplikace (Vercel)

1. Naimportujte repozitář `jakubsovadina/web-appka`.
2. Nastavte proměnné prostředí (níže).
3. Nasaďte. Build je `npm run build`, žádné další nastavení není potřeba.
4. Přidejte doménu a **pozvěte kolegu do projektu**, aby k nasazení nebyl
   přístup jen jeden.

### Proměnné prostředí na Vercelu

| Proměnná                | Povinná | Hodnota                                       |
| ----------------------- | ------- | --------------------------------------------- |
| `DATABASE_URL`          | ano     | Connection string z Neonu                     |
| `SESSION_SECRET`        | ano     | `openssl rand -base64 32`, jiný než lokální   |
| `APP_URL`               | ano     | Veřejná URL, např. `https://web-appka.cz`     |
| `STORAGE_DRIVER`        | ano     | `blob`                                        |
| `BLOB_READ_WRITE_TOKEN` | ano     | Doplní Vercel při vytvoření Blob store        |
| `RESEND_API_KEY`        | ne      | API klíč z Resendu                            |
| `MAIL_FROM`             | ne      | Odesílatel na ověřené doméně                  |
| `NOTIFY_EMAILS`         | ne      | Komu chodí notifikace, oddělené čárkou        |
| `MAIL_SIGNATURE`        | ne      | Podpis v e-mailech pro klienty                |

`APP_URL` musí odpovídat skutečné adrese — sestavují se z ní odkazy do
klientského portálu. Se špatnou hodnotou dostane klient odkaz, který nefunguje.

## 6. Po prvním nasazení zkontrolujte

- Přihlášení funguje a heslo se dá změnit v Nastavení.
- Vygenerovaný odkaz do portálu má správnou doménu a po zadání PINu se otevře.
- Nahrání přílohy projde a soubor se dá stáhnout (ověřuje, že Blob store jede).
- `https://<domena>/robots.txt` zakazuje indexaci.
- V odpovědi je hlavička `Strict-Transport-Security` (lokálně se nenastavuje).

## Zálohy

Neon drží historii změn, ze které lze obnovit stav k danému okamžiku; na
bezplatné úrovni je okno krátké, ověřte si aktuální rozsah v jejich nastavení.
Přílohy v Blob store zálohované nejsou — pokud v nich budou smlouvy, zvažte
pravidelné stahování kopie.

## Co se do produkce nesmí dostat

- `.env` v gitu. Proměnné patří do nastavení Vercelu.
- `npm run db:seed` s výchozími hesly z README.
- `prisma migrate reset` proti produkční databázi.
- `STORAGE_DRIVER=local`.
