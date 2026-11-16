import type {Entry, Food} from './db';

// Exact replacements for labels shipped by earlier versions. Custom text stays intact.
const translations: Record<string, string> = {
  'Banana': 'Banane', 'Crvena paprika': 'Rote Paprika',
  'Putenbrust – ćureća prsa': 'Putenbrust', 'Generička procena': 'Allgemeiner Schätzwert',
  'Cherry paradajz': 'Kirschtomaten', 'Avokado': 'Avocado', 'Mladi luk': 'Frühlingszwiebel',
  'Kuvano jaje': 'Gekochtes Ei', 'Hleb': 'Brot', 'Maslinovo ulje': 'Olivenöl',
  '1 kreker': '1 Cracker', '1 kašičica': '1 Teelöffel', '1 manja banana': '1 kleine Banane',
  '½ paprike': '½ Paprika', '1 šnita': '1 Scheibe', '1 komad': '1 Stück',
  '½ avokada': '½ Avocado', '1 jaje': '1 Ei', '1 kriška': '1 Scheibe',
  'Doručak': 'Frühstück', 'Breakfast': 'Frühstück', 'Lunch': 'Mittagessen',
  'Dinner': 'Abendessen', 'Snack': 'Zwischenmahlzeit',
};
const translate = (text: string) => translations[text] ?? text;

export function germanFood(food: Food): Food {
  return {...food, name: translate(food.name), brand: translate(food.brand), portionName: translate(food.portionName)};
}
export function germanEntry(entry: Entry): Entry {
  return {...entry, meal: translate(entry.meal), foodSnapshot: germanFood(entry.foodSnapshot)};
}

const appErrors = new Set([
  'Dieser Eintrag wurde inzwischen geändert. Bitte die Aktion erneut öffnen.',
  'Bitte ein anderes Zieldatum oder eine andere Mahlzeit wählen.',
  'Dieser Barcode gehört bereits zu einem gespeicherten Lebensmittel. Bitte das vorhandene Produkt bearbeiten.',
  'Bitte einen gültigen EAN-/UPC-Barcode mit 8, 12, 13 oder 14 Ziffern eingeben.',
  'Du bist offline. Gespeicherte Produkte sind verfügbar; für neue Produktdaten ist Internet nötig.',
  'Zu viele Produktabfragen. Bitte warte einen Moment und versuche es erneut.',
  'Die Produktdatenbank ist gerade nicht erreichbar. Bitte später erneut versuchen.',
  'Die Produktabfrage hat zu lange gedauert. Bitte erneut versuchen.',
  'Produktdaten konnten nicht geladen werden. Bitte Internetverbindung prüfen oder manuell anlegen.',
  'Ungültige Datei', 'Nicht unterstütztes Sicherungsformat', 'Ungültige Produktdaten',
  'Ungültige Tagebucheinträge', 'Ungültige Mengeneinheit', 'Ungültige Mengenangabe',
  'Ungültige Eintragsnotiz',
  'Ungültige Trinkdaten', 'Bitte Getränk, eine positive Trinkmenge und eine gültige Uhrzeit eingeben.',
  'Dieser Eintrag ist nicht mehr vorhanden.', 'Bitte eine gültige Menge über 0 eingeben.',
  'Ungültige Gewichtsdaten',
  'Ungültige Tagesziele', 'Bitte für Tagesziele positive Zahlen eingeben oder das Feld leer lassen.',
  'Bitte ein gültiges Datum für die Wochenübersicht wählen.',
  'Ungültige Rezeptdaten',
  'Ungültiger Exportzeitpunkt',
  'Bitte einen gültigen Zeitraum für den CSV-Export wählen.', 'Ungültige Daten für den CSV-Export',
  'Ungültige Tagesnotiz', 'Ungültige Tagesnotizen',
  'Ungültige Vorlagen, Einkaufslisten oder Planungsdaten', 'Ungültige Wochenplanung', 'Ungültige Planungsmenge', 'Ungültige Einkaufsmenge',
  'Bitte eine gültige Vorlage und einen positiven Faktor wählen.', 'Bitte mindestens ein Rezept oder eine geplante Mahlzeit wählen.',
  'Bitte einen Namen und eine Mahlzeit mit Einträgen wählen.', 'Diese Vorlage ist nicht mehr vorhanden.',
  'Diese Planung wurde bereits ins Tagebuch übernommen.', 'Diese Planung ist nicht mehr vorhanden.',
  'Die Wiederherstellung ist nach zwischenzeitlichen Änderungen nicht mehr möglich.',
  'Bitte gültige Zutaten, eine positive Portionsanzahl und ein positives Gesamtgewicht eingeben.',
  'Bitte ein gültiges Zieldatum und eine Mahlzeit wählen.', 'Diese Mahlzeit enthält keine Einträge mehr.',
  'Dieses Lebensmittel ist nicht mehr vorhanden.',
  'Nach einem Datenimport ist diese Wiederherstellung nicht mehr möglich.',
  'Es gibt bereits einen neueren Datensatz. Er wurde nicht überschrieben.',
]);
export function germanError(error: unknown): string {
  if (error instanceof SyntaxError) return 'Die Datei enthält keine gültigen JSON-Daten.';
  if (error instanceof Error && appErrors.has(error.message)) return error.message;
  if (error instanceof Error && error.name === 'QuotaExceededError') return 'Der Gerätespeicher ist voll. Bitte Speicherplatz freigeben.';
  if (error instanceof Error && error.name === 'SecurityError') return 'Der Browser erlaubt keinen Zugriff auf den lokalen Speicher. Bitte die Browsereinstellungen prüfen.';
  console.error(error);
  return 'Der Vorgang ist fehlgeschlagen. Bitte erneut versuchen und prüfen, ob der Browser lokalen Speicher erlaubt.';
}
