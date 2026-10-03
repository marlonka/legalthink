import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, LocateFixed, Palette } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import JSZip from 'jszip';
import type { DocumentRecord } from './types';
import { paginateWord } from './wordPagination';
import './word-preview.css';

const FRAME_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'"><style>
html { background: var(--document-canvas); scrollbar-gutter: stable; }
body { margin: 0; color: #111111; }
.docx-wrapper { padding: 24px !important; background: transparent !important; min-width: min-content; }
.docx-wrapper > section.docx { box-shadow: 0 1px 6px #0002 !important; margin-bottom: 24px !important; flex-shrink: 0; overflow: visible; filter: var(--document-filter); }
.docx-wrapper > section.docx > article { flex-shrink: 0; }
.docx-wrapper > section.docx:last-child { margin-bottom: 0 !important; }
html[data-neutral='true'] .docx-wrapper > section.docx { box-shadow: none !important; }
[data-word-continuation]::before { content: none !important; }
mark.source-word-quote { background: #ffdd75; color: inherit; padding: 0; }
html[data-neutral='true'] mark.source-word-quote { background: #555555; color: #ffffff !important; }
ins { background: #e4f0e1; text-decoration: underline; }
del { background: #f8e1df; text-decoration: line-through; }
a { color: inherit; pointer-events: none; text-decoration: underline; }
</style></head><body></body></html>`;

function isRaster(data: Uint8Array) {
  return (
    (data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47 &&
      data[4] === 0x0d &&
      data[5] === 0x0a &&
      data[6] === 0x1a &&
      data[7] === 0x0a) ||
    (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
    String.fromCharCode(...data.slice(0, 6)) === 'GIF87a' ||
    String.fromCharCode(...data.slice(0, 6)) === 'GIF89a' ||
    (String.fromCharCode(...data.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...data.slice(8, 12)) === 'WEBP')
  );
}

// Sanitise before docx-preview creates any DOM nodes: the renderer uses the
// parent document even when its output container belongs to a sandboxed frame.
async function preparePreview(data: ArrayBuffer) {
  const archive = await JSZip.loadAsync(data);
  const entries = Object.values(archive.files);
  if (entries.length > 1000) throw new Error('Word archive is too large');
  let omitted = false;
  let changes = false;
  let expandedBytes = 0;
  const images = new Set<string>();
  const partImages = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.dir) continue;
    const bytes = await entry.async('uint8array');
    expandedBytes += bytes.byteLength;
    if (expandedBytes > 40 * 1024 * 1024) throw new Error('Word archive is too large');
    if (/\.(png|jpe?g|gif|webp)$/i.test(entry.name) && isRaster(bytes)) {
      images.add(entry.name);
    } else if (!/\.(xml|rels)$/i.test(entry.name)) {
      archive.remove(entry.name);
      // Fonts, macros, OLE objects, HTML and vector images are never rendered.
      // Unreferenced metadata is not a visible omission. References and actual
      // drawing/content elements below determine whether to show the notice.
    }
  }
  // Relationships first, so image references in each XML part can be checked.
  const xmlEntries = entries.filter((entry) => /\.(xml|rels)$/i.test(entry.name));
  xmlEntries.sort((a, b) => Number(b.name.endsWith('.rels')) - Number(a.name.endsWith('.rels')));
  for (const entry of xmlEntries) {
    if (entry.dir || !/\.(xml|rels)$/i.test(entry.name)) continue;
    const source = await entry.async('string');
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error('Unsupported XML declarations');
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid Word XML');
    if (entry.name.endsWith('.rels')) {
      const part = entry.name.replace(/(^|\/)\_rels\//, '$1').replace(/\.rels$/, '');
      const folder = part.slice(0, part.lastIndexOf('/') + 1);
      const allowedImages = new Set<string>();
      partImages.set(part, allowedImages);
      for (const relation of Array.from(xml.getElementsByTagName('*')).filter(
        (element) => element.localName === 'Relationship',
      )) {
        const target = (relation.getAttribute('Target') || '').trim();
        const kind = relation.getAttribute('Type')?.split('/').pop()?.toLowerCase() || '';
        const resolved = new URL(target, `https://document.invalid/${folder}`);
        const external =
          relation.getAttribute('TargetMode')?.toLowerCase() === 'external' ||
          /^[a-z][a-z\d+.-]*:|^[/\\]/i.test(target) ||
          resolved.origin !== 'https://document.invalid';
        if (
          external ||
          kind === 'afchunk' ||
          kind === 'oleobject' ||
          kind === 'font' ||
          (kind === 'image' && !images.has(resolved.pathname.slice(1)))
        ) {
          relation.remove();
          if (['image', 'afchunk', 'oleobject'].includes(kind)) omitted = true;
        } else if (kind === 'image') {
          allowedImages.add(relation.getAttribute('Id') || '');
        }
      }
    }
    // The upstream parser uses localName, so validate every namespace variant.
    for (const element of Array.from(xml.getElementsByTagName('*'))) {
      const attribute = (name: string) =>
        Array.from(element.attributes).find((value) => value.localName === name)?.value || '';
      if (element.localName === 'sym' && !/^[a-f\d]{1,6}$/i.test(attribute('char'))) {
        element.remove();
        omitted = true;
      }
      if (['altChunk', 'pict', 'object'].includes(element.localName)) {
        element.remove();
        omitted = true;
      }
      if (element.localName === 'blip' && !partImages.get(entry.name)?.has(attribute('embed'))) {
        let drawing = element.parentElement;
        while (drawing && !['drawing', 'pic'].includes(drawing.localName))
          drawing = drawing.parentElement;
        (drawing || element).remove();
        omitted = true;
      }
      if (['ins', 'del'].includes(element.localName)) changes = true;
    }
    // Word style values become CSS. Strip syntax that can introduce URL loads
    // or new CSS rules; document text nodes remain unchanged.
    for (const element of Array.from(xml.getElementsByTagName('*'))) {
      for (const attribute of Array.from(element.attributes)) {
        if (attribute.name.startsWith('xmlns')) continue;
        if (/[<>{}\\]|url\s*\(|@import|\/\*|\*\//i.test(attribute.value)) {
          element.removeAttributeNode(attribute);
        }
      }
    }
    archive.file(entry.name, new XMLSerializer().serializeToString(xml));
  }
  return { data: await archive.generateAsync({ type: 'arraybuffer' }), omitted, changes };
}

function sanitiseRenderedContent(container: HTMLElement) {
  let omitted = false;
  for (const element of container.querySelectorAll(
    'script, iframe, object, embed, form, svg, link, meta',
  )) {
    element.remove();
    omitted = true;
  }
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on/i.test(attribute.name) ||
        ['href', 'srcdoc', 'srcset', 'action', 'formaction'].includes(attribute.name)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
    const src = element.getAttribute('src');
    // Image bytes were independently checked in the ZIP. JSZip emits a generic
    // binary MIME; the browser recognises the raster file signature.
    if (src && !/^data:[^,]*;base64,/i.test(src)) element.removeAttribute('src');
  }
  return omitted;
}

type Position = { node: Text; offset: number };

function markQuote(container: HTMLElement, quote: string, bodyOnly = true): HTMLElement | null {
  const needle = quote.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (needle.length < 12) return null;
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
  );
  const nodes: Text[] = [];
  let raw = '';
  const rawPositions: Position[] = [];
  let previousBlock: Element | null = null;
  let lineBreak = false;
  while (walker.nextNode()) {
    const element =
      walker.currentNode.nodeType === Node.ELEMENT_NODE
        ? (walker.currentNode as Element)
        : walker.currentNode.parentElement;
    // Repeated page headers/footers must not interrupt a body citation across
    // an automatic page break. Search those regions only as a fallback.
    if (bodyOnly && !element?.closest('article')) continue;
    if (walker.currentNode.nodeType === Node.ELEMENT_NODE) {
      if ((walker.currentNode as Element).localName === 'br') lineBreak = true;
      continue;
    }
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('style, script')) continue;
    const block = node.parentElement?.closest('p, td, li, h1, h2, h3, header, footer') || null;
    if (raw && (lineBreak || block !== previousBlock)) {
      raw += '\n';
      rawPositions.push({ node, offset: 0 });
    }
    lineBreak = false;
    previousBlock = block;
    nodes.push(node);
    for (let offset = 0; offset < node.length; offset++) {
      raw += node.data[offset];
      rawPositions.push({ node, offset });
    }
  }
  let text = '';
  const starts: Position[] = [];
  const ends: Position[] = [];
  for (const { segment, index } of new Intl.Segmenter(undefined, {
    granularity: 'grapheme',
  }).segment(raw)) {
    const value = segment.normalize('NFC');
    for (const character of value) {
      if (/\s/.test(character) && text.endsWith(' ')) continue;
      const normalized = /\s/.test(character) ? ' ' : character;
      text += normalized;
      for (let unit = 0; unit < normalized.length; unit++) {
        starts.push(rawPositions[index]);
        ends.push(rawPositions[index + segment.length - 1]);
      }
    }
  }
  const index = text.indexOf(needle);
  if (index < 0 || text.indexOf(needle, index + 1) !== -1)
    return bodyOnly ? markQuote(container, quote, false) : null;
  const first = starts[index],
    last = ends[index + needle.length - 1];
  let active = false;
  let firstMark: HTMLElement | null = null;
  for (const node of nodes) {
    if (node === first.node) active = true;
    if (!active) continue;
    const start = node === first.node ? first.offset : 0;
    const end = node === last.node ? last.offset + 1 : node.length;
    if (end > start) {
      const range = node.ownerDocument.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      const mark = node.ownerDocument.createElement('mark');
      mark.className = 'source-word-quote';
      range.surroundContents(mark);
      firstMark ||= mark;
    }
    if (node === last.node) break;
  }
  return firstMark;
}

