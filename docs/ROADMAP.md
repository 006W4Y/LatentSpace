# LatentSpace · Produktrichtung und nächste Schritte

## Produktziel

Eine große, zugängliche Toolbox für die Arbeit mit Daten. Menschen importieren eigene Dateien und untersuchen Trends, Gruppen, Auffälligkeiten, Zusammenhänge und einzelne Beobachtungen. Fachliche Fragen führen zu passenden Werkzeugen; Algorithmen bleiben nachvollziehbar einstellbar.

Die Datenlandschaft ergänzt Zeitreihen, Tabellen und Diagramme. Erkenntnisse werden in überprüfbare Befunde, konkrete Auswahlen und Exporte überführt. LatentSpace verändert keine Originaldaten. Fachliche Bewertung, Bereinigung und weitere Verarbeitung übernimmt ein Analyst anhand der Ausgaben.

## Implementiert bis Version 0.2

- Vollständiger Ablauf von CSV/XLSX über Rollenkorrektur bis zu realen Analysen und Export.
- Lokale Speicherung und synthetischer Demodatensatz.
- Verknüpfte Filter und Rechteckauswahl zwischen Ansichten.
- PCA und UMAP, HDBSCAN und Isolation Forest auf separatem Merkmalsraum.
- Gruppenprofile, Zeitaggregate, Pearson-Korrelation und Datenprofile.
- Analyseparameter, lokaler Start, Docker-Grundlage und Tests.
- Eigene Insight-Ansicht mit Zahlenbelegen, Methodik, Auswahlbezug und gezieltem Wechsel zur passenden Analyse.
- Statistische Erklärungen für Auffälligkeiten: globale und lokale Vergleichswerte, Median, Quartile, Mindeststichprobe und Abstandsprüfung.
- Semantische Verteilungen: Monatsnamen mit Jahr, Kategorien, diskrete Messwerte und unverzerrte Kennungsdarstellung.
- Analystenberichte als Markdown und JSON mit Befunden, Erklärungen, Zeilenbezug und Datenfingerabdruck.
- Professioneller Arbeitsbereich mit klarer visueller Hierarchie und lesbareren Beschriftungen.

## Als Nächstes: Alltagstauglichkeit

1. Datentyp- und Einheitenprüfung erweitern: Prozent, Währung, Zeitzonen und explizite Datumsformate; Import mehrerer Excel-Blätter mit Auswahl.
2. Weitere Erkenntnisse ergänzen: fehlende Werte und Duplikate fachlich einordnen, betroffene Zeilen referenzieren und konkrete Prüfaufträge exportieren. Keine Bearbeitung der Originaldaten.
3. Resultate und Notizen dauerhaft speichern; gespeicherte Ansichten benennen, verwalten und löschen.
4. Zeitbereiche direkt im Diagramm auswählen; robuste Trendkennzahlen, saisonale Muster und Veränderungspunkte ergänzen.
5. Verteilungen zwischen selbst definierten Gruppen vergleichen; Effektgrößen und Stichprobengrößen verständlich darstellen.
6. Befunde weiter priorisieren und fachlich kontextualisieren, abhängig von Datenart, Vergleichsbasis und Stichprobe; keine unbelegten Schlussfolgerungen.

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

Mit echten Testnutzern beobachten: Können sie eine eigene Datei ohne Hilfe importieren, die Rollen korrekt festlegen, einen Befund und seine Vergleichsbasis verstehen und einem Analysten die relevanten Zeilen samt Erklärung übergeben?
