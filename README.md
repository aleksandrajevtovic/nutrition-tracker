# Nutrition Tracker

Statische React + TypeScript PWA mit lokaler IndexedDB-Datenbank und JSON-Backup. Kein Login und kein Backend. Erfasste Daten bleiben lokal; der optionale Produktimport fragt Open Food Facts ab.

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

## Schutz ungespeicherter Eingaben

Beim Datums- oder Seitenwechsel und beim Schließen oder Ersetzen eines geänderten Formulars fragt die App, ob die ungespeicherten Änderungen verworfen werden sollen. Mit „Abbrechen“ bleiben Formular, Datum und Eingaben erhalten. Unveränderte Formulare sowie erfolgreich gespeicherte Eingaben lösen keine Rückfrage aus. Während eines laufenden Speichervorgangs wird der Wechsel verhindert.

Geschützt werden Tagebucheinträge samt Notizen, Lebensmittel, Rezepte einschließlich noch nicht hinzugefügter Zutaten, Tagesnotizen, Getränke, Gewichte, Tagesziele, direkte Mengenänderungen sowie Planungs-, Vorlagen- und Einkaufsformulare. Einklappen fragt nicht nach, wenn das Formular dabei erhalten bleibt. Ein Wechsel der Tagebuchansicht prüft ungespeicherte direkte Mengenänderungen, da dabei deren Formulare ersetzt werden.

Beim Neuladen oder Schließen einer Seite mit offenen Änderungen wird die native Browserwarnung angefordert. Deren Darstellung und Verfügbarkeit hängen vom Browser ab. Entwürfe werden nicht automatisch gespeichert; ausdrücklich bestätigtes Verwerfen entfernt sie. Bei einem Speicherfehler bleibt der Schutz aktiv.

## Geöffnete Bereiche direkt im Blick

Beim Öffnen von Tageszielen, Tagesnotizen, Getränke- und Gewichtsbereichen, Eintragsdetails, Mengenformularen, Kopier- und Vorlagenformularen sowie der Tagebuchsuche scrollt die App zum geöffneten Bereich. Auch erneut geöffnete Abschnitte und die Messwerttabelle werden sichtbar gemacht. Die Bewegung berücksichtigt die Systemeinstellung für reduzierte Animationen. Tippen, Speichern und Einklappen lösen keinen erneuten automatischen Sprung aus.

## Mengen und Einheiten

- Im Tagebuch Menge und Einheit wählen: g, mg, kg, ml, l, Portion, Stück oder Scheibe. Dezimalmengen sind möglich.
- Für Stück und Scheibe das Gewicht pro Einheit festlegen; für ml und l die Dichte in g/ml. Diese Werte können direkt beim Eintragen oder im Produkteditor gespeichert werden.
- Eigene Einheiten wie Esslöffel oder Becher über den Portionsnamen und das Portionsgewicht definieren.
- Im Produkteditor die Bezugsmenge wählen: 100 g, 100 ml, 1 Portion oder eine eigene Grammmenge. Beispiel: Portionsname „Mittel“, 150 g pro Portion, Bezug „1 Portion“ und 116 kcal eingeben. Die App rechnet für ihre Berechnungen automatisch auf 100 g um und zeigt beim erneuten Bearbeiten wieder die gewählte Bezugsmenge. Für 100 ml ist eine Dichte erforderlich.
- Weitere Portionsgrößen können eigene Namen und Gewichte erhalten, etwa „Klein“ mit 80 g und „Groß“ mit 250 g. Bei der Einheit „Portion“ steht die Größenwahl im Tagebuch, in Rezeptzutaten und in neuen Wochenplanungen zur Verfügung. Alle Größen werden aus denselben Nährwerten berechnet; gerundete Quellenwerte können leicht abweichen.
- Gespeicherte Einträge behalten ihre Menge, Einheit, gewählte Portionsgröße und ihren Nährwert-Snapshot. Eine andere Größenwahl verändert den Tagebucheintrag, ohne die Standardportion im Produkt zu überschreiben. Ältere Einträge und Backups funktionieren weiterhin; neue Bezugsangaben und Portionsgrößen sind im JSON-Backup enthalten.

Portionsmengen werden über `src/quantityLabels.ts` einheitlich angezeigt: Aus „2 × 1 Becher“ wird „2 Becher · 300 g“, aus zwei Scheiben „2 Scheiben · 80 g“. Eigene Größen bleiben beispielsweise „2 × Klein · 160 g“. Die Anzeige gilt im kompakten und normalen Tagebuch, bei Mengenänderungen, zuletzt verwendeten Lebensmitteln, Suchtreffern, Rezeptzutaten und geplanten Mahlzeiten. Zahlen, freie Portionsnamen und gespeicherte Gewichte werden dafür nicht verändert; historische Einträge verwenden weiterhin ihre eigenen gespeicherten Angaben. Gramm-, ml- und andere Mengenumrechnungen bleiben unverändert.

## Lebensmittel übersichtlich anlegen und bearbeiten

Das Formular ist in Produkt, Nährwerte und Portionen gegliedert. Die Nährwerte stehen in zwei Spalten; die gemeinsame Bezugsmenge wird einmal darüber angezeigt. Titel und Speichern bleiben sichtbar, während der Formularinhalt gescrollt wird. Auf größeren Bildschirmen stehen Produktname und Marke nebeneinander.

Beim manuellen Anlegen starten die Nährwertfelder leer. Pflichtwerte müssen ergänzt werden; eine tatsächliche 0 wird ausdrücklich eingegeben. Ballaststoffe sind optional und können ohne Platzhalter leer bleiben, wenn sie nicht auf der Verpackung stehen. Leere Ballaststoffe werden als unbekannt (`null`) gespeichert und bleiben beim erneuten Bearbeiten leer. Vorhandene Lebensmittel zeigen weiterhin ihre gespeicherten Werte einschließlich Nullwerten. Zahlenfelder markieren beim Fokussieren den Inhalt, damit direktes Tippen den bisherigen Wert ersetzt. Fokussieren oder Verlassen allein verändert nichts. Übernommene Barcode-/Fotowerte und bestehende Tagebucheinträge behalten ihre Werte; es erfolgt keine rückwirkende Neuberechnung.