export default function WordPreview({
  document: source,
  quote = '',
  onEscape,
}: {
  document: DocumentRecord;
  quote?: string;
  onEscape?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [frameReady, setFrameReady] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState('1');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pageCount, setPageCount] = useState(0);
  const [originalColors, setOriginalColors] = useState(false);
  const [dark, setDark] = useState(document.documentElement.dataset.theme !== 'light');
  const [highlighted, setHighlighted] = useState(false);
  const [omitted, setOmitted] = useState(false);
  const [changes, setChanges] = useState(false);

  useEffect(() => setPageInput(String(page)), [page]);

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const frameRoot = frame.current?.contentDocument?.documentElement;
      if (!frameRoot) return;
      const styles = getComputedStyle(root);
      const isDark = root.dataset.theme !== 'light';
      setDark(isDark);
      frameRoot.style.colorScheme = isDark ? 'dark' : 'light';
      frameRoot.style.setProperty(
        '--document-canvas',
        styles.getPropertyValue('--document-canvas'),
      );
      frameRoot.style.setProperty(
        '--document-filter',
        originalColors ? 'none' : styles.getPropertyValue('--document-filter'),
      );
      frameRoot.dataset.neutral = String(isDark && !originalColors);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [frameReady, originalColors]);

  useEffect(() => {
    const target = frame.current?.contentDocument;
    if (!target || !onEscape) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    };
    target.addEventListener('keydown', close);
    return () => target.removeEventListener('keydown', close);
  }, [onEscape, frameReady]);

  function jumpToQuote() {
    const target =
      frame.current?.contentDocument?.querySelector<HTMLElement>('mark.source-word-quote');
    const win = frame.current?.contentWindow;
    if (target && win)
      win.scrollTo({
        top: target.getBoundingClientRect().top + win.scrollY - win.innerHeight * 0.3,
      });
  }

  function jumpToPage(value: number) {
    const next = Math.max(1, Math.min(value, pageCount));
    const target =
      frame.current?.contentDocument?.querySelectorAll<HTMLElement>('section.docx')[next - 1];
    const win = frame.current?.contentWindow;
    if (target && win) {
      win.scrollTo({ top: target.getBoundingClientRect().top + win.scrollY - 24 });
      setPage(next);
    }
  }

  function submitPage() {
    const value = Number(pageInput);
    if (Number.isInteger(value) && value >= 1 && value <= pageCount) jumpToPage(value);
    else setPageInput(String(page));
  }

  useEffect(() => {
    if (!frameReady) return;
    let active = true;
    const controller = new AbortController();
    const target = frame.current?.contentDocument;
    if (!target) return;
    target.body.replaceChildren();
    setLoading(true);
    setError('');
    setHighlighted(false);
    setOmitted(false);
    setChanges(false);
    setPageCount(0);
    setPage(1);
    void (async () => {
      const response = await fetch(`/api/documents/${encodeURIComponent(source.id)}/original`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Document unavailable');
      const prepared = await preparePreview(await response.arrayBuffer());
      if (!active) return;
      const inert = document.implementation.createHTMLDocument('Word');
      const styles = inert.createElement('div');
      await renderAsync(prepared.data, inert.body, styles, {
        className: 'docx',
        inWrapper: true,
        ignoreFonts: true,
        renderAltChunks: false,
        renderChanges: true,
        renderComments: false,
        useBase64URL: true,
        experimental: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
      });
      if (!active) return;
      const excluded = sanitiseRenderedContent(inert.body);
      for (const style of target.querySelectorAll('[data-word-style]')) style.remove();
      for (const style of styles.querySelectorAll('style')) {
        style.dataset.wordStyle = '';
        target.head.appendChild(style);
      }
      target.body.replaceChildren(...Array.from(inert.body.childNodes));
      await Promise.all(
        Array.from(target.images).map((image) => image.decode().catch(() => undefined)),
      );
      if (!active) return;
      await paginateWord(target, () => active);
      if (!active) return;
      setPageCount(target.querySelectorAll('section.docx').length);
      setOmitted(prepared.omitted || excluded);
      setChanges(prepared.changes);
      setLoading(false);
    })().catch(() => {
      if (active) {
        setError('Word-Datei kann nicht angezeigt werden. Das Original bleibt herunterladbar.');
        setLoading(false);
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [source.id, frameReady]);

  useEffect(() => {
    if (loading || error || !viewport.current) return;
    const update = () => {
      const doc = frame.current?.contentDocument;
      const wrapper = doc?.querySelector<HTMLElement>('.docx-wrapper');
      const pages = Array.from(doc?.querySelectorAll<HTMLElement>('section.docx') || []);
      if (!wrapper || !pages.length) return;
      const win = frame.current?.contentWindow;
      const previousScale = Number(wrapper.style.zoom) || 1;
      const anchor = (win?.scrollY || 0) / previousScale;
      wrapper.style.zoom = zoom;
      win?.scrollTo({ top: anchor * (Number(wrapper.style.zoom) || 1) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport.current);
    return () => {
      observer.disconnect();
    };
  }, [loading, error, zoom]);

  useEffect(() => {
    if (loading || error) return;
    const win = frame.current?.contentWindow;
    if (!win) return;
    let pending = 0;
    const update = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const pages = Array.from(win.document.querySelectorAll<HTMLElement>('section.docx'));
        const index = pages.findIndex(
          (item) => item.getBoundingClientRect().bottom > win.innerHeight * 0.3,
        );
        if (index >= 0) setPage(index + 1);
      });
    };
    win.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      win.removeEventListener('scroll', update);
      cancelAnimationFrame(pending);
    };
  }, [loading, error]);

  useEffect(() => {
    const container = frame.current?.contentDocument?.body;
    if (loading || error || !container) return;
    for (const mark of container.querySelectorAll('mark.source-word-quote')) {
      const parent = mark.parentElement;
      mark.replaceWith(...Array.from(mark.childNodes));
      parent?.normalize();
    }
    const marked = markQuote(container, quote);
    setHighlighted(Boolean(marked));
    if (marked) {
      const ready = requestAnimationFrame(jumpToQuote);
      return () => cancelAnimationFrame(ready);
    }
  }, [loading, error, quote, source.id]);

  return (
    <div className="word-preview">
      <div className="word-preview-toolbar">
        <button className="text-button" onClick={jumpToQuote} disabled={!highlighted || loading}>
          <LocateFixed size={14} /> Zur Fundstelle
        </button>
        <div className="word-preview-pages">
          <button
            className="icon-button"
            aria-label="Vorherige Word-Seite"
            disabled={loading || page <= 1}
            onClick={() => jumpToPage(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <label>
            <span className="sr-only">Word-Seite</span>
            <input
              inputMode="numeric"
              value={pageInput}
              disabled={loading || !pageCount}
              onChange={(event) => setPageInput(event.target.value)}
              onBlur={submitPage}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitPage();
              }}
            />
          </label>
          <span>/ {pageCount || '–'}</span>
          <button
            className="icon-button"
            aria-label="Nächste Word-Seite"
            disabled={loading || page >= pageCount}
            onClick={() => jumpToPage(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {dark && (
          <button
            className="icon-button word-colors"
            title="Originalfarben"
            aria-label="Originalfarben"
            aria-pressed={originalColors}
            onClick={() => setOriginalColors((value) => !value)}
          >
            <Palette size={16} />
          </button>
        )}
        <label>
          Zoom{' '}
          <select
            value={zoom}
            onChange={(event) => setZoom(event.target.value)}
            aria-label="Word-Zoom"
          >
            <option value="0.25">25 %</option>
            <option value="0.5">50 %</option>
            <option value="0.75">75 %</option>
            <option value="1">100 %</option>
            <option value="1.25">125 %</option>
            <option value="1.5">150 %</option>
            <option value="2">200 %</option>
          </select>
        </label>
      </div>
      <div className="word-preview-viewport" ref={viewport} aria-busy={loading}>
        <iframe
          ref={frame}
          title={`Word-Vorschau: ${source.name}`}
          sandbox="allow-same-origin"
          srcDoc={FRAME_DOCUMENT}
          onLoad={() => setFrameReady((value) => value + 1)}
          className={loading || error ? 'word-preview-frame is-loading' : 'word-preview-frame'}
        />
        {loading && (
          <div className="word-preview-state" role="status">
            <LoaderCircle size={18} className="spin" /> Word wird geladen
          </div>
        )}
        {error && (
          <div className="word-preview-state" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="word-preview-notes">
        <p>Layout und Seitenumbrüche können von Word abweichen.</p>
        {quote && !loading && !error && (
          <p>
            {highlighted
              ? 'Zitat in der Vorschau markiert.'
              : 'Zitat im Word-Layout nicht eindeutig markierbar. Der Textabgleich steht unter „Ausgelesener Text“.'}
          </p>
        )}
        {changes && (
          <p>Änderungsverfolgung: Einfügungen unterstrichen, Löschungen durchgestrichen.</p>
        )}
        {omitted && (
          <p>
            Einzelne eingebettete oder verknüpfte Inhalte sind nur in der heruntergeladenen Datei
            verfügbar.
          </p>
        )}
      </div>
    </div>
  );
}
