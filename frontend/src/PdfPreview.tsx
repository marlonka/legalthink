import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Quote } from 'lucide-react';
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './pdf-viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;

type Size = { width: number; height: number };
type Citation = {
  state: 'none' | 'searching' | 'found' | 'multiple' | 'missing' | 'short';
  page: number;
};
type Position = { item: number; start: number; end: number };
const segmenter = new Intl.Segmenter('de', { granularity: 'grapheme' });
const PDF_TO_CSS_UNITS = 96 / 72;
const normalize = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();

// Preserve word boundaries, including spaces implied by PDF text geometry. Using the same
// character map for search and highlighting prevents an approximate match becoming evidence.
function mappedText(content: TextContent) {
  const items = content.items.filter((item): item is TextItem => 'str' in item);
  let value = '';
  const positions: Position[] = [];
  const append = (text: string, position: Position) => {
    for (const character of text) {
      if (/\s/.test(character)) {
        if (value && !value.endsWith(' ')) {
          value += ' ';
          positions.push(position);
        }
      } else {
        value += character;
        // String.indexOf and DOM Range use UTF-16 offsets.
        for (let offset = 0; offset < character.length; offset++) positions.push(position);
      }
    }
  };
  items.forEach((item, index) => {
    const previous = items[index - 1];
    if (previous) {
      const [a, b, , , x, y] = previous.transform;
      const length = Math.hypot(a, b) || 1;
      const direction = previous.dir === 'rtl' ? -1 : 1;
      const dx = item.transform[4] - x - (a / length) * previous.width * direction;
      const dy = item.transform[5] - y - (b / length) * previous.width * direction;
      const across = Math.abs((-b * dx + a * dy) / length);
      const along = ((a * dx + b * dy) / length) * direction;
      if (previous.hasEOL || across > previous.height * 0.4 || along > previous.height * 0.15) {
        append(' ', { item: index, start: 0, end: 0 });
      }
    }
    for (const part of segmenter.segment(item.str)) {
      append(part.segment.normalize('NFC'), {
        item: index,
        start: part.index,
        end: part.index + part.segment.length,
      });
    }
  });
  return { value: value.trimEnd(), positions };
}

function occurrences(text: string, needle: string) {
  const index = text.indexOf(needle);
  return index < 0 ? 0 : text.indexOf(needle, index + 1) < 0 ? 1 : 2;
}