Fehlen Ballaststoffe bei mindestens einem Lebensmittel, kennzeichnen Tages- und Wochenansicht den betreffenden Wert als „Unvollständig“. Ein Ziel- oder Vorwochenvergleich wird für diesen Wert nicht als vollständig angezeigt; der Wochenbalken bleibt ohne Zahlenwert. Andere Nährwerte werden normal berechnet. Rezepte übernehmen fehlende Ballaststoffangaben aus ihren Zutaten. Tages- und Wochen-CSV lassen unvollständige Ballaststoffwerte leer, während bekannte 0 g als 0 exportiert werden. JSON-Sicherungen, Eintrags-Snapshots, Vorlagen und Planungen erhalten die Unterscheidung zwischen unbekannt und 0 g. Bestehende numerische Angaben bleiben unverändert.

Die Standardportion und zusätzliche Portionsgrößen sind einklappbare Karten mit Name und Gewicht in der Zusammenfassung. Bei Nährwerten pro Portion öffnet sich die Standardportion automatisch. „Weitere Portion“ öffnet eine neue Karte und fokussiert ihren Namen; das Gewicht bleibt zur eigenen Eingabe frei. Namensvorschläge wie „Klein“, „Becher“ oder „Esslöffel“ verändern nur den Namen. Eingaben bleiben beim Einklappen erhalten.

Stück-, Scheiben- und zusätzliche ml-Umrechnungen liegen unter „Weitere Einheiten“; vorhandene Umrechnungen werden beim Öffnen des Formulars angezeigt. Bei Bezug auf 100 ml steht die erforderliche Dichte direkt im Nährwertbereich. Der Barcode liegt unter „Weitere Angaben“. Beim Speichern werden fehlende oder ungültige Werte direkt am Feld erläutert; ein betroffener eingeklappter Bereich wird geöffnet und das erste fehlerhafte Feld sichtbar gemacht und fokussiert. Berechnungen, Importkontrolle und der Schutz ungespeicherter Eingaben bleiben erhalten.

## Produkte scannen und Nährwerttabellen einlesen

„Produkt scannen“ gibt es unter „Produkte“ und beim Anlegen eines Tagebucheintrags. Der Import öffnet sich als Dialog mit Kamera, manueller Barcode-Eingabe und Fotoauswahl. EAN-8, UPC-A, EAN-13 und GTIN-14 werden mit Prüfziffer geprüft. Für den Kamerazugriff sind HTTPS (oder localhost) und eine Kameraberechtigung nötig. Die Kamera wird beim Erkennen, Ausschalten oder Schließen freigegeben. Ohne Kamera kann die Nummer eingegeben werden.

Zuerst wird lokal nach dem Barcode gesucht. Führende Nullstellen bei UPC/EAN ändern die Produktidentität nicht. Ein gespeichertes Produkt verwendet deine aktuellen Werte und lässt sich direkt auswählen oder bearbeiten, auch offline. Neue Barcodes werden über die öffentliche Open-Food-Facts-API abgefragt. Die Abfrage hat ein Zeitlimit; fehlende Treffer, Verbindungsprobleme und Abfragelimits werden angezeigt. Ohne Treffer kann ein Produkt mit übernommenem Barcode manuell angelegt werden. Korrekturen werden ausschließlich lokal gespeichert.

Bei einem Datenbanktreffer öffnet sich das vorhandene Produktformular als bearbeitbare Vorschau. Übernommen werden Name, Marke, Nährwerte und, wenn eindeutig in Gramm vorhanden, die Portionsgröße. Verwendet werden die standardisierten Werte pro 100 g beziehungsweise 100 ml, keine Angaben des zubereiteten Produkts. Falls nur kJ vorliegen, werden sie in kcal umgerechnet. Fehlende Werte bleiben leer und müssen bis auf die optionalen Ballaststoffe ergänzt werden; sie werden nicht automatisch zu 0. Bezugsmenge, Werte und Portionen müssen anhand der Verpackung geprüft und bestätigt werden. Für 100 ml ist eine ausdrücklich angegebene Dichte erforderlich. Die Lebensmittelübersicht zeigt weiterhin die intern verwendeten Werte pro 100 g.

„Foto aufnehmen oder auswählen“ liest eine scharfe, gerade fotografierte Nährwerttabelle als JPG, PNG, WebP oder BMP (maximal 12 MB). Die Texterkennung mit Tesseract.js läuft lokal auf dem Gerät. Das Foto wird weder hochgeladen noch dauerhaft gespeichert. Beim ersten Aufruf werden Erkennungsdateien und deutsche/englische Sprachdaten aus dem Internet geladen. Der erkannte Text bleibt sichtbar und korrigierbar; bei zwei Wertespalten kann die gewünschte Spalte gewählt werden. Anschließend werden die erkannten Angaben im Produktformular geprüft. Dezimalkommas und kJ werden berücksichtigt. Nicht erkannte Werte und Angaben mit „kleiner als“/„größer als“ müssen selbst ergänzt werden; die Erkennung ersetzt keine Kontrolle der Verpackung.

„Produkt speichern“ legt das Lebensmittel in deiner Liste ab. Im Tagebuch gibt es zusätzlich „Speichern und zum Tag hinzufügen“: Das Produkt wird gespeichert und im bestehenden Eintragsformular ausgewählt. Mahlzeit und Eintragsnotiz bleiben erhalten. Menge und Einheit können vor dem eigentlichen Tagebucheintrag angepasst werden. Ein bereits gespeichertes Produkt lässt sich direkt über „Für Eintrag auswählen“ übernehmen.

Barcodes und die Herkunft von Open-Food-Facts-Daten sind optionale Produktfelder und bleiben bei JSON-Export/Import erhalten. Ältere Sicherungen bleiben kompatibel. Doppelte Barcodes werden beim Speichern, Wiederherstellen und beim Import einer Sicherung abgewiesen. Importierte Produkte verlinken ihre Quelle und die ODbL-Lizenz. Scanner und Texterkennung werden erst bei Bedarf geladen.

