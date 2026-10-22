# LatentSpace 0.3 · Fachliche Validierung

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

Drei feste Seeds (0, 19, 42) erzeugen jeweils 1.500 unabhängige Beobachtungen mit vier normalverteilten Messwerten, zufälliger Gruppenzuordnung, zufälligen Kalendertagen und unabhängig fehlenden Werten in einem Messwert. Für diese Kontrollen werden keine starken Befunde zu Gruppenbeziehungen, Redundanz, Sensitivität, seltenen Kombinationen oder strukturierten Fehlwerten erwartet. Die Tests prüfen genau diese Abwesenheit.

Quartilsabweichungen und Isolation-Forest-Markierungen können auch in Normalverteilungen auftreten. Sie werden nicht als Nachweis eingebauter Struktur gewertet. Deskriptive Monatsunterschiede können ebenfalls rein zufällig auftreten. Es werden keine experimentell kalibrierte Fehlalarmrate oder vollständige Erkennung aller Muster behauptet. Repräsentative Precision-/Recall-Messungen mit fachlich annotierten Nutzerdateien bleiben eine nächste Validierungsaufgabe.

## Reale Testdatei

`backend/tests/fixtures/iris.csv` enthält die Iris-Messwerte aus `sklearn.datasets.load_iris` der im Projekt verwendeten scikit-learn-Version 1.8.0. Die vier Messwerte bleiben unverändert. Die Spalten wurden benannt, die vorhandenen Klassen als Artennamen geschrieben und eine stabile `Sample_ID` ergänzt. Es wurden keine Auffälligkeiten eingebaut.

Quelle: [scikit-learn · load_iris](https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_iris.html), [Beschreibung und Herkunft](https://github.com/scikit-learn/scikit-learn/blob/1.8.0/sklearn/datasets/descr/iris.rst). Die scikit-learn-Fassung enthält die in der offiziellen Dokumentation beschriebenen zwei Korrekturen und sollte deshalb nicht als bytegleiche Kopie der UCI-Fassung bezeichnet werden.

Geprüft werden normaler CSV-Import, unveränderte Originalwerte, drei Vergleichsgruppen mit jeweils 50 vollständigen Messwerten sowie die Untersuchung in der echten Oberfläche. Arten werden nicht als Anomalie-Ground-Truth behandelt.

## Bedienung und Grenzen

Die Browsertests decken die drei Demo-Kontexte, eigene CSV-Importe, Zellbelege hinter den ersten Modellmerkmalen, Tabellenseiten, feste Befundreferenzen, Vergleichszeilen, Notizen, vollständigen JSON-Export, Wiederherstellung gespeicherter Analysestände, Duplikatschlüssel und die Iris-Datei ab. Die Befundansicht wird auch bei 390 Pixeln Breite geprüft.

Diese Regressionen sichern konkrete Erwartungen ab. Weitere reale Dateien aus mehreren Branchen, systematische Nullsimulationen über viele Seeds und Messungen von Laufzeit, Sensitivität und übersehenen Mustern sollen die nächste Ausbaustufe begleiten. Projektionsverfahren und Prognosen werden danach priorisiert.

Der CI-Browserjob verwendet den vorinstallierten Chrome des GitHub-Ubuntu-24.04-Runners über den bereits unterstützten Playwright-Executable-Pfad. So benötigt der Job keine zusätzliche apt- oder Browser-CDN-Installation. Grundlage: [GitHub Runner-Image](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md). Die lokalen Prüfungen verwenden Chromium; beide Wege führen dieselben Tests aus.
