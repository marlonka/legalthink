# Ladeleistung

Messung vom 3. Oktober 2026. Startansicht des Produktionsbuilds, frischer Browsercache, leerer lokaler Arbeitsbereich ohne OpenAI-Schlüssel. Lighthouse 13.5.0 mit Chrome 154 unter Windows. Die Kategorien Performance und Best Practices verwenden unveränderte Lighthouse-Bewertungen.

## Ergebnis

| Profil | Stand | Performance | Best Practices | FCP | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Mobil | Vorher | 77 | 100 | 3,61 s | 4,37 s | 14 ms | 0 |
| Mobil | Nachher | 97 | 100 | 1,81 s | 2,42 s | 0 ms | 0 |
| Desktop | Vorher | 99 | 100 | 0,76 s | 0,89 s | 0 ms | 0 |
| Desktop | Nachher | 100 | 100 | 0,42 s | 0,55 s | 0 ms | 0 |

FCP misst den ersten sichtbaren Inhalt, LCP den größten sichtbaren Inhalt, TBT blockierende JavaScript-Zeit und CLS unerwartete Layoutverschiebungen beim Laden.

Mobil: Lighthouse-Standardprofil, 412 × 823 CSS-Pixel, simulierte 150 ms RTT, 1.638,4 kbit/s und vierfache CPU-Verlangsamung. Desktop: unverändertes Desktop-Preset. Je ein Ausgangs- und Abschlusslauf pro Profil; Zwischenläufe dienten der Ursachenprüfung. Die Tabelle zeigt den Abschlusslauf, nicht den besten Zwischenwert.

## Änderungen

- JavaScript und CSS unter `/assets` werden mit GZip übertragen. Der Haupt-JavaScript-Transfer sinkt von rund 461 kB auf 129 kB; zusätzlich wird ein gemeinsames Icon-Modul mit rund 6 kB geladen.
- Vite-Dateien mit Inhaltshash erhalten ein Jahr Browsercache mit `immutable`. HTML und unversionierte öffentliche Dateien werden vor Wiederverwendung neu angefragt. API-Antworten und Originaldokumente behalten `Cache-Control: no-store`; die neue Kompression gilt ausschließlich für öffentliche Build-Dateien.
- Die beim Start benötigten Inter-Schriften 400 und 500 werden bereits aus dem HTML vorgeladen. Sie bleiben lokal gehostet und verwenden dieselben Dateien wie das Stylesheet.
- Ergebnisansicht und Verwaltungsseiten laden ihren Code erst beim Aufruf. Die Startansicht bleibt direkt verfügbar. Ein fehlgeschlagener Seitenimport zeigt einen lokalen Fehlerzustand; der Arbeitsbereich mit seinen Entwürfen bleibt erhalten.

## Aussagegrenzen

97 auf dem gedrosselten Mobilprofil ist kein gemessenes 100. Der verbleibende Aufwand liegt vor allem im Laden und Ausführen der Anwendung vor dem ersten Inhalt. Die Best-Practices-Wertung ist kein vollständiger Sicherheits- oder Barrierefreiheitsnachweis.

Die Messung untersucht `#new` auf `127.0.0.1`; sie bewertet weder OpenAI-Antwortzeiten noch große Dokumentvorschauen oder einen veröffentlichten Server. Ein Hosting muss separat mit seiner tatsächlichen Adresse, HTTPS-Konfiguration und Netzwerklatenz gemessen werden. Lokale Adressen gelten im Browser als vertrauenswürdiger Kontext.

CLS 0 betrifft den gemessenen Seitenstart. Interaktive Stabilität wird zusätzlich an betroffenen Bedienelementen geprüft; sie folgt nicht automatisch aus einem guten Lighthouse-Wert. Die Werte können durch Gerät, Betriebssystemlast und Hosting schwanken.

## Erneut messen

Produktionsbuild mit `npm run build` erstellen. Einen separaten lokalen Arbeitsbereich ohne API-Schlüssel starten. Für den beschriebenen Lauf wurde Port 8015 verwendet.

```powershell
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm exec --yes --package=lighthouse@13.5.0 -- lighthouse 'http://127.0.0.1:8015/#new' --only-categories=performance,best-practices --output=json --output=html --output-path=artifacts/lighthouse-mobile --chrome-flags='--headless --disable-gpu --no-first-run' --quiet
npm exec --yes --package=lighthouse@13.5.0 -- lighthouse 'http://127.0.0.1:8015/#new' --preset=desktop --only-categories=performance,best-practices --output=json --output=html --output-path=artifacts/lighthouse-desktop --chrome-flags='--headless --disable-gpu --no-first-run' --quiet
```

Die vollständigen lokalen Ausgangs- und Abschlussberichte liegen unter `artifacts/lighthouse-{before,final}-{mobile,desktop}.report.{json,html}`. Der Ordner ist nicht Teil des Repositories; Berichte aus echten Arbeitsbereichen können sichtbare Nutzerdaten enthalten.

## Grundlagen

- [Lighthouse-Bewertung und Messschwankungen](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
- [Ursachen und Messung von Layoutverschiebungen](https://web.dev/articles/optimize-cls)
- [Schriften laden und Layoutverschiebungen vermeiden](https://web.dev/articles/font-best-practices)
- [Cache-Control: versionierte Dateien und Revalidierung](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
