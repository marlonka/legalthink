import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, FileText, Maximize2, Minimize2, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { DocumentRecord } from './types';
import { SourceFile } from './SourceFile';
import { MotionButton, useMotionPreferences } from './motion';
import './document-preview.css';

export type PreviewRequest = {
  source_document_id: string;
  source_document_name?: string;
  source_quote?: string;
  source_location?: string;
  verified?: boolean;
  role?: string;
};
const PreviewContext = createContext<{ openPreview: (source: PreviewRequest) => void }>({
  openPreview: () => {},
});
export const useDocumentPreview = () => useContext(PreviewContext);

export function DocumentPreviewProvider({
  documents,
  onUpdated,
  children,
}: {
  documents: DocumentRecord[];
  onUpdated: (document: DocumentRecord) => void;
  children: ReactNode;
}) {
  const [source, setSource] = useState<PreviewRequest | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1400px)').matches);
  const trigger = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const canDock = wide && window.location.hash.startsWith('#analysis/');
  const modal = expanded || !canDock;
  const { reduced, transition } = useMotionPreferences();
  const file = documents.find((item) => item.id === source?.source_document_id);

  function openPreview(next: PreviewRequest) {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSource(next);
  }
  function close() {
    setSource(null);
    setExpanded(false);
  }
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1400px)');
    const change = () => setWide(query.matches);
    query.addEventListener('change', change);
    window.addEventListener('hashchange', close);
    return () => {
      query.removeEventListener('change', change);
      window.removeEventListener('hashchange', close);
    };
  }, []);
  useLayoutEffect(() => {
    const main = document.getElementById('main-content');
    const anchor =
      trigger.current?.isConnected && main?.contains(trigger.current) ? trigger.current : null;
    const top = anchor?.getBoundingClientRect().top;
    document.documentElement.dataset.documentPreview = source ? (modal ? 'full' : 'docked') : '';
    if (main && anchor && top !== undefined)
      main.scrollTop += anchor.getBoundingClientRect().top - top;
    const element = dialog.current;
    if (!element) return;
    // Keep the renderer mounted when changing between dock and full-screen view.
    if (element.open) element.close();
    if (source) {
      if (modal) element.showModal();
      else element.show();
      closeButton.current?.focus({ preventScroll: true });
    } else if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  }, [Boolean(source), modal]);
  useEffect(
    () => () => {
      delete document.documentElement.dataset.documentPreview;
    },
    [],
  );
  useEffect(() => {
    if (!source || modal) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[data-modal-portal]')) {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [Boolean(source), modal]);
  const title = file?.name || source?.source_document_name || 'Quelle nicht verfügbar';
  return (
    <PreviewContext.Provider value={{ openPreview }}>
      {children}
      {createPortal(
        <dialog
          ref={dialog}
          className={`document-preview-dialog ${modal ? 'is-full' : 'is-docked'}`}
          aria-label={`Dokumentvorschau: ${title}`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          {source && (
            <motion.div
              className="document-preview-surface"
              initial={reduced ? false : { x: '100%' }}
              animate={{ x: 0 }}
              transition={transition('panel')}
            >
              <header className="document-preview-header">
                <FileText size={18} aria-hidden="true" />
                <div className="document-preview-title">
                  <strong title={title}>{title}</strong>
                  {source.role && <span>{source.role}</span>}
                </div>
                {file && (
                  <a
                    className="icon-button"
                    href={`/api/documents/${file.id}/${file.original_available ? 'original' : 'text'}`}
                    download
                    aria-label={`${file.original_available ? 'Original' : 'Text'} herunterladen`}
                    title="Herunterladen"
                  >
                    <ArrowDownToLine size={18} />
                  </a>
                )}
                {canDock && (
                  <MotionButton
                    className="icon-button"
                    onClick={() => setExpanded(!expanded)}
                    aria-label={expanded ? 'Geteilte Ansicht' : 'Vorschau vergrößern'}
                    title={expanded ? 'Geteilte Ansicht' : 'Vergrößern'}
                  >
                    {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </MotionButton>
                )}
                <MotionButton
                  ref={closeButton}
                  className="icon-button"
                  onClick={close}
                  aria-label="Dokumentvorschau schließen"
                  title="Schließen"
                >
                  <X size={19} />
                </MotionButton>
              </header>
              {source.source_quote && (
                <details
                  className="preview-citation"
                  key={`${source.source_document_id}-${source.source_quote}`}
                >
                  <summary title={source.source_location}>
                    {source.verified
                      ? file
                        ? 'Zitat im Dokument gefunden'
                        : 'Zitat bei der Analyse gefunden'
                      : 'Zitat nicht bestätigt'}
                    {source.source_location && ` · ${source.source_location}`}
                  </summary>
                  {source.source_location && <p>{source.source_location}</p>}
                  <blockquote>{source.source_quote}</blockquote>
                  <p>
                    Der Textabgleich bestätigt den Wortlaut, nicht die behaupteten Tatsachen oder
                    die rechtliche Bewertung.
                  </p>
                </details>
              )}
              <div className="document-preview-content">
                {file ? (
                  <SourceFile
                    key={file.id}
                    document={file}
                    quote={source.source_quote ?? ''}
                    location={source.source_location ?? ''}
                    onUpdated={onUpdated}
                    onClose={close}
                  />
                ) : (
                  <div className="preview-unavailable">
                    <p>
                      Die Quelle ist nicht mehr gespeichert oder konnte nicht zugeordnet werden.
                    </p>
                    {source.source_quote && <blockquote>{source.source_quote}</blockquote>}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </dialog>,
        document.body,
      )}
    </PreviewContext.Provider>
  );
}
