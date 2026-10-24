# LatentSpace · Produktrichtung und nächste Schritte

## Produktziel

Eine zugängliche Toolbox, mit der Menschen aus einer einzelnen Tabelle verständliche und belegte Erkenntnisse gewinnen. Fachliche Fragen führen zu passenden Werkzeugen. Die Datenlandschaft ergänzt Zeitreihen, Tabellen, Vergleiche und Befunduntersuchungen. LatentSpace verändert keine Originaldaten; Bewertung, Bereinigung und weitere Verarbeitung übernimmt ein Analyst anhand der Ausgaben.

**Vereinbarter Umfang:** Eine Datei pro Analyse. Verknüpfungen mehrerer Dateien und wiederkehrende Importvergleiche benötigen eine erneute Produktentscheidung.

## Implementiert bis Version 0.4

- CSV/XLSX-Import, Rollenkorrektur, PCA/UMAP, HDBSCAN und Isolation Forest im Merkmalsraum.
- Drei unabhängig auswählbare Beispielkontexte: Handel, Gebäudetechnik und Lernen.
- Verknüpfte Filter, semantische Verteilungen, konkrete Einzelwerthinweise mit Median, Quartilen und Prüfregeln.
- Alle geeigneten Messwert-, Kategorie- und Datumsspalten werden geprüft. Eignung vor Anzeigeauswahl, nachvollziehbare Abdeckung und von der Spaltenreihenfolge unabhängige Sortierung.
- Strukturierte Befunde mit festen Referenz-IDs, betroffenen Spalten, Auswahlbezug und Prüfregeln.
- Befundwerkstatt mit gemeinsamen Verteilungsgrenzen, Streudiagrammen, Gruppenwerten, zugehörigen Zellen und blätterbaren Befund-/Vergleichszeilen.
- Fehlwertmuster nach Gruppe, Kalendermonat und deren Kombination; explizite Duplikatschlüssel mit Ausschluss unvollständiger Schlüssel.
- Gruppenabhängige Korrelationen, nahezu lineare Redundanz, seltene Kategorienkombinationen und Korrelations-Sensitivitätsprüfung.
- Befunde, feste Referenzen und Notizen in SQLite; vollständiger Befundexport als JSON.
- Analysestände mit Parametern, Rollen, Filtern und Ansicht in SQLite. Modelle werden beim Öffnen erneut berechnet.
- Ausgelagerte Konfigurations-, Tabellen-, Befund- und Diagnosekomponenten sowie Hooks für Abfragen.
- Regressionstests, Null-/Fehlwertkontrollen und reale Iris-CSV; Backendtests, Build und Chromium-Prüfungen in CI.

## Ergänzt in 0.4: beschreibende Datenwerkstatt

- Automatische Aussagen beschreiben berechnete Werte. Beobachtung, Suchregel und Isolation-Forest-Markierung sind sichtbar getrennt.
- Wählbare Datenrollen, explizite mehrdeutige Datumsfolgen, frei gewählte Monatsdarstellung und gekennzeichnete Einheitenlabels.
- Vergleichsbasis mit Spalten, Filtern, Zeilenzahlen, Originalfehlwerten und Konvertierungsverlusten direkt bei jedem Befund; unveränderte Grundlage in Speicherung und Export.
- Keine manuellen Wichtigkeitszahlen: wählbare mathematische Sortierung, Filter, Seiten und separate Zählungen für gefunden / gefiltert / angezeigt.
- Exakte Einzel-Auslassvergleiche für Median und Pearson r; manuelle Vergleichsauswahl, separate gespeicherte IDs und JSON-Dokumentation.
- 150 Nullsimulationen über fünf Verteilungen mit dokumentierten Suchtreffern; keine Signifikanz- oder Fehlerwahrscheinlichkeitsbehauptung.
- Lokale Host-/Origin-/Sitzungstoken-Grenze, Formularschutz auch für CSV-Überschriften und frühe Importgrößenprüfungen.

## Nächste Ausbaustufen (noch nicht Bestandteil von 0.4)

1. Verteilungsformen und frei definierbare Gruppen mit gemeinsamen Achsen und Klassengrenzen vertiefen.
2. Beziehungen zwischen Kategorien und Messwerten sowie Zeitabstände, Datenlücken und wiederkehrende Verläufe erweitern. Wiederholte Messungen ausdrücklich berücksichtigen.
3. Auswahl von Originalspalten und Diagrammen für reproduzierbare HTML-/PDF-Berichte ergänzen; JSON/Markdown bleiben verfügbar.
4. Berechnungsfortschritt, Abbruch, Backups und Wiederherstellung ausbauen; Excel-Blattwahl und explizite Zeitzonen ergänzen.
5. Mit annotierten echten Dateien übersehene und hervorgehobene Muster messen. Mehrfachsuchen anhand breiterer Kontrollen prüfen, ohne deskriptive Schwellen als fachliche Wichtigkeit auszugeben.
6. Weitere Ansichten und Hooks aus App.tsx auslagern. Zusätzliche Projektionsverfahren und Prognosen erst nach diesen Grundlagen prüfen.

Eine Datei pro Analyse bleibt der vereinbarte Umfang. Originaldaten werden nicht automatisch bereinigt oder verändert.
