# Nahrání Tiebreak na Netlify

Aplikace se na Netlify publikuje jako statický web. Vývojový server `npm run dev` ani `npm start` se tam nespouští. JavaScript, CSS, fonty a ukázková data se připraví při sestavení do složky `dist/`.

## Varianta 1: propojení s Git repozitářem

1. Commitni a pushni aktuální změny včetně `netlify.toml` a `.nvmrc` do svého repozitáře.
2. Na Netlify vyber import existujícího projektu z Gitu a tento repozitář.
3. Nastavení je uložené v `netlify.toml`:

| Pole | Hodnota |
| --- | --- |
| Base directory | kořen repozitáře (`.`) |
| Package directory | nechat prázdné |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node.js | 22, podle `.nvmrc` |

Netlify nainstaluje závislosti z `package.json`, spustí build a zveřejní soubory z `dist/`. `NPM_FLAGS=--include=dev` v konfiguraci zajistí přítomnost sestavovacího nástroje esbuild. Nejsou potřeba API klíče, databáze ani Functions. Konfigurace v repozitáři má přednost před odpovídajícími hodnotami v Netlify UI.

## Varianta 2: ruční upload

Hotový balíček je **`artifacts/tiebreak.zip`**. Na [Netlify Drop](https://app.netlify.com/drop) nahraj tento ZIP, případně ho rozbal a nahraj složku s jeho obsahem. Pro aktualizaci existujícího webu použij ruční upload v jeho sekci Deploys. `index.html` musí být přímo v kořeni nahrávaného webu, vedle `assets/`, `favicon.svg` a `licenses/`.

Nový balíček vytvoříš lokálně:

```sh
npm ci
npm run package
```

Příkaz vytvoří `dist/`, ověří odkazy na JavaScript, CSS a fonty a vygeneruje ZIP s kontrolním součtem. Nevyžaduje Chrome ani spuštění browserových testů. Pro ruční upload lze použít také přímo sestavenou složku `dist/`.

Zdrojový ZIP stažený z GitHubu a složka s celým repozitářem nejsou hotový web pro statický upload: v kořeni zdrojů neexistuje sestavená složka `assets/`.

## Kontrola po nasazení

1. Otevři veřejnou adresu a klikni na **Try as guest**, případně připoj k adrese `/#/guest`.
2. Ověř dashboard, vytvoření ankety a hlasování. Stránka se nesmí zastavit na „Getting the table ready…“.
3. Obnov stránku po hlasování; na stejném zařízení a doméně se má zobrazit již započítaný hlas.

Jde stále o frontendový režim pro jedno zařízení. Data z `localhost` se na novou Netlify doménu nepřenesou; demo se na nové doméně vytvoří znovu. Hlasovací odkazy nesdílejí stav mezi zařízeními.

## Pokud se místo aplikace objeví chyba

- **„Getting the table ready…“ nebo chybějící JS/CSS:** zkontroluj, že se publikuje `dist`, případně nahraj hotový `artifacts/tiebreak.zip` místo zdrojového archivu.
- **Build hledá `package.json` v nesprávné složce:** base directory musí být kořen repozitáře.
- **Chybí esbuild:** zkontroluj, že deploy používá aktuální `netlify.toml`; build potřebuje i vývojové závislosti.
- **Stará konfigurace po změně nastavení:** spusť nový deploy z aktuálního commitu. Lokální změny Netlify neuvidí, dokud nejsou pushnuté.

Příprava a ověření probíhají lokálně. Žádný skript tohoto projektu sám nic nenahrává ani nezakládá vzdálený server.

Oficiální podklady: [konfigurace Netlify](https://docs.netlify.com/build/configure-builds/file-based-configuration/), [Node.js a závislosti](https://docs.netlify.com/build/configure-builds/manage-dependencies/), [import projektu a ruční upload](https://docs.netlify.com/manage/projects/add-new-project/).
