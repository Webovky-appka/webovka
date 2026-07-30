# Jak se na projektu pracuje

## Než začnete

Rozjezd lokálního prostředí je popsaný v [README.md](README.md). Zadání
a rozsah jsou v [REQUIREMENTS.md](REQUIREMENTS.md), stav rozpracovanosti v jeho
sekci 0 — nové funkce prosím nejdřív dopište tam, ať je jasné, co je v rozsahu
a co ne.

## Větve a commity

- Do `main` se necommituje přímo. Práce probíhá na větvi a slučuje se přes
  pull request, aby si to druhý stihl projít.
- Pojmenování větví: `feat/`, `fix/`, `chore/` a krátký popis, například
  `feat/portal-notifikace`.
- Commit messages anglicky, v rozkazovacím způsobu: `Add portal PIN lockout`.
  Delší vysvětlení patří do těla commitu, ne do názvu.

## Před odesláním pull requestu

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Totéž hlídá CI na každém pull requestu.

Testy pokrývají záměrně jen logiku, jejíž rozbití se nepozná z aplikace:
podpis session cookie, portálové tokeny a PIN, sanitizaci názvů nahrávaných
souborů a validaci hesel. Přidávejte je tam, kde chyba tiše oslabí zabezpečení,
ne pro pokrytí samo pro sebe.

Když měníte schéma databáze, přiložte migraci — nikdy neupravujte migraci,
která už je v `main`.

```bash
npm run db:migrate
```

## Konvence v kódu

- Kód, identifikátory, názvy souborů a commit messages anglicky. Texty pro
  uživatele česky.
- Cesty v URL anglicky (`/clients`, `/projects`), viditelné popisky česky.
- Server Components jsou výchozí volba. `"use client"` jen tam, kde je potřeba
  stav nebo interakce v prohlížeči — typicky formuláře s `useActionState`.
- **Každá Server Action musí na začátku ověřit přihlášení** přes `requireUser()`.
  Akce jsou dosažitelné přímým POST requestem, ne jen z našeho UI.
- Data se do komponent předávají už vybraná (`select`), ne celé záznamy
  z databáze — hlavně u klientského portálu, kam nesmí uniknout interní
  poznámky.
- Komentáře psát jen tam, kde kód sám nevysvětlí důvod. Ne popis toho, co je
  na následujícím řádku vidět.

## Na co si dát pozor

- Portálový token se ukládá jako SHA-256 hash (musí být dohledatelný podle
  odkazu), PIN jako argon2 hash. Ani jedno se nikde neloguje.
- Do klientského portálu patří jen `portalNote`, `previewUrl`, fáze, schválení,
  vlastní připomínky klienta a přílohy s `visibleInPortal`. Nic dalšího.
- Přílohy se nikdy nevydávají veřejnou adresou, vždy přes
  `/api/attachments/[id]`, který ověřuje přístup.
- Automatické události v komunikaci (`SYSTEM_EVENT`) a připomínky klienta
  (`PORTAL_FEEDBACK`) se nedají mazat ani editovat — slouží jako doklad.
- `.env` do gitu nepatří. Nové proměnné dopište do `.env.example`.

## Pasti, na které jsme narazili

Tohle jsou chyby, které nás už stály čas. Každá se pozná pozdě a působí jako něco
jiného, než čím je.

**Nahrávání souborů selže nad 1 MB.** Server Actions mají tělo požadavku
omezené na 1 MB, takže požadavek se zamítne ještě před spuštěním akce a kontrola
velikosti uvnitř se k tomu nedostane. Limit zvedá `experimental.serverActions
.bodySizeLimit` v `next.config.ts`. Nad 4,5 MB to stejně neprojde, protože tam má
strop Vercel — proto je `MAX_UPLOAD_BYTES` na 4 MB a velké fotky se zmenšují
v prohlížeči.

**Modul s `"use server"` smí exportovat jen asynchronní funkce.** Konstanta z něj
je v prohlížeči `undefined`, bez chyby a bez varování — políčka se prostě
vykreslí prázdná. Sdílené konstanty patří do obyčejného modulu.

**Klientská komponenta nesmí importovat modul se `server-only`.** Rozsype to build
celé stránky na černou obrazovku. Když konstantu potřebuje server i prohlížeč, dej
ji do modulu bez `server-only` a ze serverového ji jen znovu vyvez.

**Po změně schématu restartuj vývojový server.** `prisma generate` sám nestačí,
běžící server drží starého klienta a hlásí „Cannot read properties of undefined
(reading 'findUnique')" nebo „Unknown field". Vypadá to jako chyba v dotazu.

**Lockfile generuj na Linuxu.** `npm install` na macOS zahodí volitelné balíčky
`@emnapi/*`, které existují jen pro Linux, a CI pak spadne na `npm ci` ještě před
prvním testem. Pomůže:

```bash
docker run --rm -v "$PWD":/app -w /app node:22 npm install --package-lock-only
```

`--package-lock-only` je důležité — bez něj kontejner přepíše `node_modules`
linuxovými binárkami a lokální vývoj přestane fungovat.

**Neřízený input si po překreslení nechá starou hodnotu.** React ho
nepřemountuje, takže termín zadaný u jedné fáze se ukazoval i u druhé, i když
v databázi bylo správně. Řeší to `key` vázaný na id záznamu.

**Data z formuláře vs. React stav.** Když se z jednoho formuláře skládá text
a z druhého ukládá, čti hodnoty z jednoho společného stavu. Jinak se do databáze
zapíše nula, i když na obrazovce je částka.