Die Umsetzung ist getrennt: `ProductImport.tsx` koordiniert den Dialog, `BarcodeCamera.tsx` die Kamera, `productImport.ts` die Datenbankabfrage und Zuordnung, `barcode.ts` die Barcode-Prüfung, `labelRecognition.ts` die Texterkennung und `labelNutrition.ts` die Zuordnung der erkannten Nährwerte. Die Kontrolle und Speicherung verwenden weiterhin `FoodEditor.tsx`.

## Mahlzeiten schneller finden

Direkt unter dem Datum gibt es eine beim Scrollen oben erreichbare Mahlzeitenleiste. „Alle“ zeigt den ganzen Tag, ein Mahlzeitenfilter nur die zugehörigen Einträge. Die Zahl am Button gibt die Anzahl der Einträge dieser Mahlzeit an; eigene Mahlzeitennamen werden ebenfalls angeboten. Auf schmalen Bildschirmen lässt sich die Leiste horizontal verschieben. Ein Klick führt direkt zum Mahlzeitenbereich. Die Tagesbilanz berechnet weiterhin den gesamten Tag.

„Lebensmittel hinzufügen“ übernimmt die ausgewählte Mahlzeit, auch bei „Zuletzt verwendet“. Bei „Alle“ bleibt Frühstück die Vorauswahl. Wird ein Eintrag in eine andere Mahlzeit verschoben, folgt der aktive Filter nach dem Speichern dieser Mahlzeit. Ein Suchtreffer öffnet Datum und Mahlzeit des gefundenen Eintrags. Leere Mahlzeiten bleiben auswählbar, damit dort direkt etwas ergänzt werden kann.

Beim Anlegen eines Tagebucheintrags gibt es zusätzlich „Speichern und weiteres hinzufügen“. Nach erfolgreichem Speichern öffnet sich ein frischer Eintrag am selben Datum und mit der tatsächlich gewählten Mahlzeit, auch bei eigenen Mahlzeitennamen. Die Lebensmittelauswahl wird sichtbar und fokussiert. Lebensmittel, Menge, Einheit, Umrechnungen und Eintragsnotiz starten neu; die Notiz des gespeicherten Eintrags wird nicht auf den nächsten übertragen. Der aktive Mahlzeitenfilter folgt weiterhin der gewählten Mahlzeit. Ein unveränderter Folgeeintrag lässt sich ohne Verwerfen-Rückfrage schließen. Bei einem Speicherfehler bleiben alle Eingaben erhalten. „Zum Tag hinzufügen“, direktes Hinzufügen aus „Zuletzt verwendet“ und „Änderungen speichern“ schließen das Formular wie bisher. Laufende Speichervorgänge sind gegen mehrfaches Absenden geschützt.

Das kleine + direkt am Mahlzeitenkopf öffnet die Eingabe mit genau dieser Mahlzeit, auch in der Ansicht „Alle“ und bei eigenen Mahlzeitennamen. Das Formular wird automatisch sichtbar. Ein bestehender geänderter Entwurf wird erst nach Bestätigung ersetzt. Auch im Leerzustand einer ausgewählten Mahlzeit gibt es eine direkte Hinzufügen-Schaltfläche.

Über den Mahlzeitennamen mit Pfeil kannst du jede Mahlzeit einzeln zusammenklappen. Name, Kaloriensumme und das kleine + bleiben sichtbar; die Einträge sowie Kopier- und Vorlagenformulare bleiben im Hintergrund erhalten. Beim Aufklappen stehen die zusätzlichen Aktionen wieder bereit. Einklappen verändert keine Daten und verwirft keine Entwürfe; der Schutz ungespeicherter Mengen-, Kopier- und Vorlageneingaben bleibt aktiv. Das funktioniert sowohl kompakt als auch in der Standardansicht und mit eigenen Mahlzeitennamen.

Die Auswahl bleibt beim Wechsel zu „Alle“ und beim Umschalten der Tagebuchansicht erhalten. Ein gezielt gewählter Mahlzeitenfilter öffnet die betreffende Mahlzeit. Nach erfolgreichem Hinzufügen oder Bearbeiten wird die betroffene Mahlzeit aufgeklappt, auch bei „Speichern und weiteres hinzufügen“. An einem anderen Datum oder beim erneuten Öffnen des Tagebuchs starten die Mahlzeiten geöffnet. Die Mahlzeitenkarte liegt in `src/components/MealCard.tsx`; die seitenbezogene Auswahl steuert `DiaryPage.tsx`.

Gewicht, Trinkmenge und Tagesnotizen liegen im standardmäßig geschlossenen Bereich „Weitere Tagesdaten“. Einklappen erhält die Formulare und ihre Entwürfe. Der Schutz ungespeicherter Eingaben bleibt aktiv. Beim Filtern fragt die App vor dem Verwerfen offener Formulare oder dem Ausblenden geänderter Mengen nach; weiterhin sichtbare Mengenentwürfe bleiben erhalten.

## Kompakter Tagebuchmodus

Über „Kompakt“ neben „Mahlzeiten“ lässt sich die Tagebuchansicht umschalten. Ohne gespeicherte Auswahl startet das Tagebuch kompakt; eine bereits gewählte Ansicht bleibt erhalten. In der kompakten Ansicht zeigt jede Zeile Lebensmittelname und Kalorien. Ein Klick oder die Eingabe-/Leertaste auf der Zeile klappt den vollständigen Namen, Marke, Menge, Nährwerte, eine vorhandene Eintragsnotiz sowie Bearbeiten und Löschen auf. Mehrere Einträge können gleichzeitig geöffnet bleiben. Beim Wechsel des Datums starten die Details wieder eingeklappt.

Kopieren und „Als Vorlage speichern“ stehen als Symbole im Mahlzeitenkopf zur Verfügung. Mengen, Tageswerte und gespeicherte Einträge bleiben beim Ansichtswechsel unverändert. Die Ansicht wird lokal für diesen Browser gespeichert und bleibt beim Seitenwechsel und Neuladen erhalten. Sie ist nicht Teil der JSON-Datensicherung. Falls der Browser die Speicherung der Auswahl blockiert, lässt sich die Ansicht weiterhin umschalten; eine Fehlermeldung weist auf die fehlende Speicherung hin.

## Notizen zu einzelnen Einträgen

