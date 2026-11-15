// Loaded only after selecting a photo; photos remain on the device.
import workerPath from 'tesseract.js/dist/worker.min.js?url';

export function validLabelImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp'].includes(file.type)) throw Error('Bitte ein Foto als JPG, PNG, WebP oder BMP auswählen.');
  if (file.size > 12 * 1024 * 1024) throw Error('Das Foto ist zu groß. Bitte ein Bild mit höchstens 12 MB wählen.');
}

export async function recognizeLabel(file: File, signal: AbortSignal, progress: (value: number) => void): Promise<string> {
  validLabelImage(file);
  const {createWorker} = await import('tesseract.js');
  signal.throwIfAborted();
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let rejectAbort: (reason: Error) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {rejectAbort = reject;});
  const cancel = () => {void worker?.terminate(); rejectAbort(new DOMException('Abgebrochen', 'AbortError'));};
  signal.addEventListener('abort', cancel, {once: true});
  const timeout = setTimeout(() => {void worker?.terminate(); rejectAbort(Error('Die Texterkennung dauert zu lange. Bitte ein kleineres, schärferes Foto versuchen.'));}, 120000);
  let stopped = false;
  try {
    return await Promise.race([aborted, (async () => {
      const created = await createWorker('deu+eng', 1, {workerPath, errorHandler: () => {}, logger: message => {
        if (!signal.aborted && message.status === 'recognizing text') progress(Math.round(message.progress * 100));
      }});
      if (signal.aborted || stopped) {await created.terminate(); throw new DOMException('Abgebrochen', 'AbortError');}
      worker = created;
      const {data} = await worker.recognize(file);
      return data.text;
    })()]);
  } finally {stopped = true;clearTimeout(timeout);signal.removeEventListener('abort', cancel);await worker?.terminate();}
}
