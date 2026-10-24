# LatentSpace

**Deine lokale Datenwerkstatt.** Importiere eine Tabelle, prüfe die Spaltenrollen und entdecke Trends, Gruppen, Zusammenhänge und ungewöhnliche Beispiele – ohne Code und ohne externen KI-Dienst.

LatentSpace richtet sich an Menschen, die Eigenschaften, Verteilungen und Beziehungen ihrer Daten erkunden möchten. Die Datenlandschaft ist eine von mehreren verknüpften Perspektiven.

**Version 0.4 macht Aussagen und Vergleichsgrundlagen ausdrücklich nachvollziehbar:** Beobachtung, Suchregel und Modellmarkierung sind getrennt ausgewiesen. Rollen, Datumsfolgen, Monatscodes und Einheitenlabels lassen sich wählen; Befunde sind nach berechneten Maßen sortierbar. Gespeicherte Auslassvergleiche zeigen, wie einzelne Beobachtungen die Kennzahlen verändern. Die Originaldaten werden nicht bearbeitet.

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
| Insights entdecken | Bis zu 40 automatische Befunde (höchstens acht je Themenfamilie) mit Zahlenbelegen, Vergleichsbasis, Methoden und Verknüpfung zur Detailansicht |
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
| Befunde untersuchen | Feste Referenzauswahl, gemeinsame Histogrammgrenzen, Gruppenwerte, Streudiagramme und blätterbare Befund-/Vergleichszeilen |
| Daten diagnostizieren | Fehlwertmuster nach Gruppe und Kalendermonat, wählbare Duplikatschlüssel, seltene Kategorienkombinationen, lineare Redundanz und Sensitivitätsprüfungen |
| Gruppenmuster aufdecken | Gleichgerichtete Korrelationen innerhalb von Gruppen bei schwachem globalem Zusammenhang |
| Untersuchung fortsetzen | Befunde mit Notizen und Referenz-IDs sowie Analyseparameter, Filter und Ansicht dauerhaft in SQLite speichern |

## Was eine Erklärung bedeutet

Eine Modellmarkierung allein erklärt noch nicht, was an einer Zeile ungewöhnlich ist. Der Inspector zeigt deshalb zusätzlich beobachtete Abweichungen:

- Vergleich eines Messwerts mit Median und mittleren 50 % der **übrigen** Zeilen. Die untersuchte Zeile wird aus ihrer Referenz ausgeschlossen.
- Bei mehreren Modellmerkmalen: Vergleich mit Nachbarn, die anhand der **jeweils anderen, tatsächlich beobachteten Merkmale** ausgewählt wurden. Zeilen mit fehlenden Vergleichsmerkmalen werden ausgelassen. Mindestens fünf Referenzwerte und ein ausreichend kleiner standardisierter Abstand sind Voraussetzung. Eine entfernte Nachbarschaft wird nicht als ähnlich ausgegeben.
- Fehlende Originalwerte werden nicht als beobachtete Messwerte erklärt. Ist kein belastbarer Einzelhinweis vorhanden, wird das ausdrücklich angezeigt.

**Welcher Wert fällt auf?** Die Auffälligkeitenliste nennt die tatsächlich abweichenden Merkmale mit ihrem Originalwert, Richtung und Vergleichsmedian – unabhängig von der Spaltenreihenfolge. In der Datentabelle und unter „Ursprüngliche Werte“ in der Detailansicht werden die betreffenden Zellen orange hervorgehoben. Ein Klick auf einen markierten Tabellenwert öffnet den Vergleich samt Prüfregel und Stichprobengröße. Alle belegten Merkmale werden berücksichtigt; die Markierung ist nicht auf die ersten zwei Spalten oder drei Hinweise beschränkt.

Ein Einzelhinweis erfordert eine überschrittene Quartilsgrenze (1,5 × Quartilsabstand), mindestens drei Vergleichsstreuungen Abstand vom Median oder eine Abweichung von konstanten Vergleichswerten. Die jeweils erfüllte Regel steht direkt im Vergleich und im Bericht. Ein statistischer Einzelhinweis ist keine exakte Erklärung der Modellentscheidung. Markiert das Modell eine Zeile, ohne dass die Einzelvergleiche einen Wert belegen, erscheint **„Nur Modellmarkierung · kein Einzelwert belegt“**; dabei wird keine einzelne Zelle hervorgehoben. Für die Datentabelle werden Erklärungen nur für markierte Zeilen der angeforderten Seite berechnet; Modellparameter und Referenzen bleiben beim Filtern unverändert.