Beim Hinzufügen oder Bearbeiten eines Lebensmittels im Tagebuch gibt es das optionale Feld „Notiz zum Eintrag“. Es unterstützt mehrere Zeilen und gehört nur zu diesem Eintrag. Zum Entfernen die Notiz leeren und speichern. In der Standardansicht steht die Notiz direkt am Eintrag; kompakt weist ein Sprechblasensymbol auf die Notiz in den aufklappbaren Details hin.

Notizen bleiben nach Neuladen, Kopieren, Löschen/Rückgängig und JSON-Export/Import erhalten. Auch Mahlzeiten-Vorlagen behalten die Notizen der gespeicherten Einträge. Sie ändern weder die Produktdaten noch die Tageswerte und werden nicht in der CSV-Tagesauswertung ausgegeben. Alte Einträge und Sicherungen ohne Notiz bleiben kompatibel.

## Zuletzt verwendet, Tagebuchsuche und schnelle Mengenkorrektur

„Zuletzt verwendet“ ist standardmäßig geschlossen und lässt sich bei Bedarf über die Überschrift öffnen.

Beim Hinzufügen eines Lebensmittels zeigt „Zuletzt verwendet“ bis zu sechs zuletzt eingetragene Produkte, je Produkt mit der zuletzt erfassten Menge und Einheit. Die Reihenfolge richtet sich nach dem Erfassungszeitpunkt. Ein Klick auf den Namen übernimmt die Menge ins Formular; mit + entsteht direkt ein neuer Eintrag am gewählten Datum in der oben ausgewählten Mahlzeit. Verwendet werden die aktuellen Produktwerte und, sofern vorhanden, die passende Portionsgröße. Fehlt die frühere Größe oder eine Umrechnung, wird das gespeicherte Grammgewicht übernommen. Gelöschte Produkte werden nicht angeboten. Alte Eintragsnotizen werden nicht übernommen; eine im neuen Formular eingegebene Notiz wird gespeichert.

„Tagebuchsuche“ neben „Kompakt“ durchsucht Lebensmittelname, Marke, Mahlzeit und Eintragsnotizen über alle gespeicherten Tage. Mehrere Suchwörter müssen alle vorkommen, unabhängig von Groß-/Kleinschreibung. Datumsgrenzen sind optional und schließen Start- und Endtag ein. Ohne Suchbegriff erscheinen die neuesten Einträge. Jeweils 30 Treffer werden angezeigt, weitere lassen sich nachladen. Auch Einträge zu gelöschten Produkten lassen sich finden. „Eintrag bearbeiten“ wechselt zum richtigen Datum und öffnet den Editor mit den historischen Produktwerten.

Im aufgeklappten kompakten Eintrag kann die Menge direkt geändert werden; in der Standardansicht öffnet „Menge ändern“ das gleiche Formular. Die Einheit bleibt erhalten. Dezimalpunkt und Dezimalkomma funktionieren. Eine Vorschau zeigt Gramm und Kalorien; erst „Menge speichern“ aktualisiert den Eintrag sowie Tages- und Wochenwerte. Notiz, Mahlzeit und gespeicherte Produktwerte bleiben erhalten. Ungültige oder nicht mehr vorhandene Einträge werden nicht überschrieben. Diese Funktionen verwenden die vorhandenen Tagebucheinträge; das Sicherungsformat bleibt kompatibel.

## Mahlzeiten kopieren, Favoriten und Rückgängig

Einzelne Tagebucheinträge lassen sich über das Symbol „Kopieren oder verschieben“ neben Bearbeiten/Löschen übertragen. Im kompakten Modus stehen diese Aktionen in den aufgeklappten Eintragsdetails. Das Formular bietet Kopieren oder Verschieben, Zieldatum und Zielmahlzeit einschließlich der am Tag vorhandenen eigenen Mahlzeiten. Kopieren schlägt den Folgetag des Eintrags vor; Verschieben zunächst denselben Tag. „Gleicher Tag“ und „Morgen“ (bezogen auf heute) wählen das Datum direkt. Zum Verschieben muss sich mindestens Datum oder Mahlzeit ändern.

Kopieren erstellt einen neuen Eintrag und lässt das Original bestehen. Verschieben verändert nur Datum und Mahlzeit desselben Eintrags. Menge, Einheit, ausgewählte Portion, Notiz und gespeicherte Produktwerte bleiben unverändert, auch wenn das Produkt inzwischen bearbeitet oder gelöscht wurde. Vorhandene Einträge am Ziel bleiben erhalten. Bei einem anderen Ziel innerhalb desselben Tages öffnet sich die Zielmahlzeit; ein aktiver Mahlzeitenfilter wechselt bei Bedarf zu „Alle“, damit andere offene Mengenentwürfe erhalten bleiben. Bei einem anderen Datum bleibst du am bisherigen Tag; die Erfolgsmeldung nennt das Ziel.

„Rückgängig“ nimmt die Übertragung zurück, solange der betroffene Eintrag unverändert und kein Datenimport dazwischengekommen ist. Änderungen an der Quelle während einer offenen Übertragung werden nicht stillschweigend übernommen. Speichern und Rückgängig erfolgen atomar; Doppelklicks werden abgefangen. Bei Speicherfehlern bleiben Ursprung und Formular erhalten. Ungespeicherte Mengen- oder Übertragungsentwürfe sind beim Wechseln, Schließen und Ersetzen geschützt. Einklappen erhält den Entwurf. Die Umsetzung liegt in `src/entryTransfer.ts` und `src/components/EntryTransferForm.tsx`.

- Über das Kopiersymbol neben einer Mahlzeit kannst du alle Einträge auf ein Zieldatum und eine Zielmahlzeit übertragen. Mengen, Einheiten und gespeicherte Nährwerte bleiben erhalten. Vorhandene Einträge werden ergänzt.
- Unter „Produkte“ lassen sich Lebensmittel mit dem Stern als Favoriten markieren. Der Favoritenfilter zeigt nur markierte Produkte; im Such-Dropdown stehen sie zuerst. Favoriten sind Teil der Datensicherung.
- Nach dem Löschen eines Tagebucheintrags, Produkts oder Gewichtswerts steht in der Meldung für 10 Sekunden „Rückgängig“ zur Verfügung. Beim Darüberfahren oder Tastaturfokus pausiert die Ausblendung. Neuere Datensätze werden nicht überschrieben; ein Datenimport beendet die Gültigkeit vorheriger Wiederherstellungen.

