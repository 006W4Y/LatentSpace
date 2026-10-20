# LatentSpace

**Deine lokale Datenwerkstatt.** Importiere eine Tabelle, prüfe die Spaltenrollen und entdecke Trends, Gruppen, Zusammenhänge und ungewöhnliche Beispiele – ohne Code und ohne externen KI-Dienst.

Diese erste funktionsfähige Version richtet sich an Menschen, die ihre Daten verstehen möchten. Die Datenlandschaft ist eine von mehreren verknüpften Perspektiven.

**Version 0.2 konzentriert sich auf Erkenntnisse:** Auffälligkeiten werden mit konkreten Vergleichswerten erklärt, automatische Befunde sind nach Themen durchsuchbar und lassen sich als Analysebericht an Fachleute weitergeben. Die Originaldaten werden nicht bearbeitet.

## Schnellstart mit Docker

```bash
git clone https://github.com/006W4Y/LatentSpace.git
cd LatentSpace
docker compose up --build
```

Öffne **http://localhost:8000** und importiere eine Datei oder wähle einen der drei Beispieldatensätze. **Mit Beispieldaten starten** öffnet weiterhin direkt die Handelsdaten.

## Drei unterschiedliche Beispielkontexte

Alle Beispiele sind synthetisch, reproduzierbar und auf der Startseite sowie im Importdialog einzeln auswählbar. Jede Analyse untersucht **eine Datei bzw. einen Datensatz**. Es werden keine Tabellen verbunden oder Dateien miteinander verglichen.

| Beispiel | Eine Zeile bedeutet | Umfang | Was sich damit erkunden lässt |
| --- | --- | --- | --- |
| Handel & Bestellungen | Eine Bestellung | 720 Zeilen, 8 Spalten | Standortunterschiede, unregelmäßige Bestellzeitpunkte, hohe Einzelumsätze, fehlende Lieferzeiten |
| Energie & Gebäude | Ein Gebäude an einem Tag | 540 Zeilen, 8 Spalten | Messungen über einen Jahreswechsel, negative Temperaturen, Verbrauch und Belegung, zusammenhängender Sensorausfall |
| Lernen & Kursnutzung | Eine Person in einem Kurs | 420 Zeilen, 8 Spalten | Querschnitt ohne Datum, Kursformate, Zusammenhänge von Lernaufwand und Ergebnissen, ungewöhnliche Kombinationen innerhalb begrenzter Skalen, Kennungen mit führenden Nullen |

Die Beispiele durchlaufen dieselben Analysen wie eigene Dateien. Es gibt keine vorgefertigten Insight-Ergebnisse oder besonderen Erkennungsschwellen je Beispiel. Muster sind zur Erprobung eingebaut; die Modellmarkierungen sind keine vollständige Liste dieser Muster. Gebäudemessungen wiederholen sich je Gebäude, die Lernstudie ist keine kausale Untersuchung. Beide Hinweise bleiben bei den Datensätzen sichtbar.

Zeit- und Gruppenansichten starten mit dem **Durchschnitt**. Summe, Median und Zeilenzahl lassen sich ausdrücklich auswählen. So werden Temperaturen oder Punktzahlen nicht automatisch aufsummiert. Ohne Datumsspalte entstehen keine Zeittrends; andere Ansichten bleiben nutzbar.

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
| Insights entdecken | Bis zu 16 automatische Befunde mit Zahlenbelegen, Vergleichsbasis, Methoden und Verknüpfung zur Detailansicht |
| Überblick gewinnen | Verteilungen, Mittelwert, Median, fehlende Werte und Datenprofile |
| Zeitverläufe erkunden | Tag/Woche/Monat; Summe, Durchschnitt oder Zeilenzahl |
| Gruppen vergleichen | Kategorien vergleichen; automatisch gefundene HDBSCAN-Gruppen untersuchen |
| Auffälligkeiten verstehen | Isolation Forest plus statistische Einzelvergleiche: Wert, Median, Quartile und tatsächlich ähnliche Zeilen |
| Zusammenhänge untersuchen | Pearson- und Spearman-Korrelation mit Anzahl vollständiger Wertepaare |
| Verteilungen lesen | Chronologische Monatsnamen, benannte Kategorien, diskrete Zählwerte und eindeutig beschriftete Histogramme; Kennungen ohne Scheinverteilung |
| Datenlandschaft erkunden | PCA/UMAP; 2D und orthografische 3D-Ansicht; Zoomen, Verschieben/Drehen und Rechteckauswahl |
| Auswahl weiterverwenden | Suche und Filter gelten ansichtsübergreifend; gefilterte CSV exportieren |
| Arbeit nachvollziehen | Analysekonfiguration samt Parametern, Seed und Paketversionen als JSON exportieren; Filteransichten im Browser merken |
| Erkenntnisse übergeben | Markdown-/JSON-Bericht mit Befunden, Zeilenbezug, Erklärungen, Parametern und SHA-256-Fingerabdruck der Originalwerte |

## Was eine Erklärung bedeutet

Eine Modellmarkierung allein erklärt noch nicht, was an einer Zeile ungewöhnlich ist. Der Inspector zeigt deshalb zusätzlich beobachtete Abweichungen:

