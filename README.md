# Nutrition Tracker

Statische React + TypeScript PWA mit lokaler IndexedDB-Datenbank und JSON-Backup. Keine Cloud, kein Login und kein Backend.

## Lokal starten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

## Auf GitHub Pages veröffentlichen

1. Neues **öffentliches** GitHub-Repository erstellen, z. B. `nutrition-tracker`.
2. **Den Inhalt dieses Projektordners** in das Repository hochladen (inklusive `.github/workflows/deploy.yml`). Nicht den Ordner als Unterordner hochladen.
3. In GitHub unter **Settings → Pages → Build and deployment** als Source **GitHub Actions** auswählen.
4. Auf den `main`-Branch pushen. Der Workflow baut die Anwendung und veröffentlicht sie automatisch.
5. Unter **Actions** den erfolgreichen Deploy abwarten. Die URL ist in der Regel `https://DEIN-NAME.github.io/nutrition-tracker/`.

Das Projekt nutzt relative Asset-Pfade (`base: './'`) und funktioniert dadurch auch unter einem Repository-Unterpfad.

## Mengen und Einheiten

- Im Tagebuch Menge und Einheit wählen: g, mg, kg, ml, l, Portion, Stück oder Scheibe. Dezimalmengen sind möglich.
- Für Stück und Scheibe das Gewicht pro Einheit festlegen; für ml und l die Dichte in g/ml. Diese Werte können direkt beim Eintragen oder im Produkteditor gespeichert werden.
- Eigene Einheiten wie Esslöffel oder Becher über den Portionsnamen und das Portionsgewicht definieren.
- Im Produkteditor die Bezugsmenge wählen: 100 g, 100 ml, 1 Portion oder eine eigene Grammmenge. Beispiel: Portionsname „Mittel“, 150 g pro Portion, Bezug „1 Portion“ und 116 kcal eingeben. Die App rechnet für ihre Berechnungen automatisch auf 100 g um und zeigt beim erneuten Bearbeiten wieder die gewählte Bezugsmenge. Für 100 ml ist eine Dichte erforderlich.
- Weitere Portionsgrößen können eigene Namen und Gewichte erhalten, etwa „Klein“ mit 80 g und „Groß“ mit 250 g. Bei der Einheit „Portion“ steht die Größenwahl im Tagebuch, in Rezeptzutaten und in neuen Wochenplanungen zur Verfügung. Alle Größen werden aus denselben Nährwerten berechnet; gerundete Quellenwerte können leicht abweichen.
- Gespeicherte Einträge behalten ihre Menge, Einheit, gewählte Portionsgröße und ihren Nährwert-Snapshot. Eine andere Größenwahl verändert den Tagebucheintrag, ohne die Standardportion im Produkt zu überschreiben. Ältere Einträge und Backups funktionieren weiterhin; neue Bezugsangaben und Portionsgrößen sind im JSON-Backup enthalten.

## Kompakter Tagebuchmodus

Über „Kompakt“ neben „Mahlzeiten“ lässt sich die Tagebuchansicht umschalten. Ohne gespeicherte Auswahl startet das Tagebuch kompakt; eine bereits gewählte Ansicht bleibt erhalten. In der kompakten Ansicht zeigt jede Zeile Lebensmittelname und Kalorien. Ein Klick oder die Eingabe-/Leertaste auf der Zeile klappt den vollständigen Namen, Marke, Menge, Nährwerte, eine vorhandene Eintragsnotiz sowie Bearbeiten und Löschen auf. Mehrere Einträge können gleichzeitig geöffnet bleiben. Beim Wechsel des Datums starten die Details wieder eingeklappt.

Kopieren und „Als Vorlage speichern“ stehen als Symbole im Mahlzeitenkopf zur Verfügung. Mengen, Tageswerte und gespeicherte Einträge bleiben beim Ansichtswechsel unverändert. Die Ansicht wird lokal für diesen Browser gespeichert und bleibt beim Seitenwechsel und Neuladen erhalten. Sie ist nicht Teil der JSON-Datensicherung. Falls der Browser die Speicherung der Auswahl blockiert, lässt sich die Ansicht weiterhin umschalten; eine Fehlermeldung weist auf die fehlende Speicherung hin.