## Körpergewicht

Im Tagebuch kannst du für das gewählte Datum dein Körpergewicht in kg speichern, aktualisieren oder löschen. Komma und Punkt sind als Dezimaltrennzeichen möglich. Pro Tag gibt es eine Messung.

Die kompakte Karte zeigt nur den Messwert des gewählten Tages. Antippen öffnet direkt das Eingabefeld; ohne Messung gibt es den Button „Gewicht eintragen“. Das Feld erhält automatisch den Fokus. Die letzte frühere Messung wird als ausdrücklich gekennzeichneter Vorschlag vorausgefüllt und erst durch „Speichern“ als Messung für diesen Tag übernommen. Spätere Messungen werden nicht vorgeschlagen. Nach dem Speichern schließt sich die Eingabe wieder. Ungespeicherte Änderungen bleiben durch die Wechsel- und Schließen-Rückfrage geschützt.

Direkt über der Gewichtseingabe steht die letzte frühere Messung, zum Beispiel „Zuletzt 72,4 kg · gestern“. „Heute“ und „gestern“ beziehen sich auf das tatsächliche aktuelle Datum; ältere oder zukünftige Referenzdaten werden vollständig angezeigt. Das vollständige Datum ist zusätzlich am Datumshinweis hinterlegt. Beim Bearbeiten bleibt der gespeicherte Wert im Eingabefeld und die vorherige Messung dient als Vergleich. Bei rückwirkenden Einträgen werden keine späteren Messungen als Referenz verwendet. Ohne frühere Messung erscheint ein kurzer Hinweis.

„Verlauf anzeigen“ öffnet Diagramm und Vergleichswerte unabhängig von der Eingabe. Der Verlauf bleibt standardmäßig eingeklappt. Ein Wechsel seiner Sichtbarkeit verwirft keine Eingaben.

Die Vergleiche zeigen die Änderung zur vorherigen Messung und seit der ersten Messung bis zum gewählten Datum. Das Diagramm zeigt 30 Tage, 90 Tage oder den gesamten bisherigen Verlauf. Messpunkte lassen sich per Maus, Berührung und Tastatur auswählen; alle Werte stehen zusätzlich in einer Tabelle. Tage ohne Messung werden übersprungen.

Datensicherungen ab Version 2 enthalten auch Gewichtsmessungen. Beim Import alter Sicherungen (Version 1) bleiben vorhandene Gewichtsmessungen erhalten.

## Trinkmenge

Im Tagebuch zeigt „Trinkmenge“ die Gesamtmenge aller Getränke für das gewählte Datum. Wasser lässt sich direkt mit 150, 250 oder 500 ml ergänzen. Unter „Mehr“ können eigene Getränkenamen (etwa Tee, Kaffee oder Saft), Mengen in ml oder Litern und eine Uhrzeit eingetragen werden. Dezimalpunkt und Dezimalkomma funktionieren; beim Wechsel der Einheit bleibt die bereits eingegebene Menge gleich.

Der Tagesverlauf sortiert die Getränke nach ihrer Uhrzeit und zeigt die bis dahin erfasste Gesamtmenge als Zahl und Balken. Einträge lassen sich bearbeiten oder löschen; „Rückgängig“ stellt einen gelöschten Eintrag wieder her. Die Detailansicht ist standardmäßig eingeklappt. Beim Datumswechsel werden die Getränke des gewählten Tages geladen; die Schnellbuttons bleiben direkt erreichbar.

Die Trinkmenge zählt das Volumen aller erfassten Getränke. Getränke mit Kalorien zusätzlich als Lebensmittel eintragen, damit ihre Nährwerte in die Tagesbilanz eingehen. Ein Trinkziel wird nicht vorgegeben.

JSON-Sicherungen ab Version 6 enthalten die Trinkdaten aller Tage. Beim Import der Versionen 1–5 bleiben bestehende Trinkdaten erhalten. Eine Sicherung der Version 6 ersetzt auch die Trinkdaten; eine leere Getränkeliste löscht sie ausdrücklich. Der lokale letzte Sicherungszeitpunkt bleibt unverändert durch Importe. Die Datenbank wird auf Version 7 erweitert, ohne vorhandene Einträge zu verändern.

## Eigene Tagesziele

In der Tagesbilanz kannst du über „Ziele festlegen“ eigene Ziele für Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe eintragen. Alle Ziele sind optional; leere Felder deaktivieren die jeweilige Anzeige. Es werden keine Zielwerte vorgegeben. Die eingestellten Ziele gelten für alle Tage, auch für ältere Tagesansichten.

Die Fortschrittsbalken zeigen den aktuellen Verbrauch, den Zielwert und die verbleibende Menge. Überschreitungen werden als Menge und Prozentwert angezeigt; der Balken bleibt maximal voll. Ziele lassen sich jederzeit bearbeiten oder vollständig entfernen.

Neue Datensicherungen (Version 3) enthalten auch Tagesziele. Beim Import der Versionen 1 und 2 bleiben vorhandene Ziele erhalten.

## Wochenübersicht

Im Tagebuch und in den Tageskarten der Woche kannst du „Tag vollständig“ markieren oder die Markierung wieder entfernen. Der Status bleibt bei späteren Eintragsänderungen bestehen, bis du ihn selbst änderst. Die Markierungen werden lokal gespeichert und in JSON-Sicherungen exportiert; ältere Sicherungen ohne dieses Feld lassen vorhandene Markierungen unverändert, eine enthaltene leere Liste entfernt sie.

„Nur vollständige Tage im Nährwertdurchschnitt“ berücksichtigt ausschließlich markierte Tage mit Lebensmitteln, auch beim Vergleich zur Vorwoche. Ohne passende Tage erscheint „—“ statt 0. Unvollständige Ballaststoffangaben werden nur für die berücksichtigten Tage geprüft. Tageswerte, Diagramme, Gewicht, Trinkmengen und CSV-Auswertungen bleiben unabhängig vom Filter. Standardmäßig zählen weiterhin alle Tage mit Lebensmitteln; die Filterauswahl wird auf diesem Gerät für den nächsten Besuch gespeichert.

