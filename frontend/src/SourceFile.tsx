import { lazy, Suspense, useRef, useState } from 'react';
import { ArrowDownToLine, FileText, LoaderCircle, Upload } from 'lucide-react';
import { api, type DocumentRecord } from './types';
import { Modal } from './ui';
import './source-preview.css';

const PdfPreview = lazy(() => import('./PdfPreview'));

export function SourceFile({
  document,
  quote,
  location,
  embedded = false,
  onUpdated,
}: {
  document: DocumentRecord;
  quote: string;
  location: string;
  embedded?: boolean;
  onUpdated: (document: DocumentRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const isPdf = document.name.toLowerCase().endsWith('.pdf');
  const page = Number(/(?:^| · )Seite (\d+)\b/.exec(location)?.[1] ?? 1);
  const preview = (
    <Suspense
      fallback={
        <div className="pdf-loading" role="status">
          PDF wird geöffnet …
        </div>
      }
    >
      <PdfPreview documentId={document.id} initialPage={page} quote={quote} />
    </Suspense>
  );
  async function attach(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await api<DocumentRecord>(`/documents/${document.id}/original`, {
        method: 'PUT',
        body: form,
      });
      onUpdated(updated);
      if (!embedded) setOpen(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'PDF konnte nicht zugeordnet werden.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="source-file-actions">
      <div className="source-downloads">
        {isPdf && document.original_available && !embedded && (
          <button className="text-button" onClick={() => setOpen(true)}>
            <FileText size={15} /> PDF ansehen
          </button>
        )}
        {isPdf && document.original_available && (
          <a className="text-button" href={`/api/documents/${document.id}/original`} download>
            <ArrowDownToLine size={14} /> PDF herunterladen
          </a>
        )}
        <a className="text-button" href={`/api/documents/${document.id}/text`} download>
          <ArrowDownToLine size={14} /> TXT herunterladen
        </a>
      </div>
      {isPdf && !document.original_available && (
        <div className="source-original-missing">
          <p>Für diesen früheren Upload ist nur der ausgelesene Text gespeichert.</p>
          <input
            hidden
            type="file"
            accept="application/pdf,.pdf"
            ref={input}
            onChange={(event) => void attach(event.target.files?.[0])}
          />
          <button className="text-button" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />} Original-PDF
            hinzufügen
          </button>
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {embedded && document.original_available && preview}
      {open && (
        <Modal title={document.name} onClose={() => setOpen(false)} className="source-dialog" wide>
          <div className="modal-body">
            <a className="text-button" href={`/api/documents/${document.id}/original`} download>
              <ArrowDownToLine size={14} /> PDF herunterladen
            </a>
            {preview}
          </div>
        </Modal>
      )}
    </div>
  );
}
