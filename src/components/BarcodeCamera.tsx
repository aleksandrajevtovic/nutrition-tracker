import {useEffect, useRef, useState} from 'react';
import {validBarcode} from '../barcode';

export default function BarcodeCamera({onCode, onStop, onError}: {onCode: (code: string) => void; onStop: () => void; onError: (message: string) => void}) {
  const video = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({onCode, onError});callbacks.current = {onCode,onError};
  const [ready,setReady] = useState(false);
  useEffect(() => {
    let active = true; let stream: MediaStream | undefined; let controls: {stop: () => void} | undefined;
    const stop = () => {controls?.stop();stream?.getTracks().forEach(track => track.stop());};
    void (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error('Die Kamera benötigt HTTPS und einen Browser mit Kamerazugriff. Du kannst den Barcode auch eintippen.');
        const {BrowserMultiFormatOneDReader} = await import('@zxing/browser');
        if (!active) return;
        stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
        if (!active) {stop();return;}
        const reader = new BrowserMultiFormatOneDReader();
        controls = await reader.decodeFromStream(stream,video.current!, (result, _error, scanner) => {
          if (!active || !result || !validBarcode(result.getText())) return;
          active = false;scanner.stop();stop();callbacks.current.onCode(result.getText());
        });
        if (!active) stop(); else setReady(true);
      } catch(error) {
        stop();
        if (!active) return;
        const name = error instanceof Error ? error.name : '';
        callbacks.current.onError(name === 'NotAllowedError' ? 'Kamerazugriff wurde nicht erlaubt. Bitte die Berechtigung prüfen oder den Barcode eintippen.'
          : name === 'NotFoundError' ? 'Keine Kamera gefunden. Bitte den Barcode eintippen.'
          : name === 'NotReadableError' ? 'Die Kamera ist gerade nicht verfügbar. Bitte andere Kamera-Anwendungen schließen oder den Barcode eintippen.'
          : error instanceof Error && error.message.startsWith('Die Kamera benötigt') ? error.message : 'Die Kamera konnte nicht gestartet werden. Bitte den Barcode eintippen.');
      }
    })();
    return () => {active=false;stop();};
  }, []);
  return <section className="barcode-camera" aria-label="Barcode-Kamera"><video ref={video} muted playsInline autoPlay aria-label="Kameravorschau"/>
    <p className="hint" role="status">{ready ? 'Den gesamten Barcode ruhig und gut beleuchtet vor die Kamera halten.' : 'Kamera wird gestartet…'}</p>
    <button type="button" className="secondary wide" onClick={onStop}>Kamera ausschalten</button></section>;
}