Die Tageskarten zeigen zunächst Kalorien, Eiweiß, Trinkmenge und Gewicht. „Weitere Nährwerte“ klappt Kohlenhydrate, Fett und Ballaststoffe für den jeweiligen Tag auf; der Bereich ist beim Öffnen der Wochenübersicht geschlossen. Fehlende Angaben bleiben als „—“ sichtbar, unvollständige Ballaststoffwerte werden weiterhin gekennzeichnet. Tagesnotizen lassen sich unabhängig davon öffnen, und ein Klick auf das Datum führt ins Tagebuch.

Über „Woche“ öffnest du eine Übersicht von Montag bis Sonntag. Die Pfeile wechseln die Woche; über ein Datum kannst du direkt zu einer anderen Kalenderwoche springen. Tagesbalken und Datumsüberschriften öffnen den jeweiligen Tag im Tagebuch.

Bei Tagen mit gespeicherter Tagesnotiz erscheint neben dem Datum ein Notizsymbol. Es klappt Hunger, Energie, Training und eigene Beobachtungen direkt in der Tageskarte auf und scrollt zur Notiz. Leere Felder zeigen „Nicht notiert“. Die Ansicht startet eingeklappt und funktioniert auch für Tage ohne Lebensmittel, Gewicht oder Getränke. Bearbeitet werden Notizen weiterhin im Tagebuch; Änderungen, Löschen und Rückgängig werden in der Wochenübersicht berücksichtigt. Notizen verändern keine Nährwert-Durchschnitte.

Die Übersicht zeigt tägliche Kalorien und Nährwerte, Gewichtsmessungen, Trinkmengen, Durchschnittswerte sowie den Unterschied zur Vorwoche. Nährwert-Durchschnitte verwenden nur Tage mit Lebensmitteln, Gewichtsdurchschnitte nur tatsächliche Messungen und Trinkmengen-Durchschnitte nur Tage mit mindestens einem Getränk. Mehrere Getränke desselben Tages werden zuerst summiert. Fehlende Daten erscheinen als „—“; ohne den Filter für vollständige Tage zählen auch teilweise erfasste Tage mit.

Für Getränke stehen Tageswerte, Wochensumme und Tagesdurchschnitt in Litern zur Verfügung, einschließlich Vorwochenvergleich. Auch Tage mit ausschließlich Getränken werden berücksichtigt. Der Tagesvergleich lässt sich zwischen Kalorien, Eiweiß, Kohlenhydraten, Fett, Ballaststoffen und Trinkmenge umschalten. Eingestellte Nährwertziele erscheinen als gestrichelte Linie; für Trinkmengen wird kein Ziel vorgegeben. Änderungen und Rückgängig aktualisieren die Auswertung.

## Eigene Rezepte

In der Zutatensuche bietet „Lebensmittel anlegen“ das Anlegen eines fehlenden Produkts an, auch bei einer leeren Ergebnisliste. Der Suchtext wird als Name vorgeschlagen. Das Rezept mit allen Eingaben bleibt währenddessen erhalten. „Speichern und zum Rezept“ speichert das Lebensmittel in der Produktliste, wählt es als neue Zutat aus und führt zur leeren Mengeneingabe zurück. Erst „Zutat hinzufügen“ übernimmt die gewünschte Menge ins Rezept. Beim Abbrechen bleiben die bisherigen Rezeptangaben und eine zuvor ausgewählte Zutat samt Menge erhalten. Ungespeicherte Produkteingaben sind separat geschützt. Ein bereits gespeichertes neues Lebensmittel bleibt in der Produktliste, auch wenn das Rezept anschließend verworfen wird.

Bei gespeicherten Rezepten öffnet „Als Kopie bearbeiten“ eine unabhängige Variante im Rezeptformular. Zutaten mit ihren gespeicherten Nährwerten, Mengen, Einheiten und Portionsgrößen sowie Portionsanzahl, Fertiggewicht und Zubereitungsnotizen werden übernommen. Der Name erhält zunächst „(Kopie)“ und kann geändert werden. Erst „Kopie speichern“ legt das neue Rezept an; Abbrechen legt nichts an. Das Original und bestehende Tagebucheinträge bleiben unverändert. Die Kopie erhält neue Rezept- und Zutaten-IDs; Favoritenmarkierung, Barcode und Produktimport-Kennzeichnung werden nicht übernommen.

Unter „Produkte“ kannst du über „Neues Rezept“ Zutaten aus deiner Lebensmittelliste zusammenstellen. Mengen lassen sich in den für das Produkt konfigurierten Einheiten angeben. Lege die Anzahl der Portionen fest; Nährwerte für das gesamte Gericht und pro Portion werden automatisch berechnet, einschließlich Ballaststoffen und Zucker.

Die Zutatenauswahl steht vor der Zutatenliste. Nach der Auswahl eines Lebensmittels springt der Fokus zur zunächst leeren Menge; „Zutat hinzufügen“ oder Enter übernimmt sie und führt zur Auswahl für die nächste Zutat zurück. Bereits hinzugefügte Zutaten erscheinen als kompakte, aufklappbare Karten mit Menge und Kalorien. Beim Wechsel der Einheit bleibt das tatsächliche Gewicht erhalten; die Auswahl einer anderen Portionsgröße verändert dagegen das Gewicht bei gleicher Portionsanzahl. Eine ausgewählte, noch nicht hinzugefügte Zutat muss vor dem Speichern hinzugefügt oder verworfen werden.

Titel und Speichern bleiben beim Scrollen sichtbar. Die Fußzeile zeigt die berechneten Kalorien und das Gewicht pro Portion. Fertiggewicht und Zubereitungsnotizen sind aufklappbar; beim Bearbeiten öffnen sie sich, wenn eigene Angaben vorhanden sind. Ungültige Angaben werden direkt am Feld markiert und beim Speicherversuch sichtbar gemacht.

Ohne eigenes Gesamtgewicht folgt das Rezept der Summe seiner Zutatengewichte. Wenn das Gericht beim Kochen Wasser verliert oder aufnimmt, kannst du stattdessen das gewogene Fertiggewicht angeben. Die Nährwerte des ganzen Rezepts bleiben dabei gleich. Die Wahl zwischen automatischem und eigenem Gewicht bleibt beim Bearbeiten erhalten.

