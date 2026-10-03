import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LocateFixed } from 'lucide-react';
import type { DocumentRecord } from './types';

// Normalize in native string operations; source-size arrays and iterating one
// Intl.Segmenter result per character make pasted million-character files costly.
function locateQuote(text: string, quote: string) {
  const wanted = quote.normalize('NFC').replace(/\s+/g, ' ').trim();
  const empty = { count: 0, start: 0, end: 0, tooShort: Boolean(wanted) && wanted.length < 12 };
  if (wanted.length < 12) return empty;
  const composed = text.normalize('NFC');
  const normalized = composed.replace(/\s+/g, ' ');
  const first = normalized.indexOf(wanted);
  if (first < 0) return empty;
  if (normalized.indexOf(wanted, first + 1) >= 0) return { ...empty, count: 2 };

  // Only two offsets are needed. Count removed whitespace before each boundary,
  // instead of retaining a mapping entry for every UTF-16 unit in the document.
  const end = first + wanted.length;
  let removed = 0;
  let sourceStart = first;
  let sourceEnd = end;
  for (const run of composed.matchAll(/\s+/g)) {
    const boundary = run.index - removed + 1;
    if (boundary > end) break;
    const difference = run[0].length - 1;
    if (boundary <= first) sourceStart += difference;
    sourceEnd += difference;
    removed += difference;
  }
  if (composed === text) return { ...empty, count: 1, start: sourceStart, end: sourceEnd };

  // Rare decomposed Unicode needs a second mapping. Native prefix normalization
  // gives a monotonic boundary search; containing() expands a boundary inside a
  // composed grapheme without walking all document graphemes.
  const segments = new Intl.Segmenter('de', { granularity: 'grapheme' }).segment(text);
  function originalBoundary(position: number, endBoundary: boolean) {
    let low = 0;
    let high = text.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (text.slice(0, middle).normalize('NFC').length <= position) low = middle;
      else high = middle - 1;
    }
    const segment = segments.containing(endBoundary ? Math.max(0, low - 1) : low);
    return segment ? segment.index + (endBoundary ? segment.segment.length : 0) : low;
  }
  return {
    ...empty,
    count: 1,
    start: originalBoundary(sourceStart, false),
    end: originalBoundary(sourceEnd, true),
  };
}

export default function TextPreview({
  document,
  quote,
  original,
  markdown,
}: {
  document: DocumentRecord;
  quote: string;
  original: boolean;
  markdown: boolean;
}) {
  const [text, setText] = useState(original ? '' : document.text);
  const [loading, setLoading] = useState(original);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [reading, setReading] = useState(markdown && !quote);
  const viewport = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLElement>(null);
  const match = useMemo(() => locateQuote(text, quote), [text, quote]);
  function jump() {
    const container = viewport.current,
      target = mark.current;
    if (container && target)
      container.scrollTop +=
        target.getBoundingClientRect().top - container.getBoundingClientRect().top - 80;
  }
  useEffect(() => {
    setError('');
    if (!original) {
      setText(document.text);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setText('');
    fetch(`/api/documents/${document.id}/original`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Die Originaldatei konnte nicht geladen werden.');
        return response.text();
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        setText(value);
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Datei konnte nicht geladen werden.');
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [document.id, document.text, original, attempt]);
  useEffect(() => {
    setReading(markdown && !quote);
  }, [document.id, quote, markdown]);
  useEffect(() => {
    if (reading || match.count !== 1 || loading) return;
    const frame = requestAnimationFrame(jump);
    return () => cancelAnimationFrame(frame);
  }, [match, reading, loading]);
  if (loading)
    return (
      <div className="preview-loading" role="status">
        Text wird geöffnet …
      </div>
    );
  if (error)
    return (
      <div className="preview-unavailable" role="alert">
        <p>{error}</p>
        <button className="button secondary" onClick={() => setAttempt(attempt + 1)}>
          Erneut laden
        </button>
      </div>
    );
  return (
    <div className="text-preview">
      <div className="text-preview-toolbar">
        {markdown ? (
          <div role="group" aria-label="Textdarstellung">
            <button aria-pressed={reading} onClick={() => setReading(true)}>
              Leseansicht
            </button>
            <button aria-pressed={!reading} onClick={() => setReading(false)}>
              Quelltext
            </button>
          </div>
        ) : (
          <span>{original ? 'Originaltext' : 'Gespeicherter Text'}</span>
        )}
        {quote && (
          <button
            className="text-button"
            disabled={match.count !== 1}
            onClick={() => {
              if (reading) setReading(false);
              else jump();
            }}
          >
            <LocateFixed size={14} /> Zur Fundstelle
          </button>
        )}
      </div>
      <div
        ref={viewport}
        className="text-preview-viewport"
        tabIndex={0}
        aria-label={reading ? 'Markdown-Leseansicht' : 'Dokumenttext'}
      >
        {reading ? (
          <article className="markdown-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                img: ({ alt }) => (
                  <span className="markdown-image-placeholder">[Bild{alt ? `: ${alt}` : ''}]</span>
                ),
                a: ({ href, children }) =>
                  href && /^https?:\/\//i.test(href) ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ) : (
                    <span>{children}</span>
                  ),
              }}
            >
              {text}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="plain-text-preview">
            {match.count === 1 ? (
              <>
                {text.slice(0, match.start)}
                <mark ref={mark}>{text.slice(match.start, match.end)}</mark>
                {text.slice(match.end)}
              </>
            ) : (
              text
            )}
          </div>
        )}
      </div>
      {quote && (
        <p className="text-preview-status" role="status">
          {match.count === 1
            ? reading
              ? 'Fundstelle im Quelltext verfügbar.'
              : 'Fundstelle markiert.'
            : match.count > 1
              ? 'Zitat kommt mehrfach vor. Keine eindeutige Markierung.'
              : match.tooShort
                ? 'Zitat für eine eindeutige Markierung zu kurz.'
                : 'Zitat im angezeigten Text nicht gefunden.'}
        </p>
      )}
    </div>
  );
}
