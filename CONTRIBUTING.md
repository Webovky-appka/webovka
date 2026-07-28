# Jak se na projektu pracuje

## Než začnete

Rozjezd lokálního prostředí je popsaný v [README.md](README.md). Zadání
a rozsah v1 jsou v [REQUIREMENTS.md](REQUIREMENTS.md) — nové funkce prosím
nejdřív dopište tam, ať je jasné, co je v rozsahu a co ne.

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