## Notizen zu einzelnen Einträgen

Beim Hinzufügen oder Bearbeiten eines Lebensmittels im Tagebuch gibt es das optionale Feld „Notiz zum Eintrag“. Es unterstützt mehrere Zeilen und gehört nur zu diesem Eintrag. Zum Entfernen die Notiz leeren und speichern. In der Standardansicht steht die Notiz direkt am Eintrag; kompakt weist ein Sprechblasensymbol auf die Notiz in den aufklappbaren Details hin.

Notizen bleiben nach Neuladen, Kopieren, Löschen/Rückgängig und JSON-Export/Import erhalten. Auch Mahlzeiten-Vorlagen behalten die Notizen der gespeicherten Einträge. Sie ändern weder die Produktdaten noch die Tageswerte und werden nicht in der CSV-Tagesauswertung ausgegeben. Alte Einträge und Sicherungen ohne Notiz bleiben kompatibel.

## Zuletzt verwendet, Tagebuchsuche und schnelle Mengenkorrektur

Beim Hinzufügen eines Lebensmittels zeigt „Zuletzt verwendet“ bis zu sechs zuletzt eingetragene Produkte, je Produkt mit der zuletzt erfassten Menge und Einheit. Die Reihenfolge richtet sich nach dem Erfassungszeitpunkt. Ein Klick auf den Namen übernimmt die Menge ins Formular; mit + entsteht direkt ein neuer Eintrag am gewählten Datum in der oben ausgewählten Mahlzeit. Verwendet werden die aktuellen Produktwerte und, sofern vorhanden, die passende Portionsgröße. Fehlt die frühere Größe oder eine Umrechnung, wird das gespeicherte Grammgewicht übernommen. Gelöschte Produkte werden nicht angeboten. Alte Eintragsnotizen werden nicht übernommen; eine im neuen Formular eingegebene Notiz wird gespeichert.

„Tagebuchsuche“ neben „Kompakt“ durchsucht Lebensmittelname, Marke, Mahlzeit und Eintragsnotizen über alle gespeicherten Tage. Mehrere Suchwörter müssen alle vorkommen, unabhängig von Groß-/Kleinschreibung. Datumsgrenzen sind optional und schließen Start- und Endtag ein. Ohne Suchbegriff erscheinen die neuesten Einträge. Jeweils 30 Treffer werden angezeigt, weitere lassen sich nachladen. Auch Einträge zu gelöschten Produkten lassen sich finden. „Eintrag bearbeiten“ wechselt zum richtigen Datum und öffnet den Editor mit den historischen Produktwerten.

Im aufgeklappten kompakten Eintrag kann die Menge direkt geändert werden; in der Standardansicht öffnet „Menge ändern“ das gleiche Formular. Die Einheit bleibt erhalten. Dezimalpunkt und Dezimalkomma funktionieren. Eine Vorschau zeigt Gramm und Kalorien; erst „Menge speichern“ aktualisiert den Eintrag sowie Tages- und Wochenwerte. Notiz, Mahlzeit und gespeicherte Produktwerte bleiben erhalten. Ungültige oder nicht mehr vorhandene Einträge werden nicht überschrieben. Diese Funktionen verwenden die vorhandenen Tagebucheinträge; das Sicherungsformat bleibt kompatibel.

## Mahlzeiten kopieren, Favoriten und Rückgängig

- Über das Kopiersymbol neben einer Mahlzeit kannst du alle Einträge auf ein Zieldatum und eine Zielmahlzeit übertragen. Mengen, Einheiten und gespeicherte Nährwerte bleiben erhalten. Vorhandene Einträge werden ergänzt.
- Unter „Produkte“ lassen sich Lebensmittel mit dem Stern als Favoriten markieren. Der Favoritenfilter zeigt nur markierte Produkte; im Such-Dropdown stehen sie zuerst. Favoriten sind Teil der Datensicherung.
- Nach dem Löschen eines Tagebucheintrags, Produkts oder Gewichtswerts steht in der Meldung für 10 Sekunden „Rückgängig“ zur Verfügung. Beim Darüberfahren oder Tastaturfokus pausiert die Ausblendung. Neuere Datensätze werden nicht überschrieben; ein Datenimport beendet die Gültigkeit vorheriger Wiederherstellungen.

