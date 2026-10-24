# LatentSpace 0.4 · Fachliche Validierung

Die Prüfungen unterscheiden drei Fragen: Wird ein gezielt eingebautes Muster gefunden? Bleibt seine tatsächliche Vergleichsbasis bei der Untersuchung erhalten? Erzeugt eine unabhängige Zufallskontrolle unberechtigte starke Strukturdiagnosen?

## Regressionen aus der Evaluation

- Ein deutlicher Gruppenunterschied bleibt erkennbar, wenn das relevante Merkmal an elfter numerischer Position steht. Die Befund-IDs bleiben bei umgekehrter Spaltenreihenfolge gleich.
- Ein Zeitvergleich berücksichtigt ein spätes Messwertmerkmal und die dritte Datumsspalte.
- Starke Korrelationen mit nur fünf vollständigen Paaren verdrängen keine gestützte Beziehung mit 200 Paaren.
- Ein Quartilsbefund in Gruppe A führt zu drei passenden Zellbelegen bei einer festen Referenz aus 83 Zeilen. Die separate Modellmarkierung wird in dieser Regression ausgeschaltet. Nach Wechsel zu Gruppe B bleiben die ursprünglichen Quartile, Referenz-IDs und Zellen erhalten.

## Gezielt eingebaute Muster

| Fall | Erwartete Prüfung |
| --- | --- |
| Fehlender Sensor in Gebäude B im Februar | Fehlwerte werden der Kombination aus Gebäude und Monat zugeordnet; fehlende Originalwerte bleiben leer |
| Zusammengesetzter Schlüssel | Alle mehrfach vorkommenden vollständigen Schlüssel werden gefunden; führende Nullen bleiben erhalten; unvollständige Schlüssel zählen nicht als Duplikate |
| Global verdeckter Zusammenhang | Innerhalb zweier Gruppen besteht eine starke gleichgerichtete Beziehung, bei nahezu null globalem Pearson r |
| Lineare Umrechnung | Ein nahezu vollständig redundantes Messwertpaar erhält einen Befund mit Reststreuung |
| Drei einflussreiche Beobachtungen | Der Korrelationsvergleich weist die konkrete Änderung nach Auslassen dieser drei Zeilen aus |
| Seltene Kategorienkombination | Erkennung funktioniert auch ohne numerische Modellmerkmale |
| Persistenz | Gespeicherte Befunde, Notizen und Parameter bleiben nach Verlust aller Analysejobs aus SQLite rekonstruierbar; Exporte enthalten sämtliche Befundzeilen |

## Zufallskontrollen

Die bisherigen Kontrollen mit 1.500 normalverteilten Zeilen bleiben erhalten. Ergänzend erzeugt `python -m backend.validation.null_suite` **150 unabhängige Datensätze**: je 30 Seeds für Normal-, Gleich-, Lognormal-, Student-t(3)- und Poissonverteilungen. Jeder Datensatz enthält 240 Zeilen, drei unabhängige numerische Spalten, eine unabhängige Kategorie, zufällige Kalendertage und unabhängig fehlende Werte (10 % MCAR in M0). Jede Verteilung und Wiederholung verwendet einen eigenen Zufallsstrom: `SeedSequence([20261024, Verteilungsindex, Seed])`. Alle Datensätze durchlaufen dieselben Suchregeln; Isolation Forest, HDBSCAN und Projektionen werden in dieser zusätzlichen Regelkontrolle nicht trainiert.

Reproduzierbare Ausgabe: [null-simulation.json](null-simulation.json). Angegeben sind Datensätze mit mindestens einem Treffer (nicht Zahl aller einzelnen Befunde):

| Verteilung | Quartilsregel | Monatsvergleich | Gruppenmedian | Strukturiertes Fehlwertmuster |
| --- | ---: | ---: | ---: | ---: |
| Normal | 30/30 | 30/30 | 0/30 | 1/30 |
| Gleich | 0/30 | 29/30 | 0/30 | 2/30 |
| Lognormal | 30/30 | 30/30 | 0/30 | 1/30 |
| Student-t(3) | 30/30 | 30/30 | 0/30 | 1/30 |
| Poisson | 30/30 | 30/30 | 10/30 | 2/30 |

Diese Ergebnisse belegen **keine besondere Struktur** der Zufallsdaten. Die deskriptiven Monatsmittelregeln treffen in dieser Kontrolle in 149 von 150 Datensätzen mindestens einmal; auch die Mindestgrößen für Fehlwertmuster verhindern nicht jeden Zufallstreffer. Es werden keine Fehlalarmrate, statistische Signifikanz oder Fehlerwahrscheinlichkeit ausgewiesen. Die Oberfläche benennt die Suchschwellen, Vergleichsbasis und Mehrfachsuchgrenze. Die Simulationen dienen der Prüfung der Rechenregeln und der Sichtbarkeit ihrer Empfindlichkeit, nicht einer nachträglichen Optimierung auf die Beispieldaten. Repräsentative annotierte Nutzerdateien und weitere Stichprobengrößen bleiben für Erkennungs- und Übersehensmessungen erforderlich.

