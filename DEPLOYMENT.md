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

Migrace se aplikují samy při nasazení do produkce. Build na Vercelu spouští
`scripts/vercel-build.mjs`, který před `next build` provede
`prisma migrate deploy` — ale **jen když `VERCEL_ENV=production`**. Nasazení
náhledu z rozpracované větve schéma nemění, protože Preview i Production míří
na stejnou databázi a náhled by ji jinak přemigroval dřív než produkční kód.

Pro migrace se přednostně použije `POSTGRES_URL_NON_POOLING`, pokud existuje.
Migrace jsou DDL a přes connection pooler mohou selhat.

Ručně z lokálního stroje to jde takto, například když chcete migraci aplikovat
bez nasazení:

```bash
DATABASE_URL="<produkcni-url>" npx prisma migrate deploy
```

`migrate deploy` jen aplikuje existující migrace, nikdy nic nemaže. **Nikdy
nespouštějte `prisma migrate reset` ani `npm run db:seed` proti produkci** —
reset databázi vyprázdní a seed by založil účty s hesly z README.

### Když Preview a Production sdílejí databázi

Integrace Neonu ve Vercelu nastaví `DATABASE_URL` pro Preview i Production na
tutéž databázi. Nasazení náhledu tedy čte a zapisuje produkční data. Pokud vám
to vadí, vytvořte v Neonu druhou branch databáze a nastavte pro prostředí
Preview vlastní `DATABASE_URL`.

## 2. Účty pro produkci

Seed s vývojovými hesly do produkce nepatří. Účty zakládejte skriptem
`user:create`, který se na heslo zeptá skrytě — nezůstane tedy v historii
shellu ani v logu.

Nejdřív si stáhněte produkční proměnné z Vercelu:

```bash
npx vercel env pull .env.production --environment=production
```

Soubor `.env.production` je v `.gitignore`, do repozitáře se nedostane.

Pak založte svůj účet:

```bash
npm run user:create -- --env-file .env.production
```

Skript se nejdřív zeptá, jestli je to správná databáze — vypíše její hostitele,
takže poznáte, jestli míříte na produkci nebo na localhost. Potom se doptá na
e-mail, jméno, roli a heslo. Totéž zopakujte pro kolegu s rolí vývojář.

Tentýž příkaz slouží i ke **změně zapomenutého hesla**: u existujícího e-mailu
účet neduplikuje, jen mu nastaví nové heslo.

Klienti účty nemají a v této tabulce se nikdy neobjeví. Dostávají odkaz a PIN,
viz sekce 7.

## 3. Úložiště příloh (Vercel Blob)

Na Vercelu je souborový systém dočasný, takže `STORAGE_DRIVER=local` by
znamenal tichou ztrátu nahraných souborů. V produkci musí být `blob`.

1. Ve Vercel projektu otevřete Storage a vytvořte Blob store.
2. Vercel do projektu přidá proměnné sám.

Autorizace ke Blobu má dvě varianty a stačí jedna:

- **`BLOB_STORE_ID`** plus `VERCEL_OIDC_TOKEN`, který Vercel dodává za běhu.
  Tohle nastaví integrace Blobu sama a je to bezpečnější, protože OIDC token je
  krátkodobý. Aplikace `storeId` předává, kdykoli tuhle proměnnou najde.
- **`BLOB_READ_WRITE_TOKEN`**, dlouhodobý token ze nastavení Blob storu.
  Použijte, jen když první varianta z nějakého důvodu nefunguje.

Když nebude ani jedna, nahrávání příloh selže na chybějícím tokenu.

## 4. E-maily (Resend)