## Körpergewicht

Im Tagebuch kannst du für das gewählte Datum dein Körpergewicht in kg speichern, aktualisieren oder löschen. Komma und Punkt sind als Dezimaltrennzeichen möglich. Pro Tag gibt es eine Messung.

Die Vergleiche zeigen die Änderung zur vorherigen Messung und seit der ersten Messung bis zum gewählten Datum. Das Diagramm zeigt 30 Tage, 90 Tage oder den gesamten bisherigen Verlauf. Messpunkte lassen sich per Maus, Berührung und Tastatur auswählen; alle Werte stehen zusätzlich in einer Tabelle. Tage ohne Messung werden übersprungen.

Datensicherungen ab Version 2 enthalten auch Gewichtsmessungen. Beim Import alter Sicherungen (Version 1) bleiben vorhandene Gewichtsmessungen erhalten.

## Trinkmenge

Im Tagebuch zeigt „Trinkmenge“ die Gesamtmenge aller Getränke für das gewählte Datum. Wasser lässt sich direkt mit 150, 250 oder 500 ml ergänzen. Unter „Mehr“ können eigene Getränkenamen (etwa Tee, Kaffee oder Saft), Mengen in ml oder Litern und eine Uhrzeit eingetragen werden. Dezimalpunkt und Dezimalkomma funktionieren; beim Wechsel der Einheit bleibt die bereits eingegebene Menge gleich.

Der Tagesverlauf sortiert die Getränke nach ihrer Uhrzeit und zeigt die bis dahin erfasste Gesamtmenge als Zahl und Balken. Einträge lassen sich bearbeiten oder löschen; „Rückgängig“ stellt einen gelöschten Eintrag wieder her. Die Detailansicht ist standardmäßig eingeklappt. Beim Datumswechsel werden die Getränke des gewählten Tages geladen; die Schnellbuttons bleiben direkt erreichbar.

Die Trinkmenge zählt das Volumen aller erfassten Getränke. Getränke mit Kalorien zusätzlich als Lebensmittel eintragen, damit ihre Nährwerte in die Tagesbilanz eingehen. Ein Trinkziel wird nicht vorgegeben.

JSON-Sicherungen ab Version 6 enthalten die Trinkdaten aller Tage. Beim Import der Versionen 1–5 bleiben bestehende Trinkdaten erhalten. Eine Sicherung der Version 6 ersetzt auch die Trinkdaten; eine leere Getränkeliste löscht sie ausdrücklich. Der lokale letzte Sicherungszeitpunkt bleibt unverändert durch Importe. Die Datenbank wird auf Version 7 erweitert, ohne vorhandene Einträge zu verändern.

## Eigene Tagesziele

In der Tagesbilanz kannst du über „Ziele festlegen“ eigene Ziele für Kalorien, Protein, Kohlenhydrate, Fett und Ballaststoffe eintragen. Alle Ziele sind optional; leere Felder deaktivieren die jeweilige Anzeige. Es werden keine Zielwerte vorgegeben. Die eingestellten Ziele gelten für alle Tage, auch für ältere Tagesansichten.

Die Fortschrittsbalken zeigen den aktuellen Verbrauch, den Zielwert und die verbleibende Menge. Überschreitungen werden als Menge und Prozentwert angezeigt; der Balken bleibt maximal voll. Ziele lassen sich jederzeit bearbeiten oder vollständig entfernen.

Neue Datensicherungen (Version 3) enthalten auch Tagesziele. Beim Import der Versionen 1 und 2 bleiben vorhandene Ziele erhalten.

## Wochenübersicht

Über „Woche“ öffnest du eine Übersicht von Montag bis Sonntag. Die Pfeile wechseln die Woche; über ein Datum kannst du direkt zu einer anderen Kalenderwoche springen. Tagesbalken und Datumsüberschriften öffnen den jeweiligen Tag im Tagebuch.