Diese Vergleiche sind **keine exakte Zerlegung des Isolation-Forest-Scores und keine kausale Erklärung**. Im Bericht stehen Vergleichsgröße, Stichprobengröße und methodische Grenzen.

Die Insight-Ansicht erkennt Quartilsabweichungen, Unterschiede von Gruppenmedianen, Kategorie-Konzentrationen, Korrelationen, fehlende Werte und Änderungen von Monatsmitteln. Geeignete Messwert-, Kategorien- und Datumsspalten werden vollständig berücksichtigt. Alle gefundenen Befunde werden gezählt. Die Anzeige lässt sich alphabetisch, nach numerischem Unterschied / Referenz-IQR, absolutem Pearson r, Anzahl vollständiger Zeilen oder Datenabdeckung sortieren und nach Thema oder Ergebnisart filtern. Fehlende Sortiermaße stehen am Ende; bei Gleichstand entscheidet die Befund-ID. Es gibt keine angenommene fachliche Wichtigkeit. Korrelationen werden vor der Anzeigeauswahl auf genügend vollständige Wertepaare geprüft. Monatsvergleiche verwenden nur Monate, deren Kalendergrenzen vom beobachteten Zeitraum abgedeckt sind. Die Befunde sind explorativ; es werden keine statistische Signifikanz, vollständige Erfassung oder zukünftige Entwicklungen behauptet.

Zur Weitergabe **Bericht exportieren** wählen: Markdown bietet einen lesbaren Bericht; JSON enthält strukturierte Befunde, Zeilen-IDs und Vergleichswerte. Beide exportieren die aktuelle Befundseite einschließlich Gesamtzählung, Filter und Sortierung. Einzelne gespeicherte Befunde enthalten weiterhin alle zugeordneten Zeilen. CSV-Exporte ergänzen die 1-basierte Datenzeile, den Anomaliescore und Modellmarkierungen. Originalspalten werden bei Namenskonflikten nicht überschrieben. Die zusätzliche Spalte `LatentSpace_Modellmarkierung` benennt das Modellergebnis ausdrücklich.

## Befundwerkstatt und Datendiagnose

1. **Insights → Befund untersuchen** öffnet eine eigene Vergleichsansicht. Sie zeigt die damalige Referenz, Befundzeilen, übrige Zeilen und gemeinsame Verteilungsgrenzen. Bei zwei Messwerten ergänzt ein Streudiagramm die Untersuchung; Gruppen werden farblich unterschieden. Ab 1.500 Punkten wird die Anzeige deterministisch reduziert, mit sichtbarer Anzahl. Die Berechnungen verwenden weiterhin die vollständige Referenz.
2. Die zugehörigen Zellen erhalten den **Beleg des Befunds**. Ein Quartilsbefund benötigt keine zusätzliche Isolation-Forest-Markierung. Grenzen, Median und betroffene Zeilen stammen aus derselben damaligen Auswahl. Die Modellmarkierung steht separat daneben. Fehlwerte und gewählte Duplikatschlüssel besitzen ebenfalls eigene Zellbelege.
3. **Analyseabdeckung & Duplikatschlüssel** zeigt geprüfte Spalten und Kombinationen sowie alle gefundenen Kandidaten vor der Anzeigeauswahl. Wähle bis zu acht Spalten als fachlichen Schlüssel. Alle Mitglieder mehrfach vorkommender vollständiger Schlüssel werden ausgewiesen; unvollständige Schlüssel werden mit Anzahl ausgeschlossen. Null Treffer werden ebenfalls in der Schlüsselprüfung angezeigt.
4. Im Befund kannst du **Name und Notizen speichern** und später unter **Gespeicherte Befunde** erneut öffnen. Die Referenz bleibt nach Filterwechsel und Serverneustart erhalten. Der JSON-Export enthält sämtliche Befundzeilen mit Originalwerten, Referenz-IDs, Grenzen, Parametern und Notizen. Tabellenansichten zeigen jeweils 50 Zeilen.
5. **Ansicht merken** speichert einen Analysestand mit Rollen, Modellparametern, Filtern, Schlüsselwahl und Tab in SQLite. Beim Öffnen wird das Modell erneut mit diesen Parametern berechnet. Bereits vorhandene Browseransichten bleiben weiterhin zugänglich.

