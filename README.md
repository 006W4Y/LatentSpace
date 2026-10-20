# LatentSpace

**Deine lokale Datenwerkstatt.** Importiere eine Tabelle, prüfe die Spaltenrollen und entdecke Trends, Gruppen, Zusammenhänge und ungewöhnliche Beispiele – ohne Code und ohne externen KI-Dienst.

Diese erste funktionsfähige Version richtet sich an Menschen, die ihre Daten verstehen möchten. Die Datenlandschaft ist eine von mehreren verknüpften Perspektiven.

## Schnellstart mit Docker

```bash
git clone https://github.com/006W4Y/LatentSpace.git
cd LatentSpace
docker compose up --build
```

Öffne **http://localhost:8000** und wähle **Mit Beispieldaten starten**. Die Beispieldaten sind synthetische Handelsdaten mit drei Standorten und eingebauten Auffälligkeiten.

Docker Compose speichert importierte Datensätze in einem benannten Volume. `docker compose down` erhält sie; `docker compose down -v` löscht das Volume. Der Dienst wird nur an die lokale Loopback-Adresse gebunden.

## Lokal entwickeln

Voraussetzungen: **Python 3.12**, **Node.js 24** und npm. Die Befehle werden im Repository-Verzeichnis ausgeführt.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend ci
```

Backend in Terminal 1:

```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Frontend in Terminal 2:

```bash
npm --prefix frontend run dev
```

Öffne **http://localhost:5173**. Vite leitet API-Anfragen an das Backend weiter. Die interaktive API-Dokumentation findest du unter **http://localhost:8000/docs**.

Alternativ einmal bauen und über einen Server betreiben:

```bash
npm --prefix frontend run build
# Server nach dem Build starten, damit er frontend/dist erkennt.
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

## Was bereits funktioniert

| Aufgabe | Umsetzung |
| --- | --- |
| Daten importieren | CSV mit automatischer Trennzeichenerkennung und UTF-8-/Windows-Kodierung; XLSX, erstes Tabellenblatt |
| Daten vorbereiten | Dezimalformat auswählen, Rollen überprüfen, Modellmerkmale festlegen |
| Überblick gewinnen | Verteilungen, Mittelwert, Median, fehlende Werte und Datenprofile |
| Zeitverläufe erkunden | Tag/Woche/Monat; Summe, Durchschnitt oder Zeilenzahl |
| Gruppen vergleichen | Kategorien vergleichen; automatisch gefundene HDBSCAN-Gruppen untersuchen |
| Auffälligkeiten prüfen | Isolation Forest, sortierte Beispiele und Originalwerte im Inspector |
| Zusammenhänge untersuchen | Pearson-Korrelation mit Anzahl vollständiger Wertepaare |
| Datenlandschaft erkunden | PCA/UMAP; 2D und orthografische 3D-Ansicht; Zoomen, Verschieben/Drehen und Rechteckauswahl |
| Auswahl weiterverwenden | Suche und Filter gelten ansichtsübergreifend; gefilterte CSV exportieren |
| Arbeit nachvollziehen | Analysekonfiguration samt Parametern, Seed und Paketversionen als JSON exportieren; Filteransichten im Browser merken |

## Import und Grenzen

- Maximal **20 MB, 20.000 Datenzeilen, 80 Spalten**, davon höchstens **40 Modellmerkmale**. Laufzeiten hängen von Daten und Hardware ab; diese Grenzen sind keine Performancegarantie.
- Die erste Zeile muss eindeutige Spaltennamen enthalten. Bei Excel wird nur das erste Tabellenblatt eingelesen; weitere Blätter werden in einem Hinweis genannt.
- Das Dezimalformat gilt für Textwerte: `1234.56` oder `1.234,56`. Native Excel-Zahlen werden nicht umskaliert. Datumswerte werden mit UTC normalisiert; deutsche Datumsangaben wie `01.02.2026` werden als Tag.Monat.Jahr gelesen.
- Spaltenrollen sind Vorschläge. Kennungen und numerische Kategoriecodes müssen beim Import geprüft werden. Nur ausgewählte numerische Messwerte fließen in Modellanalysen ein.
- Für Cluster, Auffälligkeiten und Projektion werden fehlende Werte mit dem Median ergänzt und Messwerte standardisiert. Originaldaten, Verteilungen und Zeitaggregate behalten fehlende Werte bei. Ungültige Konvertierungen werden gemeldet.
- Cluster und Anomalien werden im standardisierten **Merkmalsraum** berechnet, nicht auf den sichtbaren Projektionskoordinaten. Filter ändern die beschreibenden Statistiken, aber trainieren diese Modelle nicht neu.
- Ein Anomaliescore ist keine Fehlerwahrscheinlichkeit. Eine Projektion beweist keine Datenlücken; Korrelation belegt keine Ursache. Die App stellt diese Grenzen bei den jeweiligen Ansichten dar.
- Für UMAP ist der erste Start wegen der JIT-Kompilierung langsamer. Bei weniger als sechs Zeilen wird PCA verwendet; bei fehlenden variierenden Messwerten bleiben Tabellen und Gruppenvergleiche verfügbar.

## Speicherung und Betrieb

Datensätze liegen in `data/latentspace.sqlite3` oder im Verzeichnis aus `LATENTSPACE_DATA_DIR`. Die App besitzt keine Cloudanbindung und lädt keine externen Schriftarten oder Analysemodelle. Nach Installation ihrer Abhängigkeiten funktioniert sie mit eigenen Dateien offline.

Berechnungen laufen in einem Hintergrundthread mit einer Warteschlange. Es werden maximal vier laufende/wartende Jobs angenommen und bis zu acht Jobs im Arbeitsspeicher gehalten. Analyseergebnisse werden nach einem Serverneustart neu berechnet. Die Datensätze bleiben erhalten. Gespeicherte Ansichten enthalten Filter und Tab in `localStorage` dieses Browsers, keine dauerhaften Ergebnis-Snapshots.

**Lokaler Einzelbetrieb:** Es gibt noch keine Anmeldung, Benutzertrennung oder Freigabefunktion. Deshalb das Backend nicht offen ins Internet stellen und nur einen Uvicorn-Prozess verwenden; Jobzustände werden nicht zwischen Prozessen geteilt.

## Tests

```bash
python -m pytest backend/tests -q
npm --prefix frontend run build
```

Browserprüfungen (nach Installation der Python-Abhängigkeiten):

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Die Browserprüfungen starten eine eigene Serverinstanz mit temporärer Datenablage. GitHub Actions führt die Backend-Tests und den Frontend-Build aus.

## Projektstruktur

```text
backend/app/data.py        Import, Rollenvorschläge, SQLite
backend/app/analysis.py    Vorverarbeitung, Modelle, gefilterte Statistiken
backend/app/main.py        FastAPI, Job-Warteschlange, Export, Webauslieferung
backend/tests/            Fachliche und API-Tests
frontend/src/App.tsx       Arbeitsbereich und Analyseansichten
frontend/src/components/  Interaktive Datenlandschaft
docs/ROADMAP.md            Nächste Ausbaustufen
```

Technische Grundlage: React/TypeScript, Vite, Recharts, Canvas, FastAPI, pandas, scikit-learn und umap-learn.