Die Übersicht zeigt tägliche Kalorien und Nährwerte, Gewichtsmessungen, Durchschnittswerte sowie den Unterschied zur Vorwoche. Nährwert-Durchschnitte verwenden nur Tage mit Einträgen, Gewichtsdurchschnitte nur tatsächliche Messungen. Fehlende Daten erscheinen als „—“; teilweise erfasste Tage zählen mit. Der Tagesvergleich lässt sich zwischen Kalorien, Protein, Kohlenhydraten, Fett und Ballaststoffen umschalten. Eingestellte Tagesziele erscheinen als gestrichelte Linie.

## Eigene Rezepte

Unter „Produkte“ kannst du über „Neues Rezept“ Zutaten aus deiner Lebensmittelliste zusammenstellen. Mengen lassen sich in den für das Produkt konfigurierten Einheiten angeben. Lege die Anzahl der Portionen fest; Nährwerte für das gesamte Gericht und pro Portion werden automatisch berechnet, einschließlich Ballaststoffen und Zucker.

Ohne eigenes Gesamtgewicht folgt das Rezept der Summe seiner Zutatengewichte. Wenn das Gericht beim Kochen Wasser verliert oder aufnimmt, kannst du stattdessen das gewogene Fertiggewicht angeben. Die Nährwerte des ganzen Rezepts bleiben dabei gleich. Die Wahl zwischen automatischem und eigenem Gewicht bleibt beim Bearbeiten erhalten.

Gespeicherte Rezepte findest du über den Filter „Rezepte“ sowie in der Lebensmittelauswahl des Tagebuchs. Mit der Einheit „Portion“ lassen sich auch halbe oder mehrere Portionen eintragen. Rezepte können favorisiert, bearbeitet, gelöscht und per „Rückgängig“ wiederhergestellt werden. Zutatenwerte werden beim Hinzufügen übernommen; spätere Produkt- oder Rezeptänderungen verändern bestehende Tagebucheinträge nicht.

Rezepte samt Zutaten und Zubereitungsnotizen sind Teil der Produkte in der Datensicherung. Ein Import ersetzt daher auch vorhandene Rezepte.

## Letzter Sicherungsexport

Die Datensicherungsseite zeigt den letzten erfassten Export mit deutschem Datum und Uhrzeit für Europe/Ljubljana. Ohne erfassten Export erscheint „Noch kein Export erfasst“. Der Zeitpunkt wird nach dem Start eines Sicherungsdownloads in diesem Browser gespeichert und bleibt nach einem Neuladen erhalten. Der Browser kann das endgültige Speichern oder Abbrechen des Downloads nicht bestätigen.

Der Exportverlauf ist geräte- und browserspezifisch. Er wird nicht in die Sicherungsdatei aufgenommen und bei einem Import nicht überschrieben. Exporte vor Einführung dieser Anzeige können nicht nachträglich erkannt werden.

## Vorlagen, Einkaufsliste und Wochenplanung

Unter „Planen“ gibt es drei Bereiche:

- **Vorlagen:** Speichere im Tagebuch eine ganze Mahlzeit über „Als Vorlage speichern“. Eine Vorlage kann mit einem Mengenfaktor (z. B. 0,5 oder 2) an einem Datum und einer Mahlzeit ins Tagebuch übernommen oder für den Wochenplan verwendet werden. Vorlagen behalten die gespeicherten Mengen und Nährwerte, auch wenn Produkte später geändert oder gelöscht werden.
- **Einkaufsliste:** Rezepte mit der benötigten Portionsanzahl auswählen und daraus eine Liste erstellen oder bestehende Mengen ergänzen. Gleiche Produkte werden anhand ihrer Produkt-ID in Gramm zusammengeführt. Abgehakte Zutaten bleiben nach einem Neuladen erhalten; zusätzliche Mengen setzen betroffene Häkchen zurück. Unterrezepte werden als eigene Zutat aufgeführt. Das Leeren der Liste lässt sich über „Rückgängig“ zurücknehmen.
- **Wochenplan:** Lebensmittel, Rezepte oder Vorlagen für einen Tag und eine Mahlzeit vormerken, bearbeiten oder löschen. Geplante Mahlzeiten zählen erst nach „Ins Tagebuch übernehmen“ zu den erfassten Tages- und Wochenwerten. Eine Planung kann nur einmal übernommen werden. Einträge im Tagebuch bleiben beim Löschen der Planung erhalten. Die Einkaufsliste aus einer Planungswoche berücksichtigt nur noch offene Planungen.