Neue Diagnosen verwenden explizite Eignungsregeln:

| Diagnose | Mindestbasis und Regel |
| --- | --- |
| Strukturierte Fehlwerte | Gruppe oder Gruppe × Kalendermonat: mindestens zehn Zeilen und fünf Fehlwerte; mindestens 30 übrige Zeilen; mindestens 25 Prozentpunkte und dreifache Fehlwertrate gegenüber dem Rest |
| Gruppenabhängige Korrelation | Kategorien mit zwei bis sechs Gruppen; global mindestens 40 vollständige Paare und \|r\| ≤ 0,3; mindestens zwei gleichgerichtete Gruppen mit je 20 Paaren und \|r\| ≥ 0,6 |
| Nahezu lineare Doppelung | Mindestens 30 Paare; \|Pearson\| und \|Spearman\| ≥ 0,995; relative Reststreuung einer linearen Abbildung ≤ 1 % |
| Empfindlicher Zusammenhang | Mindestens 33 Paare und \|r\| ≥ 0,5; nach gemeinsamem Auslassen der drei größten Einzel-Auslasswirkungen verändert sich r um mindestens 0,35 |
| Seltene Kategorienkombination | Mindestens 200 vollständige Paare; eine bis zwei beobachtete Kombinationen bei rechnerischer Unabhängigkeitsreferenz ≥ 15 und Verhältnis ≤ 0,1 |

Für Kategorievergleiche werden bis zu 30 Ausprägungen je Spalte zugelassen. Diagnosen sind deskriptive Suchregeln. Wiederholte Messungen, Gruppenzusammensetzungen und viele gleichzeitige Vergleiche können die Interpretation beeinflussen. Die Sensitivitätsprüfung beweist keine Datenfehler; eine Redundanz führt nicht zum Löschen von Merkmalen. Eine Unabhängigkeitsreferenz ist keine fachlich erwartete Häufigkeit. Methodik und Grenzen stehen bei jedem Befund.

## Vergleichsgrundlage und Sensitivität

Jede Befundkarte nennt Verfahren, Ergebnisart, Spalten, Filter, Referenz- und Gesamtzeilenzahl, vollständige Referenzzeilen und Zellen ohne lesbaren Wert. Unter **Spaltenbasis und Interpretation** stehen Original-Fehlwerte, Konvertierungsverluste, Rollen und gewählte Darstellungen getrennt. Modellbefunde nennen zusätzlich ihre Trainingsbasis. Diese Grundlage bleibt beim Öffnen, Speichern und Export erhalten.

**Befund untersuchen → Auslassvergleich** zeigt Median, Mittelwert, Quartile und Standardabweichung vor und nach einer manuellen Auswahl. Tabellenkästchen lassen bis zu 50 Referenzzeilen testweise aus. Für numerische Spalten wird der genaue Medianbereich über alle einzelnen Auslassungen berechnet; für numerische Befundpaare zusätzlich Pearson r. Die drei größten beobachteten Einzeländerungen lassen sich direkt öffnen. Nicht definierte Korrelationen werden gezählt. Modelle werden dabei nicht neu trainiert. Vergleichsspalte und ausgelassene IDs werden mit dem Befund gespeichert und exportiert. Namen und Notizen sind als Nutzereingaben gekennzeichnet.

Die Validierung umfasst 150 unabhängige Zufallsdatensätze aus fünf Verteilungen. Auch dort entstehen Suchtreffer, insbesondere Monatsunterschiede. Die Ergebnisse sind in [docs/VALIDATION.md](docs/VALIDATION.md) und [docs/null-simulation.json](docs/null-simulation.json) dokumentiert; sie sind keine kalibrierte Fehlalarmrate.

## Import und Grenzen