- Vergleich eines Messwerts mit Median und mittleren 50 % der **übrigen** Zeilen. Die untersuchte Zeile wird aus ihrer Referenz ausgeschlossen.
- Bei mehreren Modellmerkmalen: Vergleich mit Nachbarn, die anhand der **jeweils anderen, tatsächlich beobachteten Merkmale** ausgewählt wurden. Zeilen mit fehlenden Vergleichsmerkmalen werden ausgelassen. Mindestens fünf Referenzwerte und ein ausreichend kleiner standardisierter Abstand sind Voraussetzung. Eine entfernte Nachbarschaft wird nicht als ähnlich ausgegeben.
- Fehlende Originalwerte werden nicht als beobachtete Messwerte erklärt. Ist kein belastbarer Einzelhinweis vorhanden, wird das ausdrücklich angezeigt.

Diese Vergleiche sind **keine exakte Zerlegung des Isolation-Forest-Scores und keine kausale Erklärung**. Im Bericht stehen Vergleichsgröße, Stichprobengröße und methodische Grenzen.

Die Insight-Ansicht erkennt unter anderem Quartilsabweichungen, Unterschiede von Gruppenmedianen, Kategorie-Konzentrationen, Korrelationen, fehlende Werte und Änderungen von Monatsmitteln. Monatsvergleiche verwenden nur Monate, deren Kalendergrenzen vom beobachteten Zeitraum abgedeckt sind. Die Befunde sind explorativ; es werden keine statistische Signifikanz, vollständige Erfassung oder zukünftige Entwicklungen behauptet.

Zur Weitergabe **Bericht exportieren** wählen: Markdown bietet einen lesbaren Bericht; JSON enthält zusätzlich vollständige strukturierte Befunde, Zeilen-IDs und Vergleichswerte. CSV-Exporte ergänzen die 1-basierte Datenzeile, den Anomaliescore und Modellmarkierungen. Originalspalten werden bei Namenskonflikten nicht überschrieben.

## Import und Grenzen

- Maximal **20 MB, 20.000 Datenzeilen, 80 Spalten**, davon höchstens **40 Modellmerkmale**. Laufzeiten hängen von Daten und Hardware ab; diese Grenzen sind keine Performancegarantie.
- Die erste Zeile muss eindeutige Spaltennamen enthalten. Bei Excel wird nur das erste Tabellenblatt eingelesen; weitere Blätter werden in einem Hinweis genannt.
- Das Dezimalformat gilt für Textwerte: `1234.56` oder `1.234,56`. Native Excel-Zahlen werden nicht umskaliert. Datumswerte werden mit UTC normalisiert; deutsche Datumsangaben wie `01.02.2026` werden als Tag.Monat.Jahr gelesen.
- Spaltenrollen sind Vorschläge. Kennungen und numerische Kategoriecodes müssen beim Import geprüft werden. Nur ausgewählte numerische Messwerte fließen in Modellanalysen ein.
- Für Cluster, Auffälligkeiten und Projektion werden fehlende Werte mit dem Median ergänzt und Messwerte standardisiert. Originaldaten, Verteilungen und Zeitaggregate behalten fehlende Werte bei. Ungültige Konvertierungen werden gemeldet.
- Cluster und Anomalien werden im standardisierten **Merkmalsraum** berechnet, nicht auf den sichtbaren Projektionskoordinaten. Filter ändern die beschreibenden Statistiken, aber trainieren diese Modelle nicht neu.
- Ein Anomaliescore ist keine Fehlerwahrscheinlichkeit. Eine Projektion beweist keine Datenlücken; Korrelation belegt keine Ursache. Die App stellt diese Grenzen bei den jeweiligen Ansichten dar.
- Monatscodes werden nur in ausdrücklich benannten Monatsspalten (`Monat`, `month`, `Monatsnummer`, `month_index`) interpretiert. Enthalten sie eine 0, gilt 0=Januar; sonst 1=Januar. Die verwendete Konvention wird bei der Verteilung genannt. Ohne 0 ist die Kodierung nicht eindeutig ableitbar; die Werte selbst bleiben erhalten.
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

Die Kontexttests importieren alle drei Beispiele als gewöhnliche CSV-Dateien, jeweils mit dem festen Demoseed und einem weiteren Seed. Sie prüfen nachvollziehbare Befunde, unveränderte Originalwerte, Berichte und die fehlende Zeitachse der Lernstudie. Zusätzliche Prüfungen benennen alle Spalten um und vergleichen die Analyseergebnisse. Das schützt vor einer Bindung an Handelsbegriffe; synthetische Tests ersetzen keine Erprobung mit echten Nutzerdaten.

## Projektstruktur

```text
backend/app/data.py        Import, Rollenvorschläge, SQLite
backend/app/demos.py       Drei unabhängige synthetische Beispielkontexte
backend/app/analysis.py    Vorverarbeitung, Modelle, gefilterte Statistiken
backend/app/insights.py    Typgerechte Datenprofile und automatische Befunde
backend/app/explanations.py Statistische Vergleichswerte für einzelne Zeilen
backend/app/reports.py     Analystenberichte als Markdown und JSON
backend/app/main.py        FastAPI, Job-Warteschlange, Export, Webauslieferung
backend/tests/            Fachliche und API-Tests
frontend/src/App.tsx       Arbeitsbereich und Analyseansichten
frontend/src/components/  Interaktive Datenlandschaft
docs/ROADMAP.md            Nächste Ausbaustufen
```

Technische Grundlage: React/TypeScript, Vite, Recharts, Canvas, FastAPI, pandas, scikit-learn und umap-learn.