function highlightQuote(layer: TextLayer, content: TextContent, paper: HTMLElement, quote: string) {
  const needle = normalize(quote);
  const { value, positions } = mappedText(content);
  if (needle.length < 12 || occurrences(value, needle) !== 1) return;
  const index = value.indexOf(needle);
  const first = positions[index];
  const last = positions[index + needle.length - 1];
  const start = layer.textDivs[first.item]?.firstChild;
  const end = layer.textDivs[last.item]?.firstChild;
  if (!(start instanceof Text) || !(end instanceof Text)) return;
  const range = document.createRange();
  range.setStart(start, first.start);
  range.setEnd(end, last.end);
  const bounds = paper.getBoundingClientRect();
  for (const rect of range.getClientRects()) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const mark = document.createElement('div');
    mark.className = 'pdf-quote-mark';
    mark.setAttribute('aria-hidden', 'true');
    Object.assign(mark.style, {
      left: `${rect.left - bounds.left}px`,
      top: `${rect.top - bounds.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    paper.appendChild(mark);
  }
}

function PdfPage({
  pdf,
  page,
  size,
  active,
  quote,
  onHighlight,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  size: Size;
  active: boolean;
  quote: string;
  onHighlight: (page: number, offset: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    if (!active || !host.current) return;
    let live = true;
    let render: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    const paper = host.current;
    paper.querySelectorAll('.pdf-quote-mark').forEach((mark) => mark.remove());
    const sheet = document.createElement('div');
    sheet.className = 'pdf-page-content';
    setState('loading');
    void (async () => {
      try {
        const source = await pdf.getPage(page);
        const base = source.getViewport({ scale: 1 });
        const scale = size.width / base.width;
        const view = source.getViewport({ scale });
        if (!live) return;
        sheet.style.setProperty('--total-scale-factor', String(scale * source.userUnit));
        const canvas = document.createElement('canvas');
        // Bound both density and total pixels: unusual page sizes must not allocate
        // unbounded canvases when a user selects 200%.
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          Math.sqrt(16_000_000 / (view.width * view.height)),
        );
        canvas.width = Math.ceil(view.width * ratio);
        canvas.height = Math.ceil(view.height * ratio);
        canvas.style.width = `${view.width}px`;
        canvas.style.height = `${view.height}px`;
        canvas.setAttribute('aria-hidden', 'true');
        sheet.appendChild(canvas);
        render = source.render({ canvas, viewport: view, transform: [ratio, 0, 0, ratio, 0, 0] });
        const [, content] = await Promise.all([render.promise, source.getTextContent()]);
        if (!live) return;
        const text = document.createElement('div');
        text.className = 'pdf-text-layer';
        sheet.appendChild(text);
        // Attach only after the canvas is ready; the previous page remains stable meanwhile.
        paper.replaceChildren(sheet);
        textLayer = new TextLayer({ textContentSource: content, container: text, viewport: view });
        await textLayer.render();
        if (!live) return;
        if (quote) {
          highlightQuote(textLayer, content, sheet, quote);
          const mark = sheet.querySelector<HTMLElement>('.pdf-quote-mark');
          if (mark) onHighlight(page, mark.offsetTop);
        }
        setState('ready');
      } catch {
        if (live) setState('error');
      }
    })();
    return () => {
      live = false;
      render?.cancel();
      textLayer?.cancel();
    };
  }, [pdf, page, size.width, active, quote, onHighlight]);

  // Offscreen canvases are released, but each page keeps its exact measured dimensions.
  useEffect(() => {
    if (!active) host.current?.replaceChildren();
  }, [active]);

  return (
    <div className="pdf-page-slot" style={{ height: size.height + 32 }} data-pdf-page={page}>
      <div className="pdf-page" style={{ width: size.width, height: size.height }}>
        <div ref={host} />
        {active && state !== 'ready' && (
          <div className="pdf-page-state" role={state === 'error' ? 'alert' : undefined}>
            {state === 'error' ? (
              'Seite kann nicht angezeigt werden.'
            ) : (
              <LoaderCircle className="spin" size={20} />
            )}
          </div>
        )}
      </div>
      <div className="pdf-page-number" aria-hidden="true">
        {page}
      </div>
    </div>
  );
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
  const [sizes, setSizes] = useState<Size[]>([]);
  const [page, setPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [zoom, setZoom] = useState('1');
  const [width, setWidth] = useState(0);
  const [error, setError] = useState('');
  const [markedPage, setMarkedPage] = useState<number | null>(null);
  const [citation, setCitation] = useState<Citation>({
    state: quote ? 'searching' : 'none',
    page: initialPage,
  });
  const [visible, setVisible] = useState({ start: 0, end: 2 });
  const viewport = useRef<HTMLDivElement>(null);
  const readViewportRef = useRef(() => {});
  const scrollAnchor = useRef({ page: initialPage, fraction: 0 });
  const pendingCitation = useRef(false);
  const userNavigated = useRef(false);
  const textCache = useRef(new Map<number, Promise<TextContent>>());
  const pageRef = useRef(page);
  const initialPageRef = useRef(initialPage);
  initialPageRef.current = initialPage;

  useEffect(() => {
    let live = true;
    setPdf(null);
    setSizes([]);
    setError('');
    textCache.current.clear();
    userNavigated.current = false;
    scrollAnchor.current = { page: initialPageRef.current, fraction: 0 };
    const task = getDocument({
      url: `/api/documents/${encodeURIComponent(documentId)}/original`,
      enableXfa: false,
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      wasmUrl: '/pdfjs/wasm/',
    });
    void (async () => {
      try {
        const document = await task.promise;
        const dimensions: Size[] = [];
        for (let start = 1; start <= document.numPages; start += 8) {
          const batch = await Promise.all(
            Array.from(
              { length: Math.min(8, document.numPages - start + 1) },
              async (_, offset) => {
                const source = await document.getPage(start + offset);
                const view = source.getViewport({ scale: 1 });
                return { width: view.width, height: view.height };
              },
            ),
          );
          if (!live) return;
          dimensions.push(...batch);
        }
        setPdf(document);
        setSizes(dimensions);
      } catch {
        if (live) setError('PDF kann nicht angezeigt werden. Laden Sie das Original herunter.');
      }
    })();
    return () => {
      live = false;
      void task.destroy().catch(() => {});
    };
  }, [documentId]);

  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setWidth(node.clientWidth);
      readViewportRef.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const layouts = useMemo(() => {
    let top = 12;
    return sizes.map((size) => {
      const scale = Number(zoom) * PDF_TO_CSS_UNITS;
      const result = { width: size.width * scale, height: size.height * scale, top };
      top += result.height + 32;
      return result;
    });
  }, [sizes, zoom]);

  function readViewport() {
    const node = viewport.current;
    if (!node || !layouts.length) return;
    const first = Math.max(
      0,
      layouts.findIndex((layout) => layout.top + layout.height + 32 > node.scrollTop),
    );
    const last = layouts.findIndex((layout) => layout.top > node.scrollTop + node.clientHeight);
    const current = Math.max(
      0,
      layouts.findIndex(
        (layout) =>
          layout.top + layout.height + 32 > node.scrollTop + Math.min(100, node.clientHeight / 4),
      ),
    );
    const nextPage = current + 1;
    const nextVisible = {
      start: Math.max(0, first - 1),
      end: last < 0 ? layouts.length - 1 : Math.min(layouts.length - 1, last + 1),
    };
    setVisible((previous) =>
      previous.start === nextVisible.start && previous.end === nextVisible.end
        ? previous
        : nextVisible,
    );
    pageRef.current = nextPage;
    setPage(nextPage);
    scrollAnchor.current = {
      page: nextPage,
      fraction: Math.max(
        0,
        (node.scrollTop - (layouts[current].top - 12)) / layouts[current].height,
      ),
    };
  }

  function goToPage(next: number, user = true) {
    const node = viewport.current;
    const target = layouts[Math.max(0, Math.min(next - 1, layouts.length - 1))];
    if (!node || !target) return;
    if (user) userNavigated.current = true;
    node.scrollTop = Math.max(0, target.top - 12);
    node.scrollLeft = 0;
    readViewport();
  }
  readViewportRef.current = readViewport;

  useLayoutEffect(() => {
    const node = viewport.current;
    const anchor = scrollAnchor.current;
    const target = layouts[Math.max(0, Math.min(anchor.page - 1, layouts.length - 1))];
    if (!node || !target) return;
    node.scrollTop = Math.max(0, target.top - 12 + target.height * anchor.fraction);
    readViewport();
    // Geometry changes preserve the currently read page and relative vertical position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts]);

  useEffect(() => setPageInput(String(page)), [page]);

  useEffect(() => {
    if (!pdf) return;
    let live = true;
    const targetPage = Math.max(1, Math.min(initialPage, pdf.numPages));
    pendingCitation.current = false;
    setMarkedPage(null);
    userNavigated.current = false;
    scrollAnchor.current = { page: targetPage, fraction: 0 };
    goToPage(targetPage, false);
    const needle = normalize(quote);
    if (needle.length < 12) {
      setCitation({ state: needle ? 'short' : 'none', page: targetPage });
      return;
    }
    setCitation({ state: 'searching', page: targetPage });
    const text = (number: number) => {
      let value = textCache.current.get(number);
      if (!value) {
        value = pdf.getPage(number).then((source) => source.getTextContent());
        textCache.current.set(number, value);
      }
      return value;
    };
    void (async () => {
      try {
        // A saved page reference may predate unique-page verification. Check the whole
        // document before marking a quote that may repeat in headers or appendices.
        const count = occurrences(mappedText(await text(targetPage)).value, needle);
        if (!live) return;
        if (count > 1) {
          setCitation({ state: 'multiple', page: targetPage });
          return;
        }
        let found = count === 1 ? targetPage : 0;
        for (let number = 1; number <= pdf.numPages; number++) {
          if (number === targetPage) continue;
          const matches = occurrences(mappedText(await text(number)).value, needle);
          if (!live) return;
          if (matches > 1 || (matches && found)) {
            setCitation({ state: 'multiple', page: targetPage });
            return;
          }
          if (matches) found = number;
        }
        if (!live) return;
        pendingCitation.current = Boolean(found) && !userNavigated.current;
        setCitation({ state: found ? 'found' : 'missing', page: found || targetPage });
      } catch {
        if (live) setCitation({ state: 'missing', page: targetPage });
      }
    })();
    return () => {
      live = false;
    };
    // Parser and geometry are retained when switching citations in the same document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, initialPage, quote]);

  useEffect(() => {
    if (citation.state === 'found' && pendingCitation.current) goToPage(citation.page, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citation]);

  const onHighlight = useCallback(
    (number: number, offset: number) => {
      setMarkedPage(number);
      if (!pendingCitation.current || userNavigated.current || !viewport.current) return;
      const layout = layouts[number - 1];
      if (layout) viewport.current.scrollTop = Math.max(0, layout.top + offset - 80);
      pendingCitation.current = false;
    },
    [layouts],
  );

  function jumpToCitation() {
    const number = citation.page;
    userNavigated.current = false;
    pendingCitation.current = citation.state === 'found';
    goToPage(number, false);
    const mark = viewport.current?.querySelector<HTMLElement>(
      `[data-pdf-page="${number}"] .pdf-quote-mark`,
    );
    if (mark) onHighlight(number, mark.offsetTop);
  }

  function commitPage() {
    const next = Number(pageInput);
    if (pdf && Number.isInteger(next) && next >= 1 && next <= pdf.numPages) goToPage(next);
    else setPageInput(String(page));
  }

  const status = error
    ? 'Originaldatei über „Herunterladen“ öffnen.'
    : !pdf
      ? 'PDF wird geladen …'
      : citation.state === 'searching'
        ? 'Zitat wird in der PDF gesucht …'
        : citation.state === 'found'
          ? markedPage === citation.page
            ? `Zitat auf Seite ${citation.page} markiert.`
            : `Texttreffer auf Seite ${citation.page}.`
          : citation.state === 'multiple'
            ? 'Zitat mehrfach vorhanden. Keine eindeutige Markierung.'
            : citation.state === 'short'
              ? 'Zitat für eine eindeutige Markierung zu kurz.'
              : citation.state === 'missing'
                ? 'Zitat im PDF-Text nicht eindeutig zuordenbar. Unter „Ausgelesener Text“ prüfen.'
                : `Seite ${page} von ${pdf.numPages}`;

  return (
    <section className="pdf-preview pdf-continuous-preview" aria-label="PDF-Vorschau">
      <div className="pdf-toolbar">
        <div className="pdf-pagination">
          <button
            className="icon-button"
            aria-label="Vorherige PDF-Seite"
            disabled={!pdf || page <= 1}
            onClick={() => goToPage(pageRef.current - 1)}
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
              onBlur={commitPage}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitPage();
              }}
            />
          </label>
          <span className="pdf-page-count">/ {pdf?.numPages ?? '–'}</span>
          <button
            className="icon-button"
            aria-label="Nächste PDF-Seite"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => goToPage(pageRef.current + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="pdf-view-actions">
          {quote && (
            <button
              className="icon-button"
              aria-label="Zur Fundstelle"
              title="Zur Fundstelle"
              disabled={!pdf || citation.state === 'searching'}
              onClick={jumpToCitation}
            >
              <Quote size={17} />
            </button>
          )}
          <select
            aria-label="PDF-Vergrößerung"
            value={zoom}
            onChange={(event) => setZoom(event.target.value)}
          >
            <option value="0.25">25 %</option>
            <option value="0.5">50 %</option>
            <option value="0.75">75 %</option>
            <option value="1">100 %</option>
            <option value="1.25">125 %</option>
            <option value="1.5">150 %</option>
            <option value="2">200 %</option>
          </select>
        </div>
      </div>
      <div
        className="pdf-viewport"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="PDF-Dokument"
        aria-busy={!pdf && !error}
        onScroll={readViewport}
        onWheel={() => {
          userNavigated.current = true;
        }}
        onPointerDown={() => {
          userNavigated.current = true;
        }}
        onTouchStart={() => {
          userNavigated.current = true;
        }}
        onKeyDown={(event) => {
          if (
            ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)
          )
            userNavigated.current = true;
        }}
      >
        {pdf && width > 0 && (
          <div
            className="pdf-paper-container pdf-continuous"
            style={{ minWidth: Math.max(width, ...layouts.map((layout) => layout.width + 24)) }}
          >
            {layouts.map((layout, index) => (
              <PdfPage
                key={index}
                pdf={pdf}
                page={index + 1}
                size={layout}
                active={index >= visible.start && index <= visible.end}
                quote={citation.state === 'found' && citation.page === index + 1 ? quote : ''}
                onHighlight={onHighlight}
              />
            ))}
          </div>
        )}
        {(!pdf || error) && (
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
        {status}
      </p>
    </section>
  );
}