- Maximal **20 MB, 20.000 Datenzeilen, 80 Spalten**, davon höchstens **40 Modellmerkmale**. Laufzeiten hängen von Daten und Hardware ab; diese Grenzen sind keine Performancegarantie.
- Die erste Zeile muss eindeutige Spaltennamen enthalten. Bei Excel wird nur das erste Tabellenblatt eingelesen; weitere Blätter werden in einem Hinweis genannt.
- Das Dezimalformat gilt für Textwerte: `1234.56` oder `1.234,56`. Native Excel-Zahlen werden nicht umskaliert. Datumswerte werden in UTC verglichen. Mehrdeutige Datumsfolgen wie `01/02/2026` benötigen ausdrücklich Tag/Monat/Jahr oder Monat/Tag/Jahr. ISO-Werte bleiben ISO; widersprechende lokale Folgen werden nicht stillschweigend anders gelesen. Unlesbare Werte werden getrennt von leeren Originalzellen ausgewiesen.
- Spaltenrollen sind Vorschläge. Kennungen und numerische Kategoriecodes müssen beim Import geprüft werden. Nur ausgewählte numerische Messwerte fließen in Modellanalysen ein.
- Für Cluster, Auffälligkeiten und Projektion werden fehlende Werte mit dem Median ergänzt und Messwerte standardisiert. Originaldaten, Verteilungen und Zeitaggregate behalten fehlende Werte bei. Ungültige Konvertierungen werden gemeldet.
- Cluster und Anomalien werden im standardisierten **Merkmalsraum** berechnet, nicht auf den sichtbaren Projektionskoordinaten. Filter ändern die beschreibenden Statistiken, aber trainieren diese Modelle nicht neu.
- Ein Anomaliescore ist keine Fehlerwahrscheinlichkeit. Eine Projektion beweist keine Datenlücken; Korrelation belegt keine Ursache. Die App stellt diese Grenzen bei den jeweiligen Ansichten dar.
- Monatsnamen entstehen nur nach ausdrücklicher Wahl **Darstellung wählen → Monatsnamen · 0 = Januar / 1 = Januar** für passende numerische oder Kategoriecodes. Kein Spaltenname legt die Monatsbasis fest. Zahlen, Rollen und Berechnungen bleiben unabhängig von dieser Beschriftung erhalten. Anzeige-/Einheitenlabels sind gekennzeichnete Nutzereingaben und verändern keine Werte.
- Für UMAP ist der erste Start wegen der JIT-Kompilierung langsamer. Bei weniger als sechs Zeilen wird PCA verwendet; bei fehlenden variierenden Messwerten bleiben Tabellen und Gruppenvergleiche verfügbar.

## Speicherung und Betrieb

Datensätze liegen in `data/latentspace.sqlite3` oder im Verzeichnis aus `LATENTSPACE_DATA_DIR`. Die App besitzt keine Cloudanbindung und lädt keine externen Schriftarten oder Analysemodelle. Nach Installation ihrer Abhängigkeiten funktioniert sie mit eigenen Dateien offline.

Berechnungen laufen in einem Hintergrundthread mit einer Warteschlange. Es werden maximal vier laufende/wartende Jobs angenommen und bis zu acht Jobs im Arbeitsspeicher gehalten. Berechnete Modelle werden nach einem Serverneustart neu berechnet. Datensätze, neue Analysestände und gespeicherte Befunde mit Referenzen und Notizen bleiben in SQLite erhalten. Befund-Snapshots enthalten die festen statistischen Belege, Referenz-IDs, damaligen Modellmarkierungen und Parameter; sie benötigen keinen laufenden Analysejob. Änderungen an den Originalwerten werden beim Öffnen über den SHA-256-Fingerabdruck erkannt. Beim Löschen eines Datensatzes werden auch seine gespeicherten Untersuchungen gelöscht. Nicht gespeicherte Befunde liegen begrenzt im Analysespeicher (bis zu 512); nach einer Verdrängung muss die Insight-Ansicht erneut geöffnet werden.

**Lokaler Einzelbetrieb:** Standardmäßig akzeptiert der Server nur `localhost`, `127.0.0.1` und `::1`. API-Anfragen mit fremdem Ursprung oder `Sec-Fetch-Site: cross-site` werden abgewiesen; schreibende Anfragen benötigen ein zufälliges Sitzungstoken im Header `X-LatentSpace-Token`. Die eigene Oberfläche bezieht es automatisch über `/api/session` und erneuert es bei einem Serverneustart. Es gibt keine Anmeldung oder Benutzertrennung. Den Dienst weiterhin lokal binden und nur einen Uvicorn-Prozess verwenden.

