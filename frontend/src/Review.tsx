import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clipboard,
  ExternalLink as ExternalLinkIcon,
  FileCheck2,
  FileText,
  ListFilter,
  LoaderCircle,
  PanelRightClose,
  Quote,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import type { Analysis, DocumentRecord, Finding, Severity } from './types';
import { dateLabel, EFFORT_NAMES, ExternalLink } from './ui';
import { workflowName } from './workflows';
import { Collapse, MotionButton, useMotionPreferences } from './motion';
import './review-motion.css';

const SEVERITIES: Record<Severity, { label: string; short: string }> = {
  high: { label: 'Hohe Priorität', short: 'Hoch' },
  medium: { label: 'Mittlere Priorität', short: 'Mittel' },
  low: { label: 'Niedrige Priorität', short: 'Niedrig' },
  info: { label: 'Hinweis', short: 'Hinweise' },
};
type Tab = 'findings' | 'suggestions' | 'timeline';

export default function Review({
  analysis,
  documents,
  onBack,
  onExport,
  exporting,
  onCopy,
}: {
  analysis: Analysis;
  documents: DocumentRecord[];
  onBack: () => void;
  onExport: (format: 'docx' | 'md') => void;
  exporting: boolean;
  onCopy: (text: string) => void;
}) {
  const [tab, setTab] = useState<Tab>(analysis.workflow === 'chronology' ? 'timeline' : 'findings');
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(analysis.findings[0]?.id ?? '');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(
    () => new Set(analysis.findings.slice(0, 1).map((finding) => finding.id)),
  );
  const [sourceVisible, setSourceVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [sourceRequest, setSourceRequest] = useState(0);
  const consumedSourceRequest = useRef(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const exportTrigger = useRef<HTMLButtonElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement>(null);
  const { reduced, transition } = useMotionPreferences();
  function closeExport(restoreFocus = false) {
    setExportOpen(false);
    if (restoreFocus) exportTrigger.current?.focus({ preventScroll: true });
  }
  function closeSource() {
    setSourceVisible(false);
    sourceTrigger.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!exportOpen) return;
    function outside(event: PointerEvent) {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [exportOpen]);
  useEffect(() => {
    if (!sourceRequest || !sourceVisible || consumedSourceRequest.current === sourceRequest) return;
    const frame = requestAnimationFrame(() => {
      const panel = document.getElementById('source-panel');
      if (!panel) return;
      consumedSourceRequest.current = sourceRequest;
      const bounds = panel.getBoundingClientRect();
      // An explicit source action should reveal an off-screen source, not disturb reading.
      if (bounds.top < 0 || bounds.top > window.innerHeight - 100) {
        panel.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceRequest, sourceVisible, reduced]);
  useEffect(() => {
    setTab(analysis.workflow === 'chronology' ? 'timeline' : 'findings');
    setFilter('all');
    setSearch('');
    setSelectedId(analysis.findings[0]?.id ?? '');
    setExpandedFindings(new Set(analysis.findings.slice(0, 1).map((finding) => finding.id)));
    setMarked(new Set());
  }, [analysis.id, analysis.workflow, analysis.findings]);
  const selected = analysis.findings.find((item) => item.id === selectedId);
  const sourceDocument = documents.find((doc) => doc.id === selected?.source_document_id);
  const filtered = analysis.findings.filter(
    (item) =>
      (filter === 'all' || item.severity === filter) &&
      `${item.title} ${item.description} ${item.category}`
        .toLocaleLowerCase('de-DE')
        .includes(search.toLocaleLowerCase('de-DE')),
  );
  const suggestions = analysis.findings.filter((item) => item.suggestion);
  const hasTimeline = analysis.timeline.length > 0 || analysis.workflow === 'chronology';
  const counts = { high: 0, medium: 0, low: 0, info: 0 };
  analysis.findings.forEach((finding) => counts[finding.severity]++);
  function mark(id: string) {
    setMarked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  return (
    <div className="review-page review-motion">
      <div className="review-breadcrumb">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={14} /> Neue Analyse
        </button>
        <span>/</span>
        <span>{workflowName(analysis.workflow)}</span>
      </div>
      {analysis.is_demo && (
        <div className="demo-banner">
          <FileText size={15} />
          <span>
            <strong>Beispielanalyse</strong> · Fiktive Unterlagen mit vorgegebenen Ergebnissen.
          </span>
        </div>
      )}
      <header className="review-heading">
        <div>
          <h1>{analysis.title}</h1>
          <div className="review-meta">
            <span>{dateLabel(analysis.created_at)}</span>
            <span className="meta-dot" />
            <span>{analysis.model}</span>
            <span className="meta-dot" />
            <span>Denkaufwand {EFFORT_NAMES[analysis.effort] ?? analysis.effort}</span>
          </div>
        </div>
        <div
          className="export-wrapper"
          ref={exportRef}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setExportOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && exportOpen) {
              event.preventDefault();
              event.stopPropagation();
              closeExport(true);
            }
          }}
        >
          <MotionButton
            ref={exportTrigger}
            className="button secondary"
            onClick={() => setExportOpen(!exportOpen)}
            disabled={exporting}
            aria-expanded={exportOpen}
            aria-controls="export-options"
          >
            {exporting ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <ArrowDownToLine size={16} />
            )}
            Exportieren
            <motion.span
              className="review-chevron"
              aria-hidden="true"
              initial={false}
              animate={{ rotate: exportOpen ? 180 : 0 }}
              transition={transition('control')}
            >
              <ChevronDown size={13} />
            </motion.span>
          </MotionButton>
          <AnimatePresence initial={false}>
            {exportOpen && (
              <ExportPopover
                onExport={(format) => {
                  closeExport(true);
                  onExport(format);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </header>
      <div className="review-overview">
        <div className="summary-block">
          <p>{analysis.summary}</p>
        </div>
        <div className="risk-summary">
          {(['high', 'medium', 'low'] as Severity[]).map((severity) => (
            <button
              key={severity}
              aria-label={`${counts[severity]} Befunde, Priorität ${SEVERITIES[severity].short}`}
              onClick={() => {
                setFilter(severity);
                setTab('findings');
              }}
              className="risk-stat"
            >
              <span className="risk-count">{counts[severity].toString().padStart(2, '0')}</span>
              <span>
                <i className={`severity-dot ${severity}`} />
                {SEVERITIES[severity].short}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="review-tab-bar">
        <div className="review-tabs" role="tablist" aria-label="Analyseansichten">
          {(
            [
              { id: 'findings', label: 'Befunde', count: analysis.findings.length },
              { id: 'suggestions', label: 'Formulierungen', count: suggestions.length },
              ...(hasTimeline
                ? [{ id: 'timeline', label: 'Chronologie', count: analysis.timeline.length }]
                : []),
            ] as { id: Tab; label: string; count: number }[]
          ).map((item) => (
            <button
              key={item.id}
              id={`tab-${item.id}`}
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onKeyDown={(event) => {
                const tabs = Array.from(
                  event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  ),
                );
                const index = tabs.indexOf(event.currentTarget);
                if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? tabs[0]
                      : event.key === 'End'
                        ? tabs[tabs.length - 1]
                        : tabs[
                            (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) %
                              tabs.length
                          ];
                  next.click();
                  next.focus({ preventScroll: true });
                }
              }}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <span>{item.count}</span>
              {tab === item.id && <i className="review-tab-indicator" aria-hidden="true" />}
            </button>
          ))}
        </div>
        {tab !== 'timeline' && (
          <button
            ref={sourceTrigger}
            className="text-button source-toggle"
            onClick={() => setSourceVisible(!sourceVisible)}
            aria-pressed={sourceVisible}
          >
            <PanelRightClose size={16} />
            <ReviewToggleLabel
              active={sourceVisible}
              on="Quelle ausblenden"
              off="Quelle anzeigen"
            />
          </button>
        )}
      </div>
      {tab === 'findings' && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
          role="tabpanel"
          id="panel-findings"
          aria-labelledby="tab-findings"
          className={`review-workspace ${sourceVisible ? '' : 'source-hidden'}`}
        >
          <section className="findings-column" aria-label="Befunde">
            <div className="findings-toolbar">
              <div className="filter-pills" aria-label="Nach Priorität filtern">
                <button
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => setFilter('all')}
                  aria-pressed={filter === 'all'}
                >
                  <ListFilter size={13} />
                  Alle
                  {filter === 'all' && <i className="review-filter-indicator" aria-hidden="true" />}
                </button>
                {(['high', 'medium', 'low', 'info'] as Severity[])
                  .filter((severity) => counts[severity] > 0)
                  .map((severity) => (
                    <button
                      key={severity}
                      className={filter === severity ? 'active' : ''}
                      onClick={() => setFilter(severity)}
                      aria-pressed={filter === severity}
                    >
                      {SEVERITIES[severity].short}
                      <span>{counts[severity]}</span>
                      {filter === severity && (
                        <i className="review-filter-indicator" aria-hidden="true" />
                      )}
                    </button>
                  ))}
              </div>
              <label className="findings-search">
                <Search size={14} />
                <input
                  placeholder="Befunde durchsuchen"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Befunde durchsuchen"
                />
              </label>
            </div>
            <motion.div
              className="finding-list"
              key={filter}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transition('fade')}
            >
              {filtered.map((finding, index) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  index={index}
                  active={expandedFindings.has(finding.id)}
                  selected={selectedId === finding.id}
                  onSelect={() => {
                    setExpandedFindings((previous) => {
                      const next = new Set(previous);
                      if (next.has(finding.id)) next.delete(finding.id);
                      else next.add(finding.id);
                      return next;
                    });
                    setSelectedId(finding.id);
                  }}
                  onShowSource={() => {
                    setSelectedId(finding.id);
                    setSourceVisible(true);
                    setSourceRequest((request) => request + 1);
                  }}
                  onSuggestion={() => {
                    setSelectedId(finding.id);
                    setTab('suggestions');
                  }}
                />
              ))}
              {!filtered.length && (
                <div className="empty-state compact">
                  <FileCheck2 size={28} />
                  <h3>
                    {analysis.findings.length ? 'Keine passenden Befunde' : 'Keine Befunde erfasst'}
                  </h3>
                  {analysis.findings.length > 0 && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setFilter('all');
                        setSearch('');
                      }}
                    >
                      Filter zurücksetzen
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
            {analysis.questions.length > 0 && <OpenQuestions questions={analysis.questions} />}
          </section>
          {sourceVisible && (
            <SourcePanel finding={selected} document={sourceDocument} onClose={closeSource} />
          )}
        </motion.div>
      )}
      {tab === 'suggestions' && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
          role="tabpanel"
          id="panel-suggestions"
          aria-labelledby="tab-suggestions"
          className={`review-workspace ${sourceVisible ? '' : 'source-hidden'}`}
        >
          <section className="suggestions-column">
            {suggestions.map((finding, index) => (
              <article
                className={`suggestion-card ${selectedId === finding.id ? 'active' : ''}`}
                key={finding.id}
              >
                <header>
                  <button className="suggestion-title" onClick={() => setSelectedId(finding.id)}>
                    <span className="finding-number">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <h3>{finding.title}</h3>
                  </button>
                  <span className={`severity-tag ${finding.severity}`}>
                    <i className={`severity-dot ${finding.severity}`} />
                    {SEVERITIES[finding.severity].short}
                  </span>
                </header>
                {finding.source_quote && (
                  <div className="original-clause">
                    <span className="clause-label">AUSGANGSTEXT</span>
                    <p>{finding.source_quote}</p>
                  </div>
                )}
                <div className="proposed-clause">
                  <span className="clause-label">VORSCHLAG</span>
                  <p>{finding.suggestion}</p>
                </div>
                <footer>
                  <MotionButton className="text-button" onClick={() => onCopy(finding.suggestion)}>
                    <Clipboard size={14} />
                    Kopieren
                  </MotionButton>
                  <MotionButton
                    className={`mark-button ${marked.has(finding.id) ? 'marked' : ''}`}
                    onClick={() => mark(finding.id)}
                    aria-pressed={marked.has(finding.id)}
                  >
                    <span className="review-check" aria-hidden="true">
                      <Check size={14} />
                    </span>
                    <ReviewToggleLabel
                      active={marked.has(finding.id)}
                      on="Geprüft"
                      off="Als geprüft markieren"
                    />
                  </MotionButton>
                </footer>
              </article>
            ))}
            {!suggestions.length && (
              <div className="empty-state">
                <FileText size={30} />
                <h3>Keine Formulierungsvorschläge</h3>
              </div>
            )}
            {suggestions.length > 0 && (
              <p
                className="session-note"
                aria-hidden={marked.size === 0 || undefined}
                style={{ visibility: marked.size ? 'visible' : 'hidden' }}
              >
                {marked.size} von {suggestions.length} Vorschlägen für diese Sitzung als geprüft
                markiert.
              </p>
            )}
          </section>
          {sourceVisible && (
            <SourcePanel finding={selected} document={sourceDocument} onClose={closeSource} />
          )}
        </motion.div>
      )}
      {tab === 'timeline' && (
        <motion.section
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
          role="tabpanel"
          id="panel-timeline"
          aria-labelledby="tab-timeline"
          className="timeline-panel"
        >
          {analysis.timeline.length ? (
            <div className="table-scroll">
              <table className="timeline-table">
                <thead>
                  <tr>
                    <th>Datum / Zeitraum</th>
                    <th>Ereignis</th>
                    <th>Beleg</th>
                    <th>Offene Frage</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.timeline.map((event, index) => (
                    <tr key={`${event.date}-${index}`}>
                      <td>
                        <span className="timeline-date">
                          <span />
                          {event.date || 'Undatiert'}
                        </span>
                      </td>
                      <td>{event.event}</td>
                      <td>
                        <span className="table-source">
                          <FileText size={14} />
                          {event.source || 'Kein Beleg zugeordnet'}
                        </span>
                        {event.source_quote && (
                          <details className="table-source-evidence">
                            <summary>
                              {event.verified ? 'Zitat im Dokument gefunden' : 'Zitat prüfen'}
                            </summary>
                            <blockquote>{event.source_quote}</blockquote>
                          </details>
                        )}
                      </td>
                      <td>{event.open_question || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <CircleHelp size={30} />
              <h3>Keine zeitlichen Ereignisse erfasst</h3>
            </div>
          )}
          {analysis.questions.length > 0 && <OpenQuestions questions={analysis.questions} />}
        </motion.section>
      )}
      {(analysis.sources ?? []).length > 0 && (
        <section className="external-sources">
          <h3>
            <ExternalLinkIcon size={14} />
            Externe Quellen
          </h3>
          {analysis.sources!.map((source, index) => (
            <ExternalLink key={`${source.url}-${index}`} url={source.url}>
              {source.title}
            </ExternalLink>
          ))}
        </section>
      )}
      {(analysis.usage || analysis.provider_request_id) && (
        <details className="analysis-details">
          <summary>Verarbeitung & Verbrauch</summary>
          <dl>
            {analysis.usage && (
              <>
                <dt>Eingabe</dt>
                <dd>{analysis.usage.input_tokens.toLocaleString('de-DE')} Token</dd>
                <dt>Davon aus Cache</dt>
                <dd>{analysis.usage.cached_tokens.toLocaleString('de-DE')} Token</dd>
                <dt>Ausgabe</dt>
                <dd>{analysis.usage.output_tokens.toLocaleString('de-DE')} Token</dd>
              </>
            )}
            {analysis.provider_request_id && (
              <>
                <dt>API-Anfrage-ID</dt>
                <dd>
                  <code>{analysis.provider_request_id}</code>
                </dd>
              </>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}

function ReviewToggleLabel({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <span className="review-stable-label">
      <span
        aria-hidden={!active || undefined}
        style={{ visibility: active ? 'visible' : 'hidden' }}
      >
        {on}
      </span>
      <span aria-hidden={active || undefined} style={{ visibility: active ? 'hidden' : 'visible' }}>
        {off}
      </span>
    </span>
  );
}

function ExportPopover({ onExport }: { onExport: (format: 'docx' | 'md') => void }) {
  const present = useIsPresent();
  const firstOption = useRef<HTMLButtonElement>(null);
  const { reduced, transition } = useMotionPreferences();
  useEffect(() => {
    if (present) firstOption.current?.focus({ preventScroll: true });
  }, [present]);
  return (
    <motion.div
      className="export-popover"
      id="export-options"
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition('fade')}
    >
      <MotionButton ref={firstOption} onClick={() => onExport('docx')}>
        <FileText size={16} />
        <span>
          Word-Dokument<small>Prüfbericht mit Änderungsvorschlägen</small>
        </span>
      </MotionButton>
      <MotionButton onClick={() => onExport('md')}>
        <FileText size={16} />
        <span>
          Markdown<small>Prüfbericht als Textdatei</small>
        </span>
      </MotionButton>
    </motion.div>
  );
}

function FindingCard({
  finding,
  index,
  active,
  selected,
  onSelect,
  onShowSource,
  onSuggestion,
}: {
  finding: Finding;
  index: number;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onShowSource: () => void;
  onSuggestion: () => void;
}) {
  const { transition } = useMotionPreferences();
  return (
    <article className={`finding-card ${selected ? 'active' : ''}`}>
      <button
        className="finding-heading"
        onClick={onSelect}
        aria-expanded={active}
        aria-controls={`finding-${finding.id}`}
      >
        <span className="finding-number">{(index + 1).toString().padStart(2, '0')}</span>
        <span className="finding-heading-content">
          <span className="finding-category">{finding.category}</span>
          <strong>{finding.title}</strong>
          <span className={`severity-tag ${finding.severity}`}>
            <i className={`severity-dot ${finding.severity}`} />
            {SEVERITIES[finding.severity].label}
          </span>
        </span>
        <motion.span
          className="finding-chevron review-chevron"
          aria-hidden="true"
          initial={false}
          animate={{ rotate: active ? 180 : 0 }}
          transition={transition('control')}
        >
          <ChevronDown size={17} />
        </motion.span>
      </button>
      <Collapse open={active} id={`finding-${finding.id}`} className="finding-content-motion">
        <div className="finding-content">
          <p>{finding.description}</p>
          {finding.legal_basis && (
            <div className="legal-basis">
              <span>Rechtsbezug</span>
              <p>{finding.legal_basis}</p>
              {finding.source_urls?.map((url, index) => (
                <ExternalLink key={url} url={url}>
                  Recherchebeleg {index + 1}
                </ExternalLink>
              ))}
            </div>
          )}
          <div className="finding-actions">
            {finding.source_quote && (
              <MotionButton className="text-button" onClick={onShowSource}>
                <Quote size={13} />
                Fundstelle ansehen
                <ChevronRight size={12} />
              </MotionButton>
            )}
            {finding.suggestion && (
              <MotionButton className="text-button" onClick={onSuggestion}>
                Formulierung
                <ArrowRight size={13} />
              </MotionButton>
            )}
          </div>
        </div>
      </Collapse>
    </article>
  );
}

function SourcePanel({
  finding,
  document,
  onClose,
}: {
  finding?: Finding;
  document?: DocumentRecord;
  onClose: () => void;
}) {
  const [expandedFor, setExpandedFor] = useState('');
  const [contextExpandedFor, setContextExpandedFor] = useState('');
  const expanded = Boolean(finding?.id && expandedFor === finding.id);
  const contextExpanded = Boolean(finding?.id && contextExpandedFor === finding.id);
  const { reduced, transition } = useMotionPreferences();
  const contextId = useId();
  const documentTextId = useId();
  useEffect(() => {
    setExpandedFor('');
    setContextExpandedFor('');
  }, [finding?.id]);
  let before = '',
    after = '';
  if (finding && document?.text && finding.source_quote) {
    const index = document.text.indexOf(finding.source_quote);
    if (index >= 0) {
      before = document.text.slice(Math.max(0, index - 300), index);
      after = document.text.slice(
        index + finding.source_quote.length,
        index + finding.source_quote.length + 450,
      );
    }
  }
  const hasContext = Boolean(before.trim() || after.trim());
  return (
    <aside className="source-panel" id="source-panel" aria-label="Quellenansicht">
      <div className="source-panel-heading">
        <span>
          <FileText size={15} />
          Im Dokument
        </span>
        <MotionButton
          className="icon-button small"
          aria-label="Quellenansicht schließen"
          onClick={onClose}
        >
          <PanelRightClose size={15} />
        </MotionButton>
      </div>
      {finding ? (
        <motion.div
          key={finding.id}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
        >
          <div className="source-document-name">
            <div className="source-file-icon">
              <FileText size={22} strokeWidth={1.3} />
            </div>
            <div>
              <strong>{document?.name ?? 'Dokument nicht mehr verfügbar'}</strong>
              <span>{finding.source_location || 'Position nicht angegeben'}</span>
            </div>
          </div>
          <div className="source-paper">
            {finding.source_quote ? (
              <>
                {hasContext && (
                  <button
                    className="text-button source-context-toggle"
                    onClick={() => setContextExpandedFor(contextExpanded ? '' : finding.id)}
                    aria-expanded={contextExpanded}
                    aria-controls={contextId}
                  >
                    <ReviewToggleLabel
                      active={contextExpanded}
                      on="Kontext ausblenden"
                      off="Kontext anzeigen"
                    />
                    <ChevronDown size={13} />
                  </button>
                )}
                <div id={contextId}>
                  {contextExpanded && before && <p className="source-context">{before}</p>}
                  <blockquote>{finding.source_quote}</blockquote>
                  {contextExpanded && after && <p className="source-context">{after}</p>}
                </div>
              </>
            ) : (
              <div className="missing-source">
                <Search size={25} />
                <p>Kein Zitat hinterlegt.</p>
              </div>
            )}
          </div>
          <div className={`source-verification ${finding.verified ? 'verified' : ''}`}>
            {finding.verified ? <Check size={14} /> : <CircleHelp size={14} />}
            <span>
              {finding.verified
                ? document
                  ? 'Zitat im Dokument gefunden'
                  : 'Zitat bei der Analyse im Dokument gefunden'
                : 'Zitat nicht bestätigt – im Original prüfen'}
            </span>
          </div>
          {document?.text && (
            <div className="document-expanded">
              <button
                className="text-button"
                onClick={() => setExpandedFor(expanded ? '' : finding.id)}
                aria-expanded={expanded}
                aria-controls={documentTextId}
              >
                <ReviewToggleLabel
                  active={expanded}
                  on="Dokumenttext schließen"
                  off="Dokumenttext öffnen"
                />
                <ChevronDown size={13} />
              </button>
              {expanded && (
                <div className="full-document-text" id={documentTextId}>
                  {document.text}
                </div>
              )}
            </div>
          )}
          {!document && (
            <p className="document-unavailable">
              Der Dokumenttext ist nicht mehr gespeichert. Das Zitat bleibt Teil dieses Berichts.
            </p>
          )}
          <details className="source-note">
            <summary>Zum Zitatabgleich</summary>
            <p>
              Geprüft wird der Wortlaut im Dokument. Die rechtliche Bewertung wird nicht
              verifiziert.
            </p>
          </details>
        </motion.div>
      ) : (
        <div className="empty-source">
          <Quote size={27} strokeWidth={1.2} />
          <p>Befund auswählen, um die Fundstelle anzuzeigen.</p>
        </div>
      )}
    </aside>
  );
}

function OpenQuestions({ questions }: { questions: string[] }) {
  return (
    <section className="open-questions">
      <h3>
        <CircleHelp size={16} />
        Offene Fragen
      </h3>
      <ol>
        {questions.map((question, index) => (
          <li key={index}>{question}</li>
        ))}
      </ol>
    </section>
  );
}