Datensicherungen ab Version 4 enthalten Vorlagen, Wochenpläne und Einkaufslisten inklusive Häkchen. Beim Import der Versionen 1–3 bleiben vorhandene Planungsdaten erhalten. Ungültige Sicherungen werden vor dem Ersetzen der Daten abgewiesen. Der gerätespezifische letzte Exportzeitpunkt bleibt weiterhin lokal.

## Notizen pro Tag

Im Tagebuch gibt es für das gewählte Datum den einklappbaren Bereich „Tagesnotizen“. Hunger, Energie, Training und eigene Beobachtungen sind freie, optionale Textfelder. Mit „Notiz speichern“ werden die Angaben für diesen Tag gesichert. Ungespeicherte Änderungen sind im Formular gekennzeichnet und bleiben beim Einklappen erhalten; vor einem Datums- oder Seitenwechsel bitte speichern.

Vorhandene Notizen lassen sich bearbeiten oder löschen. „Rückgängig“ stellt gelöschte Notizen wieder her, solange kein neuerer Datensatz oder Datenimport dazwischenliegt. Neue Datensicherungen (Version 5) enthalten alle gespeicherten Tagesnotizen. Ältere Sicherungen (Versionen 1–4) lassen vorhandene Notizen beim Import unverändert.

## CSV-Auswertung

Unter „Datensicherung“ lädt „CSV-Tageswerte herunterladen“ eine Tabelle mit einer Zeile pro erfasstem Tag herunter. Enthalten sind Datum, Anzahl der Einträge, Kalorien, Protein, Kohlenhydrate, Fett, Ballaststoffe, Zucker und Gewicht. Der Zeitraum lässt sich optional eingrenzen. Ohne Datumsgrenzen werden alle vorhandenen Tageswerte exportiert.

Die Datei verwendet UTF-8, Semikolon als Trennzeichen und das deutsche Dezimalkomma. Tage mit ausschließlich einer Gewichtsmessung enthalten leere Nährwertfelder; fehlende Gewichtsmessungen bleiben ebenfalls leer. Geplante Mahlzeiten zählen erst nach der Übernahme ins Tagebuch. Die Nährwerte stammen aus den gespeicherten Tagebucheinträgen.

CSV dient der eigenen Auswertung. Für eine Wiederherstellung weiterhin JSON exportieren; der CSV-Download verändert den letzten Sicherungszeitpunkt nicht.

Beim Bearbeiten eines Tagebucheintrags wird der Editor automatisch ins Sichtfeld gescrollt und seine Überschrift fokussiert, auch bei Einträgen weit unten auf der Seite.

## Code finden