Gespeicherte Rezepte findest du über den Filter „Rezepte“ sowie in der Lebensmittelauswahl des Tagebuchs. Mit der Einheit „Portion“ lassen sich auch halbe oder mehrere Portionen eintragen. Rezepte können favorisiert, bearbeitet, gelöscht und per „Rückgängig“ wiederhergestellt werden. Zutatenwerte werden beim Hinzufügen übernommen; spätere Produkt- oder Rezeptänderungen verändern bestehende Tagebucheinträge nicht.

Rezepte samt Zutaten und Zubereitungsnotizen sind Teil der Produkte in der Datensicherung. Ein Import ersetzt daher auch vorhandene Rezepte.

## Letzter Sicherungsexport

Die Datensicherungsseite zeigt den letzten erfassten Export mit deutschem Datum und Uhrzeit für Europe/Ljubljana. Ohne erfassten Export erscheint „Noch kein Export erfasst“. Der Zeitpunkt wird nach dem Start eines Sicherungsdownloads in diesem Browser gespeichert und bleibt nach einem Neuladen erhalten. Der Browser kann das endgültige Speichern oder Abbrechen des Downloads nicht bestätigen.

Der Exportverlauf ist geräte- und browserspezifisch. Er wird nicht in die Sicherungsdatei aufgenommen und bei einem Import nicht überschrieben. Exporte vor Einführung dieser Anzeige können nicht nachträglich erkannt werden.

## Vorlagen, Einkaufsliste und Wochenplanung

Die Einkaufsliste zeigt offene Zutaten zuerst. „Gekauft“ ist beim Öffnen eingeklappt; darin kannst du Häkchen wieder entfernen, um Zutaten zurück zu den offenen Einkäufen zu verschieben. Sind alle Zutaten abgehakt, erscheint „Alles eingekauft.“. „Liste kopieren“ kopiert offene und gekaufte Zutaten mit `[ ]`/`[x]`, Mengen und Marken als deutschen Text. Falls die Zwischenablage nicht verfügbar ist oder der Zugriff abgelehnt wird, erscheint ein markierbares Textfeld zum manuellen Kopieren. Die Aktion ändert keine Mengen oder Häkchen. Leeren und Rückgängig funktionieren weiterhin für die gesamte Liste.

Unter „Planen“ gibt es drei Bereiche:

- **Vorlagen:** Speichere im Tagebuch eine ganze Mahlzeit über „Als Vorlage speichern“. Eine Vorlage kann mit einem Mengenfaktor (z. B. 0,5 oder 2) an einem Datum und einer Mahlzeit ins Tagebuch übernommen oder für den Wochenplan verwendet werden. Vorlagen behalten die gespeicherten Mengen und Nährwerte, auch wenn Produkte später geändert oder gelöscht werden.
- **Einkaufsliste:** Rezepte mit der benötigten Portionsanzahl auswählen und daraus eine Liste erstellen oder bestehende Mengen ergänzen. Gleiche Produkte werden anhand ihrer Produkt-ID in Gramm zusammengeführt. Abgehakte Zutaten bleiben nach einem Neuladen erhalten; zusätzliche Mengen setzen betroffene Häkchen zurück. Unterrezepte werden als eigene Zutat aufgeführt. Das Leeren der Liste lässt sich über „Rückgängig“ zurücknehmen.
- **Wochenplan:** Lebensmittel, Rezepte oder Vorlagen für einen Tag und eine Mahlzeit vormerken, bearbeiten oder löschen. Geplante Mahlzeiten zählen erst nach „Ins Tagebuch übernehmen“ zu den erfassten Tages- und Wochenwerten. Eine Planung kann nur einmal übernommen werden. Einträge im Tagebuch bleiben beim Löschen der Planung erhalten. Die Einkaufsliste aus einer Planungswoche berücksichtigt nur noch offene Planungen.

Über „Anderer Tag“ an einer noch offenen Planung lässt sich das Datum direkt in einer kleinen Datumsauswahl ändern. „Verschieben“ ist erst bei einem gültigen anderen Datum aktiv. Der vorhandene Plan behält seine ID, Mahlzeit, Zutaten, Mengen, Notizen und gespeicherten Produktwerte. Nach dem Speichern wird die Zielwoche geöffnet und die verschobene Mahlzeit sichtbar gemacht und fokussiert. Andere Planungen am Ziel bleiben erhalten. Bereits ins Tagebuch übernommene Planungen werden nicht verschoben; Tagebucheinträge bleiben unverändert.

Ungespeicherte Datumsänderungen sind beim Schließen sowie beim Wechsel der Woche, des Planungsbereichs oder zum vollständigen Bearbeitungsformular geschützt. Bei einem Speicherfehler bleiben Formular und ursprüngliche Planung erhalten. Zwischenzeitlich übernommene oder bereits verschobene Planungen werden nicht überschrieben. Eine vorhandene Einkaufsliste bleibt unverändert; beim erneuten Erstellen einer Liste aus dem Wochenplan wird die neue Zuordnung zur Planungswoche verwendet. Die Datumsauswahl liegt in `src/components/PlanDateForm.tsx`, die atomare Speicherung in `reschedulePlan` in `src/planningDb.ts`.

Datensicherungen ab Version 4 enthalten Vorlagen, Wochenpläne und Einkaufslisten inklusive Häkchen. Beim Import der Versionen 1–3 bleiben vorhandene Planungsdaten erhalten. Ungültige Sicherungen werden vor dem Ersetzen der Daten abgewiesen. Der gerätespezifische letzte Exportzeitpunkt bleibt weiterhin lokal.

## Notizen pro Tag

Im Tagebuch gibt es für das gewählte Datum den einklappbaren Bereich „Tagesnotizen“. Hunger, Energie, Training und eigene Beobachtungen sind freie, optionale Textfelder. Mit „Notiz speichern“ werden die Angaben für diesen Tag gesichert. Ungespeicherte Änderungen sind im Formular gekennzeichnet und bleiben beim Einklappen erhalten; vor einem Datums- oder Seitenwechsel bitte speichern.