Für ausdrücklich konfigurierte lokale Proxys stehen `LATENTSPACE_ALLOWED_HOSTS` (kommagetrennte Hostnamen, keine Wildcards) und `LATENTSPACE_ALLOWED_ORIGINS` (exakte Ursprünge) zur Verfügung. Die Entwicklungsursprünge `http://localhost:5173`, `http://127.0.0.1:5173` und `http://[::1]:5173` sind standardmäßig zugelassen. CORS wird nicht pauschal geöffnet. JSON-Anfragen sind auf 2 MiB, Upload-Anfragen auf 20 MiB plus 128 KiB Formularrahmen begrenzt, einschließlich gestreamter gelesener Daten. CSV-Zeilen-/Spalten-/Zellgrenzen und Excel-Dimensionen werden vor der vollständigen Tabellenzuweisung geprüft. Excel-Archive dürfen entpackt höchstens 100 MiB enthalten; eine Zelle höchstens eine Million Zeichen.

CSV ist ein gesondertes Tabellenexportformat: Alle Felder werden gequotet; riskante Textanfänge einschließlich Überschriften erhalten einen führenden Tabulator. Auch Leerzeichen, BOM, unsichtbare Präfixe und Vollbreitenvarianten werden geprüft. Dieser Schutz zielt auf Tabellenkalkulationen und verändert die CSV-Darstellung dieser Texte. JSON enthält die ursprünglichen Werte. CSV bietet keinen universellen Textdatentyp für alle Programme und erneutes Speichern; siehe [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection).

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

Die Browserprüfungen starten eine eigene Serverinstanz mit temporärer Datenablage. GitHub Actions führt Backendtests, Frontend-Build und die Browserprüfungen aus. Der Browserjob nutzt den vorinstallierten Chrome des Ubuntu-24.04-Runners; lokal kann Playwright seinen eigenen Chromium verwenden. Bei fehlgeschlagenen Browserprüfungen werden Traces als CI-Artefakte aufbewahrt.

Die Kontexttests importieren alle drei Beispiele als gewöhnliche CSV-Dateien, jeweils mit dem festen Demoseed und einem weiteren Seed. Sie prüfen nachvollziehbare Befunde, unveränderte Originalwerte, Berichte und die fehlende Zeitachse der Lernstudie. Zusätzliche Prüfungen benennen alle Spalten um und vergleichen die Analyseergebnisse. Das schützt vor einer Bindung an Handelsbegriffe; Zusätzlich gibt es unabhängige Zufalls- und Fehlwertkontrollen sowie eine reale Iris-CSV. Details, Quellen und Grenzen stehen in [docs/VALIDATION.md](docs/VALIDATION.md).

## Projektstruktur

```text
backend/app/data.py        Import, Rollenvorschläge, SQLite
backend/app/demos.py       Drei unabhängige synthetische Beispielkontexte
backend/app/analysis.py    Vorverarbeitung, Modelle, gefilterte Statistiken
backend/app/insights.py    Typgerechte Profile, Spaltenabdeckung und Suchregeln
backend/app/diagnostics.py Strukturierte Fehlwerte, Schlüssel und Kontextdiagnosen
backend/app/findings.py    Feste Referenzen, Zellbelege, Untersuchung und Export
backend/app/research.py    Persistente Befunde, Notizen und Analysestände
backend/app/explanations.py Statistische Vergleichswerte für einzelne Zeilen
backend/app/reports.py     Analystenberichte als Markdown und JSON
backend/app/main.py        FastAPI, Job-Warteschlange, Export, Webauslieferung
backend/tests/            Fachliche und API-Tests
frontend/src/App.tsx       Arbeitsbereich und Analyseansichten
frontend/src/components/  Befundwerkstatt, Tabellen, Konfiguration und Datenlandschaft
frontend/src/hooks/       Abfragen für Exploration und gespeicherte Untersuchungen
docs/ROADMAP.md            Nächste Ausbaustufen
```

Technische Grundlage: React/TypeScript, Vite, Recharts, Canvas, FastAPI, pandas, scikit-learn und umap-learn.
