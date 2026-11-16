import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Camera, FileImage, Search, X} from 'lucide-react';
import type {Food} from '../db';
import {barcodeKey, cleanBarcode, validBarcode} from '../barcode';
import {blankImport, lookupProduct, type ImportedProduct} from '../productImport';
import {parseLabelNutrition} from '../labelNutrition';
import {nutrientKeys} from '../foodValues';
import {germanError} from '../german';
import {useToast} from './ToastProvider';
import {useDraftGuard} from './UnsavedChangesProvider';
import {useImportDialog} from '../hooks/useImportDialog';
import BarcodeCamera from './BarcodeCamera';
import FoodEditor from './FoodEditor';
import './ProductImport.css';

type Props = {foods: Food[]; onSave: (food: Food) => Promise<void>; onSelect?: (food: Food) => void; onClose: () => void};

function ImportChooser({foods, onSelect, onClose, onReview}: Omit<Props, 'onSave'> & {onReview: (product: ImportedProduct, existing?: boolean) => void}) {
  const [barcode,setBarcode] = useState('');
  const [camera,setCamera] = useState(false);
  const [busy,setBusy] = useState<'lookup' | 'photo' | null>(null);
  const [error,setError] = useState('');
  const [notFound,setNotFound] = useState(false);
  const [existing,setExisting] = useState<Food>();
  const [photo,setPhoto] = useState<string>();
  const [text,setText] = useState('');
  const [column,setColumn] = useState(0);
  const [progress,setProgress] = useState(0);
  const operation = useRef<AbortController | undefined>(undefined);
  const alive = useRef(true);
  const notify = useToast();
  const guard = useDraftGuard('Produktimport', {barcode,text,photo}, false, 'product-import');
  const close = () => {if (guard.confirmLeave()) onClose();};
  const dialog = useImportDialog(close);
  useEffect(() => {alive.current=true;return () => {alive.current=false;operation.current?.abort();};}, []);
  useEffect(() => () => {if(photo) URL.revokeObjectURL(photo);}, [photo]);
  const fail = (message: string) => {setError(message);notify(message,'error');};
  const review = (product: ImportedProduct, local = false) => {guard.markSaved();onReview(product,local);};

  async function lookup(raw: string) {
    operation.current?.abort();
    setCamera(false);setError('');setExisting(undefined);setNotFound(false);
    const code = cleanBarcode(raw);setBarcode(code);
    if (!validBarcode(code)) {fail('Bitte einen gültigen EAN-/UPC-Barcode mit 8, 12, 13 oder 14 Ziffern eingeben.');return;}
    const local = foods.find(food => food.barcode && barcodeKey(food.barcode) === barcodeKey(code));
    if (local) {setBusy(null);setExisting(local);return;}
    const controller = new AbortController();operation.current=controller;setBusy('lookup');
    try {
      const product = await lookupProduct(code,controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (product) review(product); else {setNotFound(true);notify('Kein Produkt gefunden. Du kannst es manuell oder mit einem Foto anlegen.','error');}
    } catch(error) {if(alive.current && !controller.signal.aborted) fail(germanError(error));}
    finally {if(alive.current && operation.current === controller) setBusy(null);}
  }

  async function readPhoto(file?: File) {
    if (!file) return;
    operation.current?.abort();setCamera(false);setError('');setText('');setProgress(0);setColumn(0);setExisting(undefined);setNotFound(false);
    const controller = new AbortController();operation.current=controller;setBusy('photo');
    try {
      const {validLabelImage,recognizeLabel} = await import('../labelRecognition');
      if (!alive.current || controller.signal.aborted) return;
      validLabelImage(file);setPhoto(URL.createObjectURL(file));
      const result = await recognizeLabel(file,controller.signal,value => {if(alive.current) setProgress(value);});
      if (!alive.current || controller.signal.aborted) return;
      if (!result.trim()) throw Error('Keine Schrift erkannt. Bitte ein schärferes Foto der Nährwerttabelle versuchen.');
      setText(result);notify('Text erkannt. Bitte die Werte und die passende Spalte prüfen.','success');
    } catch(error) {if(alive.current && !controller.signal.aborted) fail(error instanceof Error && error.message.startsWith('Bitte') ? error.message : error instanceof Error && /Foto|Erkennung|groß|Texterkennung/.test(error.message) ? error.message : 'Das Foto konnte nicht gelesen werden. Bitte ein scharfes Foto wählen und die Internetverbindung für das Laden der Texterkennung prüfen.');}
    finally {if(alive.current && operation.current===controller) setBusy(null);}
  }

  function usePhoto() {
    const parsed = parseLabelNutrition(text,column);
    const food = {...blankImport(validBarcode(cleanBarcode(barcode)) ? cleanBarcode(barcode) : undefined),...parsed.values};
    if (parsed.reference) {
      food.nutritionReference = parsed.reference.unit === 'ml' ? {unit:'ml',amount:100} : parsed.reference;
      if (parsed.reference.unit === 'ml' && parsed.reference.amount !== 100) {
        for (const key of nutrientKeys) if (food[key] !== null) food[key]! *= 100 / parsed.reference.amount;
      } else if (parsed.reference.unit === 'g') food.portionGrams = parsed.reference.amount;
    }
    review({food,missing:nutrientKeys.filter(key => !Number.isFinite(food[key])),warnings:parsed.warnings});
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="product-import-title" ref={dialog} tabIndex={-1}>
    <div className="modal editor product-import"><div className="section-head"><h2 id="product-import-title">Produkt importieren</h2><button type="button" className="iconbtn" aria-label="Produktimport schließen" onClick={close}><X size={18}/></button></div>
      <p className="hint">Barcode scannen oder eingeben. Gefundene Daten kannst du vor dem Speichern anpassen.</p>
      <button type="button" className="secondary wide" disabled={Boolean(busy) || camera} onClick={() => {setError('');setCamera(true);}}><Camera size={18}/>Barcode mit Kamera scannen</button>
      {camera && <BarcodeCamera onCode={code => void lookup(code)} onStop={() => setCamera(false)} onError={message => {setCamera(false);fail(message);}}/>}
      <form onSubmit={event => {event.preventDefault();event.stopPropagation();if (!busy) void lookup(barcode);}}>
        <label>Barcode (EAN / UPC)<input autoComplete="off" inputMode="numeric" value={barcode} disabled={Boolean(busy)} placeholder="z. B. 13 Ziffern unter dem Barcode" onChange={event => {setBarcode(event.target.value);setError('');setExisting(undefined);setNotFound(false);}}/></label>
        <button className="primary wide" disabled={Boolean(busy) || !barcode.trim()}><Search size={17}/>{busy==='lookup' ? 'Produkt wird gesucht…' : 'Produkt suchen'}</button>
      </form>
      {busy && <div role="status"><p className="hint">{busy==='photo' ? `Foto wird gelesen… ${progress} %` : 'Produktdaten werden geladen…'}</p><button type="button" className="secondary" onClick={() => {operation.current?.abort();setBusy(null);}}>Abbrechen</button></div>}
      {error && <p className="product-import__error" role="alert">{error}</p>}
      {existing && <section className="product-import__result" aria-label="Gespeichertes Produkt"><h3>{existing.name}</h3><p className="hint">Bereits gespeichert. Deine eigenen Werte und Korrekturen werden verwendet.</p>
        {onSelect && <button type="button" className="primary wide" onClick={() => {guard.markSaved();onSelect(existing);onClose();}}>Für Eintrag auswählen</button>}
        <button type="button" className="secondary wide" onClick={() => review({food:existing,missing:[],warnings:[]},true)}>Produkt bearbeiten</button></section>}
      {notFound && <p className="hint" role="status">Kein Produkt zu diesem Barcode gefunden. Manuell anlegen oder ein Foto der Nährwerttabelle verwenden.</p>}
      <section className="product-import__photo"><h3>Nährwerttabelle aus Foto</h3><p className="hint">Ein gerades, gut beleuchtetes Foto der Tabelle wählen. Die Texterkennung läuft auf deinem Gerät; das Foto wird nicht hochgeladen. Beim ersten Mal werden Erkennungsdateien aus dem Internet geladen.</p>
        <label className="secondary product-import__file"><FileImage size={18}/>Foto aufnehmen oder auswählen<input type="file" aria-label="Foto der Nährwerttabelle" accept="image/jpeg,image/png,image/webp,image/bmp" disabled={Boolean(busy)} onChange={event => {void readPhoto(event.target.files?.[0]);event.target.value='';}}/></label>
        {photo && <img className="product-import__image" src={photo} alt="Ausgewählte Nährwerttabelle"/>}
        {text && <><label>Erkannter Text<textarea aria-label="Erkannter Text" rows={7} value={text} onChange={event => setText(event.target.value)}/></label>
          <label>Wertespalte<select aria-label="Wertespalte" value={column} onChange={event => setColumn(Number(event.target.value))}><option value={0}>Erste Wertespalte</option><option value={1}>Zweite Wertespalte</option></select></label>
          <p className="hint">Bei mehreren Spalten die gewünschte wählen und anschließend die Bezugsmenge prüfen. Fehlende Werte bleiben leer.</p>
          <button type="button" className="primary wide" onClick={usePhoto}>Erkannte Werte prüfen</button></>}
      </section>
      <button type="button" className="secondary wide" disabled={Boolean(busy)} onClick={() => review({food:blankImport(validBarcode(cleanBarcode(barcode)) ? cleanBarcode(barcode) : undefined),missing:[...nutrientKeys],warnings:['Bitte die Angaben von der Verpackung übernehmen.']})}>Manuell anlegen</button>
      <p className="hint product-import__attribution">Produktdaten: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>. Die Barcode-Abfrage benötigt Internet; gespeicherte Produkte sind auch offline verfügbar.</p>
    </div>
  </div>;
}

export default function ProductImport({foods,onSave,onSelect,onClose}: Props) {
  const [review,setReview] = useState<{product: ImportedProduct;existing: boolean}>();
  return createPortal(review ? <FoodEditor key={review.product.food.id} food={review.product.food} existing={review.existing}
    importReview={review.existing ? undefined : review.product} onClose={onClose}
    onSave={async food => {await onSave(food);onClose();}}
    onSaveAndUse={onSelect ? async food => {await onSave(food);onSelect(food);onClose();} : undefined}/>
    : <ImportChooser foods={foods} onSelect={onSelect} onClose={onClose} onReview={(product,existing=false) => setReview({product,existing})}/>, document.body);
}