Vorhandene Notizen lassen sich bearbeiten oder löschen. „Rückgängig“ stellt gelöschte Notizen wieder her, solange kein neuerer Datensatz oder Datenimport dazwischenliegt. Neue Datensicherungen (Version 5) enthalten alle gespeicherten Tagesnotizen. Ältere Sicherungen (Versionen 1–4) lassen vorhandene Notizen beim Import unverändert.

## CSV-Auswertung

Unter „Datensicherung“ kann zwischen Tages- und Wochenwerten gewählt werden. „CSV-Tageswerte herunterladen“ erstellt eine Zeile pro erfasstem Tag mit Datum, Anzahl der Lebensmitteleinträge, Kalorien, Eiweiß, Kohlenhydraten, Fett, Ballaststoffen, Zucker, Gewicht und Trinkmenge in ml. Auch Tage mit ausschließlich Getränken sind enthalten. Der Zeitraum lässt sich optional eingrenzen; ohne Grenzen werden alle vorhandenen Werte exportiert.

„CSV-Wochenwerte herunterladen“ erstellt eine Zeile pro Kalenderwoche mit Daten. Enthalten sind Wochenbeginn und -ende, die tatsächlich ausgewerteten Datumsgrenzen, Nährwertdurchschnitte, durchschnittliches Gewicht, erfasste Tage/Messungen sowie die gesamte und durchschnittliche Trinkmenge in ml. Der Nenner wird je Bereich getrennt ermittelt: Ernährungstage, Gewichtsmessungen bzw. Tage mit Getränken. Bei begrenztem Zeitraum verwenden auch die Wochenwerte ausschließlich Tage innerhalb dieser Grenzen.

Die Dateien verwenden UTF-8 mit BOM, Semikolon als Trennzeichen und das deutsche Dezimalkomma. Fehlende Nährwert-, Gewichts- oder Trinkdaten bleiben leer. Fehlende Daten werden nicht als Null gewertet; tatsächlich erfasste Nährwerte von null bleiben null. Geplante Mahlzeiten zählen erst nach der Übernahme ins Tagebuch. Die Nährwerte stammen aus den gespeicherten Tagebucheinträgen.

CSV dient der eigenen Auswertung. Für eine Wiederherstellung weiterhin JSON exportieren; der CSV-Download verändert den letzten Sicherungszeitpunkt nicht.

Beim Bearbeiten eines Tagebucheintrags wird der Editor automatisch ins Sichtfeld gescrollt und seine Überschrift fokussiert, auch bei Einträgen weit unten auf der Seite.

## Code finden

- `src/main.tsx`: React-Einstiegspunkt.
- `src/components/MealFilter.tsx` und `DailyExtras.tsx`: feste Mahlzeitenleiste mit Eintragszahlen und einklappbare weitere Tagesdaten.
- `src/hooks/useScrollReveal.ts`: gemeinsames Scrollverhalten beim Öffnen von React-Abschnitten und nativen Detailbereichen.
- `src/unsaved.ts` und `src/components/UnsavedChangesProvider.tsx`: zentrale Entwurfsregistrierung, gezielte Wechselprüfung und Browserwarnung; `useDraftGuard` markiert gespeicherte Formulare wieder als unverändert.
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
- `src/hooks/useNutritionData.ts`: Laden und Speichern der eigenen Lebensmittel und Tagebucheinträge.
- `src/nutrition.ts`: Einheiten, Umrechnung, Nährwertberechnung und Validierung.
- `src/goals.ts`: Tagesziele, Validierung und Fortschrittsberechnung.
- `src/components/DailySummary.tsx` und `GoalEditor.tsx`: Tagesbilanz, Fortschrittsbalken und Zieleingabe.
- `src/hooks/useDailyGoals.ts`: Laden und Speichern der Tagesziele.
- `src/week.ts`: Kalenderwochen, Tages- und Wochensummen sowie Durchschnittswerte.
- `src/recipes.ts`: Rezeptdaten, Zutatenvalidierung und Nährwert-/Portionsberechnung.
- `src/components/RecipeEditor.tsx` und `RecipeIngredients.tsx`: Rezepte und Zutaten bearbeiten.
- `src/components/WeeklyPage.tsx`, `WeeklyDayCard.tsx` und `WeeklyNutritionChart.tsx`: Wochenübersicht, Tageskarten mit aufklappbaren Tagesnotizen und Tagesvergleich.
- `src/hooks/useWeekData.ts`: Zeitraumabfragen und Aktualisierung der Wochenansicht.
- `src/weight.ts`: Gewichtsdaten, Datumsprüfung, Vergleich und Zeiträume.
- `src/components/WeightTracker.tsx`, `WeightEntryForm.tsx` und `WeightChart.tsx`: kompakte Gewichtskarte, direkte Gewichtseingabe und separater Verlauf.
- `src/hooks/useWeightData.ts`: Laden und Speichern der Gewichtsmessungen.
- `src/db.ts`: Datenmodelle, IndexedDB und Backup-Import/Export.

Prüfen: `npm test` und `npm run build`.

## Daten

- Produkte und Tagebucheinträge werden automatisch in **IndexedDB** gespeichert.
- Der JSON-Export enthält alle Produkte und alle Tagebucheinträge, auch von anderen Tagen.
- **Import ersetzt die enthaltenen Daten** nach einer Sicherheitsabfrage; ältere Sicherungen erhalten Gewichtswerte und Ziele, die ihr Format noch nicht unterstützt.
- Browserdaten löschen, private Tabs oder ein anderes Gerät können zu einem leeren Datenbestand führen. Regelmäßig JSON-Backups erstellen.
- Einträge speichern einen Snapshot der Nährwerte. Änderungen an einem Produkt verändern alte Tagebucheinträge nicht.
- Neue Installationen starten ohne vorgegebene Lebensmittel. Lebensmittel selbst anlegen oder aus einer JSON-Sicherung importieren. Vorhandene gespeicherte Lebensmittel bleiben beim Update erhalten; gelöschte Produkte werden nicht automatisch neu angelegt.

## Hinweis zur PWA

Die App kann nach dem ersten Online-Besuch offline funktionieren. Browserabhängig können für die vollständige Installierbarkeit PNG-Icons erforderlich sein; SVG-Icons sind bereits enthalten.