- `src/main.tsx`: React-Einstiegspunkt.
- `src/hydration.ts`, `src/hooks/useHydration.ts`, `src/components/HydrationTracker.tsx`, `DrinkForm.tsx` und `DrinkTimeline.tsx`: Trinkmengen, Einheiten, Tagesverlauf und Eingabe.
- `src/diaryHistory.ts`, `src/hooks/useDiaryHistory.ts`, `RecentFoods.tsx` und `DiarySearch.tsx`: letzte Produkte, Verlaufssuche und Aktualisierung nach Datenänderungen.
- `src/entryQuantity.ts` und `src/components/QuickQuantity.tsx`: direkte Mengenänderung mit historischen Umrechnungen; atomare Speicherung in `src/db.ts`.
- `src/components/DiaryEntry.tsx` und `src/hooks/useDiaryView.ts`: normale/kompakte Eintragsansicht, aufklappbare Details und lokale Ansichtsauswahl.
- `src/foodValues.ts`, `src/components/FoodEditor.tsx`, `FoodPortions.tsx` und `PortionPicker.tsx`: Nährwert-Bezugsmenge, zusätzliche Portionsgrößen und Größenauswahl.
- `src/csv.ts` und `src/components/CsvExport.tsx`: CSV-Tagesauswertung und Download mit Zeitraumwahl.
- `src/notes.ts`, `src/components/DailyNotes.tsx` und `src/hooks/useDayNote.ts`: Tagesnotizen, Validierung und Eingabe.
- `src/planning.ts` und `src/planningDb.ts`: Vorlagen, Planung, Einkaufsberechnung und Speicherung.
- `src/components/PlanningPage.tsx`, `TemplateLibrary.tsx`, `ShoppingListView.tsx` und `MealPlanner.tsx`: Die drei Planungsbereiche.
- `src/hooks/usePlanningData.ts`: Laden und Aktualisieren der Planungsdaten.
- `src/backup.ts`, `src/components/BackupStatus.tsx` und `src/hooks/useBackupStatus.ts`: Exportzeitpunkt und Statusanzeige.
- `src/App.tsx`: Navigation und Seitenzusammenstellung.
- `src/components/`: Tagebuch, Lebensmittelliste, Eintragseditor, Produkteditor und Backup-Seite.
- `src/hooks/useNutritionData.ts`: Laden und Speichern sowie Initialisierung der Beispieldaten.
- `src/nutrition.ts`: Einheiten, Umrechnung, Nährwertberechnung und Validierung.
- `src/goals.ts`: Tagesziele, Validierung und Fortschrittsberechnung.
- `src/components/DailySummary.tsx` und `GoalEditor.tsx`: Tagesbilanz, Fortschrittsbalken und Zieleingabe.
- `src/hooks/useDailyGoals.ts`: Laden und Speichern der Tagesziele.
- `src/week.ts`: Kalenderwochen, Tages- und Wochensummen sowie Durchschnittswerte.
- `src/recipes.ts`: Rezeptdaten, Zutatenvalidierung und Nährwert-/Portionsberechnung.
- `src/components/RecipeEditor.tsx` und `RecipeIngredients.tsx`: Rezepte und Zutaten bearbeiten.
- `src/components/WeeklyPage.tsx` und `WeeklyNutritionChart.tsx`: Wochenübersicht und Tagesvergleich.
- `src/hooks/useWeekData.ts`: Zeitraumabfragen und Aktualisierung der Wochenansicht.
- `src/weight.ts`: Gewichtsdaten, Datumsprüfung, Vergleich und Zeiträume.
- `src/components/WeightTracker.tsx` und `WeightChart.tsx`: Gewichtseingabe und Verlaufsdiagramm.
- `src/hooks/useWeightData.ts`: Laden und Speichern der Gewichtsmessungen.
- `src/db.ts`: Datenmodelle, IndexedDB und Backup-Import/Export.

Prüfen: `npm test` und `npm run build`.

## Daten

- Produkte und Tagebucheinträge werden automatisch in **IndexedDB** gespeichert.
- Der JSON-Export enthält alle Produkte und alle Tagebucheinträge, auch von anderen Tagen.
- **Import ersetzt die enthaltenen Daten** nach einer Sicherheitsabfrage; ältere Sicherungen erhalten Gewichtswerte und Ziele, die ihr Format noch nicht unterstützt.
- Browserdaten löschen, private Tabs oder ein anderes Gerät können zu einem leeren Datenbestand führen. Regelmäßig JSON-Backups erstellen.
- Einträge speichern einen Snapshot der Nährwerte. Änderungen an einem Produkt verändern alte Tagebucheinträge nicht.
- Die 11 Startprodukte sind Beispielwerte, teilweise geschätzt. Prüfe besonders Brot, Putenbrust und Portionsgrößen anhand der Verpackung.
- Beim allerersten Start werden die Startprodukte geladen. Nach einem vollständigen Löschen aller Produkte bei bereits existierenden Einträgen werden sie nicht neu eingefügt.

## Hinweis zur PWA

Die App kann nach dem ersten Online-Besuch offline funktionieren. Browserabhängig können für die vollständige Installierbarkeit PNG-Icons erforderlich sein; SVG-Icons sind bereits enthalten.
