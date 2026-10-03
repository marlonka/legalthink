import { lazy, Suspense, useRef, useState } from 'react';
import { LoaderCircle, Upload } from 'lucide-react';
import { api, type DocumentRecord } from './types';
import './source-preview.css';

const PdfPreview = lazy(() => import('./PdfPreview'));
const WordPreview = lazy(() => import('./WordPreview'));
const TextPreview = lazy(() => import('./TextPreview'));

export function SourceFile({
  document,
  quote,
  location,
  onUpdated,
  onClose,
}: {
  document: DocumentRecord;
  quote: string;
  location: string;
  onUpdated: (document: DocumentRecord) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [textOnly, setTextOnly] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const extension = document.name.toLowerCase().split('.').pop();
  const rich = extension === 'pdf' || extension === 'docx';
  const page = Number(/(?:^| · )Seite (\d+)\b/.exec(location)?.[1] ?? 1);
  async function attach(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      onUpdated(
        await api<DocumentRecord>(`/documents/${document.id}/original`, {
          method: 'PUT',
          body: form,
        }),
      );
      setTextOnly(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Datei konnte nicht zugeordnet werden.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  return (
    <div className="source-viewer">
      {rich && (
        <div className="source-viewer-mode">
          {document.original_available ? (
            <div role="group" aria-label="Dokumentdarstellung">
              <button aria-pressed={!textOnly} onClick={() => setTextOnly(false)}>
                Dokument
              </button>
              <button aria-pressed={textOnly} onClick={() => setTextOnly(true)}>
                Ausgelesener Text
              </button>
            </div>
          ) : (
            <>
              <span>Nur ausgelesener Text gespeichert</span>
              <input
                hidden
                type="file"
                accept={`.${extension}`}
                ref={input}
                onChange={(event) => void attach(event.target.files?.[0])}
              />
              <button
                className="text-button"
                onClick={() => input.current?.click()}
                disabled={busy}
              >
                {busy ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />} Datei
                hinzufügen
              </button>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <Suspense
        fallback={
          <div className="preview-loading" role="status">
            Dokument wird geöffnet …
          </div>
        }
      >
        {document.original_available && !textOnly && extension === 'pdf' ? (
          <PdfPreview documentId={document.id} initialPage={page} quote={quote} />
        ) : document.original_available && !textOnly && extension === 'docx' ? (
          <WordPreview document={document} quote={quote} onEscape={onClose} />
        ) : (
          <TextPreview
            document={document}
            quote={quote}
            original={!rich && Boolean(document.original_available)}
            markdown={extension === 'md' && !textOnly}
          />
        )}
      </Suspense>
    </div>
  );
}