Die Tests prüfen für alle 150 Samples, dass Quartilsbefunde genau die zu ihren eingefrorenen Grenzen gehörenden IDs enthalten und Korrelationsbefunde die vollständigen Paare und Mindestschwellen erfüllen. Exakte Einzel-Auslassmediane und Pearson-Bereiche werden separat gegen unabhängige Neuberechnungen geprüft, einschließlich gerader/ungerader Stichproben und nicht definierter Korrelationen.

## Neue Integrations- und Sicherheitsprüfungen

Mehrdeutige Datumsfolgen werden blockiert, bis eine Interpretation gewählt ist. Monatsnamen entstehen ausschließlich durch Nutzerauswahl, unabhängig vom Spaltennamen; dieselben Daten behalten ihre Suchtreffer. Tests prüfen leere Originalzellen getrennt von Konvertierungsverlusten, feste Filterbasis, getrennte Modellbasis sowie Befundzählung, Paging und mathematische Sortierung ohne Wichtigkeitszahlen. Vergleichsspalten, manuelle Auslass-IDs, Nutzernotizen und Originalreferenzen bleiben nach Jobverlust und SQLite-Wiederherstellung exportierbar. Befunde aus Version 0.3 werden ohne Änderung ihrer damaligen Referenz lesbar geöffnet.

Sicherheitstests prüfen fremde und missgebildete Hosts, fremde/null-Ursprünge, Fetch-Metadata, fehlende/falsche Sitzungstoken, große deklarierte und gestreamte Bodies, CSV-Formelpräfixe in Werten und Überschriften, Quotes/Zeilenumbrüche, frühe Tabellenlimits und irreführende Excel-Dimensionen. Der Tabulator-/Quote-Schutz ist kein universelles Versprechen für jede Tabellenkalkulation oder erneutes Speichern. Grundlage: [OWASP CSV Injection](https://owasp.org/www-community/attacks/CSV_Injection), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Reale Testdatei

`backend/tests/fixtures/iris.csv` enthält die Iris-Messwerte aus `sklearn.datasets.load_iris` der im Projekt verwendeten scikit-learn-Version 1.8.0. Die vier Messwerte bleiben unverändert. Die Spalten wurden benannt, die vorhandenen Klassen als Artennamen geschrieben und eine stabile `Sample_ID` ergänzt. Es wurden keine Auffälligkeiten eingebaut.

Quelle: [scikit-learn · load_iris](https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_iris.html), [Beschreibung und Herkunft](https://github.com/scikit-learn/scikit-learn/blob/1.8.0/sklearn/datasets/descr/iris.rst). Die scikit-learn-Fassung enthält die in der offiziellen Dokumentation beschriebenen zwei Korrekturen und sollte deshalb nicht als bytegleiche Kopie der UCI-Fassung bezeichnet werden.

Geprüft werden normaler CSV-Import, unveränderte Originalwerte, drei Vergleichsgruppen mit jeweils 50 vollständigen Messwerten sowie die Untersuchung in der echten Oberfläche. Arten werden nicht als Anomalie-Ground-Truth behandelt.

## Bedienung und Grenzen

Die Browsertests decken die drei Demo-Kontexte, eigene CSV-Importe, Zellbelege hinter den ersten Modellmerkmalen, Tabellenseiten, feste Befundreferenzen, Vergleichszeilen, Notizen, vollständigen JSON-Export, Wiederherstellung gespeicherter Analysestände, Duplikatschlüssel und die Iris-Datei ab. Die Befundansicht wird auch bei 390 Pixeln Breite geprüft.

Diese Regressionen sichern konkrete Erwartungen ab. Weitere reale Dateien aus mehreren Branchen, weitere Stichprobengrößen und Messungen von Laufzeit und übersehenen Mustern sollen die nächste Ausbaustufe begleiten. Projektionsverfahren und Prognosen werden danach priorisiert.

Der CI-Browserjob verwendet den vorinstallierten Chrome des GitHub-Ubuntu-24.04-Runners über den bereits unterstützten Playwright-Executable-Pfad. So benötigt der Job keine zusätzliche apt- oder Browser-CDN-Installation. Grundlage: [GitHub Runner-Image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md). Die lokalen Prüfungen verwenden Chromium; beide Wege führen dieselben Tests aus.

Stand der lokalen Prüfung für 0.4: Backendtests, Frontend-Build und 15 Browsertests bestehen. Die neue Befundsortierung und die Sensitivitätsansicht wurden zusätzlich bei 1440 und 390 Pixeln visuell geprüft.