1. Založte účet na [resend.com](https://resend.com).
2. Přidejte doménu, ze které budete odesílat, a potvrďte DNS záznamy.
3. Vytvořte API klíč.

Bez `RESEND_API_KEY` aplikace funguje dál, notifikace se jen zapíšou do logu.

## 4b. Návrhy e-mailů (OpenAI)

Záložka **Napsat e-mail** u zakázky umí složit návrh e-mailu klientovi z toho,
co je o zakázce v aplikaci.

1. Na [platform.openai.com](https://platform.openai.com) vytvořte API klíč.
2. Nabijte kredit — bez něj model vrací chybu o vyčerpaném limitu.
3. Klíč vložte jako `OPENAI_API_KEY`. Jiný model než výchozí `gpt-4o-mini`
   nastavíte přes `OPENAI_MODEL`.

Bez klíče záložka funguje dál, jen návrh složí šablona z dat zakázky a vaše
zadání nezpracuje. **Do OpenAI se posílají podklady o zakázce** — jméno klienta,
adresa, fáze, nehotové úkoly a posledních pět zápisů z komunikace. Interní
poznámka o klientovi se posílá jen po zaškrtnutí políčka. Před odesláním si lze
podklady zobrazit tlačítkem Načíst podklady.

## 4c. Odesílání z Gmailu (Google OAuth)

Aby šel e-mail odeslat přímo z aplikace z vaší adresy, je potřeba vlastní OAuth
klient v Googlu. Aplikace dostane pouze právo `gmail.send`, tedy odesílat —
na čtení pošty oprávnění nemá.

1. V [Google Cloud Console](https://console.cloud.google.com) založte projekt.
2. **APIs & Services → Library** → zapněte **Gmail API**.
3. **APIs & Services → OAuth consent screen**: typ **External**, doplňte název
   aplikace a kontaktní e-mail.
4. Do **Scopes** přidejte `https://www.googleapis.com/auth/gmail.send`.
5. Do **Test users** přidejte svoji adresu i adresu kolegy. Bez toho vás Google
   k přihlášení nepustí.
6. **Credentials → Create credentials → OAuth client ID**, typ **Web
   application**. Do **Authorized redirect URIs** vložte
   `https://<vase-domena>/api/google/callback` a pro vývoj
   `http://localhost:3001/api/google/callback`.
7. Vzniklé Client ID a Client secret vložte jako `GOOGLE_CLIENT_ID` a
   `GOOGLE_CLIENT_SECRET`.
8. V aplikaci pak v **Nastavení → Odesílání e-mailů klientům** klikněte na
   Napojit Gmail.

Adresa v redirect URI musí přesně odpovídat `APP_URL`, jinak Google přihlášení
odmítne s `redirect_uri_mismatch`.

### Přihlášení vyprší po 7 dnech

Sedmidenní limit **nemá nic společného s tím, že je aplikace veřejně dostupná
na URL**. Řídí se výhradně stavem souhlasné obrazovky v Google Cloudu: dokud je
v režimu **Testing**, Google trvalý token po týdnu zruší. Aplikace to pozná a
napíše to. Trvale se tomu dá vyhnout třemi způsoby.

**Publikovat aplikaci a nechat ji ověřit.** V souhlasné obrazovce **Publish
app**, pak požádat o ověření. `gmail.send` patří mezi *sensitive* rozsahy, ne
*restricted*, takže se neplatí bezpečnostní audit u třetí strany — stačí
ověření značky a posouzení aplikace. Google k tomu chce:

- domovskou stránku na **vlastní doméně, kterou si ověříte v Search Console**,
- zásady ochrany osobních údajů na téže doméně,
- video, na kterém je vidět přihlášení a k čemu se rozsah používá.

Zdržení bývá dny až týdny. **Na `*.vercel.app` to nejde** — ověřit se dá jen
doména, kterou vlastníte, a `vercel.app` patří Vercelu. Do doby, než bude web
na vlastní doméně, je tato cesta zavřená.

**Google Workspace na vlastní doméně.** Aplikace nastavená jako **Internal**
žádné ověření nepotřebuje a token nevyprší. Workspace je ale placený.

**Vynechat OAuth a posílat přes SMTP s heslem aplikace.** Na účtu Google
zapnete dvoufázové ověření, vytvoříte heslo aplikace a posíláte přes
`smtp.gmail.com`. Nevyprší to, nic se neověřuje, odesílatel je vaše adresa a
Gmail si kopii uloží do Odeslané pošty. Cenou je dlouhodobé heslo v proměnných
prostředí místo tokenu a limit řádově 500 zpráv denně. Aplikace to dnes neumí,
je to práce na pár hodin — řekněte, jestli to chcete přidat.

Uložený token je v databázi zašifrovaný klíčem odvozeným ze `SESSION_SECRET`.
Změna `SESSION_SECRET` tedy napojení zneplatní — udělá se znovu.

## 4d. Dokumenty v Google Docs

Používá se **stejný OAuth klient jako pro Gmail**, jen s jedním rozsahem navíc.
Aplikace dostane `drive.file`, tedy právo jen k souborům, které sama vytvořila —
na ostatní obsah vašeho Drive nevidí a vypsat ho neumí.

1. V Google Cloud Console **APIs & Services → Library** zapněte **Google Drive
   API** a **Google Docs API**. Obě, samotné Drive API dokument nenaplní textem.
2. V **OAuth consent screen → Scopes** přidejte
   `https://www.googleapis.com/auth/drive.file`.
3. V aplikaci se napojte znovu — **Dokumenty → Napojit účet znovu**. Účty
   napojené dřív mají v uloženém souhlasu jen `gmail.send`, takže dokumenty
   zakládat nemohou. Odesílání pošty jim funguje dál.

Dokument patří tomu, kdo ho založil. Kolegům se nasdílí přímo v Google Docs,
aplikace do sdílení nezasahuje. Odebrání dokumentu v aplikaci smaže jen odkaz,
soubor v Drive zůstane.

`drive.file` je u Googlu *non-sensitive*, takže nezvyšuje nároky na ověření —
platí pro něj totéž, co je popsané výše u `gmail.send`.

## 4e. Repozitáře z GitHubu

Záložka GitHub u zakázky čte posledních pět commitů, otevřené pull requesty a
poslední běh Actions. Jen čtení, aplikace do repozitáře nikdy nezapisuje. Token
je jeden pro celé studio, uživatelé nic nepřipojují.

1. Na GitHubu **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. **Resource owner** nastavte na organizaci, které repozitáře patří, a vyberte
   repozitáře zakázek.
3. Oprávnění: **Contents: Read-only**, **Pull requests: Read-only**,
   **Actions: Read-only**. Nic víc token potřebovat nebude.
4. Token vložte jako `GITHUB_TOKEN` do `.env` a na Vercelu do proměnných
   prostředí. Do gitu ani do zpráv ho nedávejte.
5. U zakázky pak v záložce **GitHub** vyplňte repozitář. Stačí vložit celou
   adresu z prohlížeče, uloží se z ní `owner/repo`.

Odpovědi GitHubu se drží dvě minuty v cache, aby přepínání záložek nevyčerpalo
kvótu. Bez `Actions: Read-only` přehled funguje dál, jen se nezobrazí stav CI.
Fine-grained tokeny mají platnost — po vypršení záložka nahlásí neplatný token
a token se vydá znovu.

## 4f. Ranní běhy AI Sales (Vercel Cron)

Kampaň s automatickým spouštěním (v nastavení kampaně: každý den / pracovní
dny) startuje sama. `vercel.json` obsahuje cron na `/api/sales/cron` v 06:00
UTC — v létě 8:00, v zimě 7:00 českého času, Vercel časové zóny neumí.

1. Nastavte proměnnou `CRON_SECRET` (libovolný dlouhý náhodný řetězec,
   `openssl rand -base64 32`). Vercel ji pak posílá v hlavičce a endpoint
   bez ní plánované spuštění odmítne.
2. Hobby plán umí cron jednou denně — přesně tolik je potřeba.

Endpoint je idempotentní: kampaň s během ze stejného dne nebo s právě běžícím
během se přeskočí, takže opakované zavolání nic nezdvojí. Bez `OPENAI_API_KEY`
neudělá nic a řekne to.

## 4g. Screenshoty webů (AI Sales audit)

Auditor při běhu fotí web leadu (desktop 1440×900 a mobil 390×844) a snímky
posílá modelu — audit tak hodnotí skutečně vyrenderovaný web, ne jen HTML.

- **Na Vercelu funguje bez nastavení.** Prohlížeč nese balíček
  `@sparticuz/chromium`, žádný účet ani proměnná nejsou potřeba.
- **Lokálně** je potřeba jednou stáhnout Chrome pro puppeteer:
  `npx puppeteer browsers install chrome`. Bez něj se screenshoty tiše
  přeskočí a audit běží jen z HTML (v aktivitě leadu je `screenshots: false`).
- Snímky se ukládají do úložiště příloh (lokálně `.uploads/`, v produkci
  Vercel Blob) a vydávají jen přihlášeným přes `/api/sales/screenshots/…`.

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
| `APP_URL`               | ano     | Veřejná URL, např. `https://mitsov.cz`        |
| `STORAGE_DRIVER`        | ano     | `blob`                                        |
| `BLOB_STORE_ID`         | ano*    | Doplní Vercel při vytvoření Blob store        |
| `BLOB_READ_WRITE_TOKEN` | ano*    | Alternativa k BLOB_STORE_ID, viz níže         |
| `RESEND_API_KEY`        | ne      | API klíč z Resendu                            |
| `MAIL_FROM`             | ne      | Odesílatel na ověřené doméně                  |
| `NOTIFY_EMAILS`         | ne      | Komu chodí notifikace, oddělené čárkou        |
| `MAIL_SIGNATURE`        | ne      | Podpis v e-mailech pro klienty                |
| `OPENAI_API_KEY`        | ne      | Klíč pro návrhy e-mailů                       |
| `OPENAI_MODEL`          | ne      | Jiný model, výchozí `gpt-4o-mini`             |
| `GOOGLE_CLIENT_ID`      | ne      | OAuth klient pro Gmail a Google Docs          |
| `GOOGLE_CLIENT_SECRET`  | ne      | Tajný klíč téhož OAuth klienta                |
| `GITHUB_TOKEN`          | ne      | Fine-grained PAT pro čtení repozitářů         |
| `GOOGLE_ACCOUNT_INDEX`  | ne      | Výchozí pořadí účtu pro odkazy v navigaci     |
| `STUDIO_NAME`           | ne      | Zhotovitel ve smlouvách, přebíjí Nastavení    |
| `STUDIO_ICO`            | ne      | IČO do smluv                                  |
| `STUDIO_DIC`            | ne      | DIČ do smluv, prázdné u neplátce              |
| `STUDIO_ADDRESS`        | ne      | Sídlo do smluv                                |
| `STUDIO_BANK_ACCOUNT`   | ne      | Účet pro platby ve smlouvách                  |
| `STUDIO_REPRESENTED_BY` | ne      | Kdo smlouvu podepisuje                        |

Údaje `STUDIO_*` se dají místo proměnných vyplnit v aplikaci v **Nastavení →
Naše údaje do smluv**, což je pohodlnější — změna IČA pak neznamená nasazovat.
Uložené hodnoty mají přednost před proměnnými.

`APP_URL` musí odpovídat skutečné adrese — sestavují se z ní odkazy do
klientského portálu. Se špatnou hodnotou dostane klient odkaz, který nefunguje.

Proměnné nastavte i pro prostředí **Preview**, ne jen Production. Bez
`SESSION_SECRET` v Preview se na náhledu nepřihlásíte — aplikace při chybějícím
klíči vyhodí chybu.

## 6. Po prvním nasazení zkontrolujte

- Přihlášení funguje a heslo se dá změnit v Nastavení.
- Vygenerovaný odkaz do portálu má správnou doménu a po zadání PINu se otevře.
- Nahrání přílohy projde a soubor se dá stáhnout (ověřuje, že Blob store jede).
- `https://<domena>/robots.txt` zakazuje indexaci.
- V odpovědi je hlavička `Strict-Transport-Security` (lokálně se nenastavuje).

## 7. Jak klient dostane přístup

Klient **nemá účet, e-mail ani heslo** a nikdy mít nebude. Postup je vždy tento:

1. V aplikaci založte klienta a jeho zakázku (Klienti → Nový klient).
2. Na detailu klienta otevřete záložku **Nastavení**.
3. Vyplňte **Poznámku pro klienta** a případně odkaz na náhled webu, uložte.
   Tohle klient v portálu uvidí.
4. V panelu **Odkaz pro klienta** klikněte na Vygenerovat odkaz.
5. Zobrazí se URL a šestimístný PIN. **PIN se zobrazí jen tehdy** — v databázi
   je pak už jen jeho hash a znovu ho nepřečtete.
6. Odkaz i PIN pošlete klientovi. Pro jistotu jiným kanálem než odkaz, tedy
   například odkaz e-mailem a PIN v SMS.

Než odkaz odešlete, můžete si tlačítkem **Zobrazit jako klient** ověřit, co
uvidí. Náhled má schvalovací akce vypnuté.

Když PIN zapomenete nebo se odkaz dostane k nesprávné osobě, klikněte na
Vygenerovat nový odkaz — starý tím okamžitě přestane platit.

## Zálohy

Neon drží historii změn, ze které lze obnovit stav k danému okamžiku; na
bezplatné úrovni je okno krátké, ověřte si aktuální rozsah v jejich nastavení.
Přílohy v Blob store zálohované nejsou — pokud v nich budou smlouvy, zvažte
pravidelné stahování kopie.

Navíc běží noční `pg_dump` přes GitHub Actions (`db-backup.yml`, 02:17 UTC):
záloha se ukládá jako artifact běhu s retencí 14 dní (Actions → Database
backup → poslední běh → Artifacts). Workflow potřebuje repository variable
`NEON_PROJECT_ID` a secret `NEON_API_KEY` — stejné, jaké používá úklid
preview větví. Ruční spuštění: záložka Actions → Database backup → Run
workflow.

Obnova ze zálohy:

```bash
unzip db-backup-<run-id>.zip
pg_restore --clean --if-exists -d "$CONNECTION_STRING" backup.dump
```

`CONNECTION_STRING` je přímé (ne pooled) připojení k cílové databázi.
Obnovu si nejdřív vyzkoušejte na prázdné Neon větvi, ne rovnou na produkci.

## Co se do produkce nesmí dostat

- `.env` v gitu. Proměnné patří do nastavení Vercelu.
- `npm run db:seed` s výchozími hesly z README.
- `prisma migrate reset` proti produkční databázi.
- `STORAGE_DRIVER=local`.
