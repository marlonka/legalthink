import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

// Mark the exact matching characters; repeated passages stay unmarked.
function highlightQuote(layer: TextLayer, page: HTMLElement, quote: string) {
  const needle = quote.replace(/\s/g, '');
  if (needle.length < 12) return false;
  let text = '';
  const positions: { node: Text; offset: number }[] = [];
  for (const div of layer.textDivs) {
    const node = div.firstChild;
    if (!(node instanceof Text)) continue;
    for (let offset = 0; offset < node.length; offset++) {
      if (/\s/.test(node.data[offset])) continue;
      text += node.data[offset];
      positions.push({ node, offset });
    }
  }
  const index = text.indexOf(needle);
  if (index < 0 || text.indexOf(needle, index + 1) !== -1) return false;
  const first = positions[index],
    last = positions[index + needle.length - 1];
  const range = document.createRange();
  range.setStart(first.node, first.offset);
  range.setEnd(last.node, last.offset + 1);
  const bounds = page.getBoundingClientRect();
  for (const rect of range.getClientRects()) {
    const mark = document.createElement('div');
    mark.className = 'pdf-quote-mark';
    mark.setAttribute('aria-hidden', 'true');
    Object.assign(mark.style, {
      left: `${rect.left - bounds.left}px`,
      top: `${rect.top - bounds.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    page.appendChild(mark);
  }
  return true;
}

export default function PdfPreview({
  documentId,
  initialPage,
  quote,
}: {
  documentId: string;
  initialPage: number;
  quote: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [zoom, setZoom] = useState('fit');
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlighted, setHighlighted] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setPdf(null);
    setError('');
    setLoading(true);
    const task = getDocument({
      url: `/api/documents/${documentId}/original`,
      enableXfa: false,
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
    });
    void task.promise
      .then((document) => {
        if (!active) return;
        setPdf(document);
        setPage(Math.max(1, Math.min(initialPage, document.numPages)));
      })
      .catch(() => {
        if (active) {
          setError('PDF kann nicht angezeigt werden. Laden Sie das Original herunter.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
      void task.destroy().catch(() => {});
    };
  }, [documentId, initialPage]);

  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => setPageInput(String(page)), [page]);

  useEffect(() => {
    if (!pdf || !width || !paper.current) return;
    let active = true;
    let render: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    const host = paper.current;
    // A fresh canvas per render prevents races when users change page or zoom quickly.
    const sheet = document.createElement('div');
    sheet.className = 'pdf-page';
    host.replaceChildren(sheet);
    setLoading(true);
    setError('');
    setHighlighted(false);
    void (async () => {
      try {
        const source = await pdf.getPage(page);
        if (!active) return;
        const base = source.getViewport({ scale: 1 });
        const scale = zoom === 'fit' ? Math.max(0.1, (width - 24) / base.width) : Number(zoom);
        const view = source.getViewport({ scale });
        sheet.style.width = `${view.width}px`;
        sheet.style.height = `${view.height}px`;
        sheet.style.setProperty('--total-scale-factor', String(scale * source.userUnit));
        const canvas = document.createElement('canvas');
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(view.width * ratio);
        canvas.height = Math.ceil(view.height * ratio);
        canvas.style.width = `${view.width}px`;
        canvas.style.height = `${view.height}px`;
        canvas.setAttribute('aria-hidden', 'true');
        sheet.appendChild(canvas);
        render = source.render({ canvas, viewport: view, transform: [ratio, 0, 0, ratio, 0, 0] });
        await render.promise;
        if (!active) return;
        const text = document.createElement('div');
        text.className = 'pdf-text-layer';
        sheet.appendChild(text);
        textLayer = new TextLayer({
          textContentSource: source.streamTextContent(),
          container: text,
          viewport: view,
        });
        await textLayer.render();
        if (!active) return;
        setHighlighted(highlightQuote(textLayer, sheet, quote));
        const mark = sheet.querySelector<HTMLElement>('.pdf-quote-mark');
        if (viewport.current) {
          viewport.current.scrollTop = mark ? Math.max(0, mark.offsetTop - 64) : 0;
          viewport.current.scrollLeft = 0;
        }
        setLoading(false);
      } catch {
        if (active) {
          setError('Diese PDF-Seite kann nicht angezeigt werden. Laden Sie das Original herunter.');
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      render?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, width, zoom, quote]);

  function goToPage() {
    const next = Number(pageInput);
    if (pdf && Number.isInteger(next) && next >= 1 && next <= pdf.numPages) setPage(next);
    else setPageInput(String(page));
  }
  return (
    <section className="pdf-preview" aria-label="PDF-Vorschau">
      <div className="pdf-toolbar">
        <div className="pdf-pagination">
          <button
            className="icon-button"
            aria-label="Vorherige PDF-Seite"
            disabled={!pdf || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <label>
            Seite{' '}
            <input
              aria-label="PDF-Seite"
              inputMode="numeric"
              value={pageInput}
              disabled={!pdf}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={goToPage}
              onKeyDown={(event) => {
                if (event.key === 'Enter') goToPage();
              }}
            />
          </label>
          <span className="pdf-page-count">/ {pdf?.numPages ?? '–'}</span>
          <button
            className="icon-button"
            aria-label="Nächste PDF-Seite"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <select
          aria-label="PDF-Vergrößerung"
          value={zoom}
          onChange={(event) => setZoom(event.target.value)}
        >
          <option value="fit">Seitenbreite</option>
          <option value="1">100 %</option>
          <option value="1.5">150 %</option>
          <option value="2">200 %</option>
        </select>
      </div>
      <div
        className="pdf-viewport"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label={`PDF-Seite ${page}`}
        aria-busy={loading}
      >
        <div ref={paper} className="pdf-paper-container" />
        {(loading || error) && (
          <div className="pdf-state" role={error ? 'alert' : 'status'}>
            {error || (
              <>
                <LoaderCircle className="spin" size={18} /> PDF wird geladen …
              </>
            )}
          </div>
        )}
      </div>
      <p className="pdf-status" role="status">
        {error
          ? 'Original-Download oberhalb der Vorschau.'
          : loading
            ? 'Seite wird geladen …'
            : highlighted
              ? 'Zitat auf dieser Seite markiert.'
              : quote
                ? 'Auf dieser Seite keine eindeutige Zitatmarkierung.'
                : `Seite ${page} von ${pdf?.numPages}`}
      </p>
    </section>
  );
}
