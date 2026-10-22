# LatentSpace · Produktrichtung und nächste Schritte

## Produktziel

Eine zugängliche Toolbox, mit der Menschen aus einer einzelnen Tabelle verständliche und belegte Erkenntnisse gewinnen. Fachliche Fragen führen zu passenden Werkzeugen. Die Datenlandschaft ergänzt Zeitreihen, Tabellen, Vergleiche und Befunduntersuchungen. LatentSpace verändert keine Originaldaten; Bewertung, Bereinigung und weitere Verarbeitung übernimmt ein Analyst anhand der Ausgaben.

**Vereinbarter Umfang:** Eine Datei pro Analyse. Verknüpfungen mehrerer Dateien und wiederkehrende Importvergleiche benötigen eine erneute Produktentscheidung.

## Implementiert bis Version 0.3

- CSV/XLSX-Import, Rollenkorrektur, PCA/UMAP, HDBSCAN und Isolation Forest im Merkmalsraum.
- Drei unabhängig auswählbare Beispielkontexte: Handel, Gebäudetechnik und Lernen.
- Verknüpfte Filter, semantische Verteilungen, konkrete Einzelwerthinweise mit Median, Quartilen und Prüfregeln.
- Alle geeigneten Messwert-, Kategorie- und Datumsspalten werden geprüft. Eignung vor Priorisierung, nachvollziehbare Abdeckung und von der Spaltenreihenfolge unabhängige Sortierung.
- Strukturierte Befunde mit festen Referenz-IDs, betroffenen Spalten, Auswahlbezug und Prüfregeln.
- Befundwerkstatt mit gemeinsamen Verteilungsgrenzen, Streudiagrammen, Gruppenwerten, zugehörigen Zellen und blätterbaren Befund-/Vergleichszeilen.
- Fehlwertmuster nach Gruppe, Kalendermonat und deren Kombination; explizite Duplikatschlüssel mit Ausschluss unvollständiger Schlüssel.
- Gruppenabhängige Korrelationen, nahezu lineare Redundanz, seltene Kategorienkombinationen und Korrelations-Sensitivitätsprüfung.
- Befunde, feste Referenzen und Notizen in SQLite; vollständiger Befundexport als JSON.
- Analysestände mit Parametern, Rollen, Filtern und Ansicht in SQLite. Modelle werden beim Öffnen erneut berechnet.
- Ausgelagerte Konfigurations-, Tabellen-, Befund- und Diagnosekomponenten sowie Hooks für Abfragen.
- Regressionstests, Null-/Fehlwertkontrollen und reale Iris-CSV; Backendtests, Build und Chromium-Prüfungen in CI.

## Als Nächstes: Qualität messen und Untersuchungen vertiefen

1. Mit echten Nutzern und annotierten Dateien messen: Welche Befunde werden erkannt, übersehen oder zu stark hervorgehoben? Precision/Recall nach Befundtyp, Laufzeiten und Fehlerfälle dokumentieren.
2. Suchregeln anhand breiter Nullsimulationen kalibrieren. Mehrfachvergleiche, kleine Gruppen und wiederholte Beobachtungen stärker berücksichtigen. Deskriptive Monatsunterschiede gezielt auf zufällige Hervorhebung untersuchen.
3. Strukturbrüche und saisonale Muster mit geeigneter Zeitreferenz ergänzen; Unsicherheit und Datenabdeckung direkt sichtbar machen.
4. Einheiten, explizite Datumsformate, Zeitzonen und numerische Kategoriecodes besser erkennen; Auswahl eines Excel-Tabellenblatts ermöglichen.
5. Weitere Ansichten und Hooks aus App.tsx auslagern. Notebook-Verwaltung und versionierte Berechnungsergebnisse erweitern.
6. Vergleiche fachlich definierbarer Gruppen mit Effektgrößen und stabilen Gegenbeispielen ausbauen; gemeinsame Gruppenzusammensetzungen berücksichtigen.

## Danach: größere Toolbox

Nichtlineare Beziehungen, Projektionsqualität und Stabilität über Seeds, Vergleich von Modellrepräsentationen über stabile IDs und Nachbarschaften. Größere Dateien benötigen serverseitige Aggregation, Sampling und Performancebenchmarks. Prognosen benötigen zeitgerechtes Backtesting, Baselines und Unsicherheiten.

## Team- und Cloudbetrieb

Erst nach Bedarfserprobung: Anmeldung, getrennte Datenräume, Berechtigungen, Prozess-Worker und persistente Jobwarteschlangen. Die aktuelle lokale App ist dafür keine fertige Hostinglösung.
