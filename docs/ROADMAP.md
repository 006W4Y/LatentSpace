# LatentSpace · Produktrichtung und nächste Schritte

## Produktziel

Eine große, zugängliche Toolbox für die Arbeit mit Daten. Menschen importieren eigene Dateien und untersuchen Trends, Gruppen, Auffälligkeiten, Zusammenhänge und einzelne Beobachtungen. Fachliche Fragen führen zu passenden Werkzeugen; Algorithmen bleiben nachvollziehbar einstellbar.

Die Datenlandschaft ergänzt Zeitreihen, Tabellen und Diagramme. Erkenntnisse sollen sich in konkrete Auswahlen, Exporte und spätere Datenkorrekturen überführen lassen.

## Implementiert in Version 0.1

- Vollständiger Ablauf von CSV/XLSX über Rollenkorrektur bis zu realen Analysen und Export.
- Lokale Speicherung und synthetischer Demodatensatz.
- Verknüpfte Filter und Rechteckauswahl zwischen Ansichten.
- PCA und UMAP, HDBSCAN und Isolation Forest auf separatem Merkmalsraum.
- Gruppenprofile, Zeitaggregate, Pearson-Korrelation und Datenprofile.
- Analyseparameter, lokaler Start, Docker-Grundlage und Tests.

## Als Nächstes: Alltagstauglichkeit

1. Datentyp- und Einheitenprüfung erweitern: Prozent, Währung, Zeitzonen und explizite Datumsformate; Import mehrerer Excel-Blätter mit Auswahl.
2. Datenbereinigung mit Vorschau: fehlende Werte, Duplikate und fehlerhafte Konvertierungen gezielt bearbeiten; Änderungen als neue Datenversion speichern.
3. Resultate und Notizen dauerhaft speichern; gespeicherte Ansichten benennen, verwalten und löschen.
4. Zeitbereiche direkt im Diagramm auswählen; robuste Trendkennzahlen, saisonale Muster und Veränderungspunkte ergänzen.
5. Verteilungen zwischen selbst definierten Gruppen vergleichen; Effektgrößen und Stichprobengrößen verständlich darstellen.
6. Verständliche Empfehlungen aus überprüfbaren Regeln ergänzen, abhängig von Datenart und Stichprobe.

## Danach: größere Toolbox

- Mehrere Tabellen verbinden; Join-Vorschau und Eindeutigkeitsprüfung.
- Nichtlineare Zusammenhänge und weitere Projektionen wie t-SNE.
- Prognosen mit zeitgerechtem Backtesting, Baselines und Unsicherheiten.
- Modellrepräsentationen über stabile IDs und Nachbarschaften vergleichen.
- Datenabdeckung gegenüber expliziten Referenzdaten untersuchen.
- Projektionsqualität, Nachbarschaftserhalt und Stabilität über Seeds messen.
- Größere Datensätze: serverseitige Aggregation, Sampling, binäre Übertragung und GPU-Rendering.

## Späterer Team- und Cloudbetrieb

Erst nach Bedarfserprobung: Authentifizierung, getrennte Datenräume, Datenbankmigrationen, Prozess-Worker, persistente Jobzustände, Berechtigungen und Freigaben. Die aktuelle lokale App ist dafür keine fertige Hostinglösung.

## Erfolg prüfen

Mit echten Testnutzern beobachten: Können sie eine eigene Datei ohne Hilfe importieren, die Rollen korrekt festlegen, einen relevanten Befund überprüfen und die passenden Zeilen exportieren? Erst danach weitere Analyseverfahren ergänzen.
