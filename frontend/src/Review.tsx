import { useEffect, useRef, useState } from 'react';
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
  Quote,
  Search,
} from 'lucide-react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import type { Analysis, DocumentRecord, Finding, Severity } from './types';
import { dateLabel, EFFORT_NAMES, ExternalLink } from './ui';
import { useDocumentPreview } from './DocumentPreview';
import { workflowName } from './workflows';
import { reviewLabels } from './review-workflows';
import { WorkflowFindingContent } from './WorkflowFindingContent';
import { ComparisonFinding, type ComparisonSide } from './ComparisonFinding';
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
  const { openPreview } = useDocumentPreview();
  const [tab, setTab] = useState<Tab>(analysis.workflow === 'chronology' ? 'timeline' : 'findings');
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(analysis.findings[0]?.id ?? '');
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(
    () => new Set(analysis.findings.slice(0, 1).map((finding) => finding.id)),
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [suggestionRequest, setSuggestionRequest] = useState<{
    id: string;
    sequence: number;
  } | null>(null);
  const labels = reviewLabels(analysis);
  const consumedSuggestionRequest = useRef(0);
  const exportRef = useRef<HTMLDivElement>(null);
  const exportTrigger = useRef<HTMLButtonElement>(null);
  const { reduced, transition } = useMotionPreferences();
  function closeExport(restoreFocus = false) {
    setExportOpen(false);
    if (restoreFocus) exportTrigger.current?.focus({ preventScroll: true });
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
    if (
      !suggestionRequest ||
      tab !== 'suggestions' ||
      consumedSuggestionRequest.current === suggestionRequest.sequence
    )
      return;
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`suggestion-${suggestionRequest.id}`);
      if (!card) return;
      consumedSuggestionRequest.current = suggestionRequest.sequence;
      card.querySelector<HTMLElement>('.suggestion-title')?.focus({ preventScroll: true });
      const bounds = card.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        card.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [suggestionRequest, tab, reduced]);
  useEffect(() => {
    setTab(analysis.workflow === 'chronology' ? 'timeline' : 'findings');
    setFilter('all');
    setSearch('');
    setSelectedId(analysis.findings[0]?.id ?? '');
    setExpandedFindings(new Set(analysis.findings.slice(0, 1).map((finding) => finding.id)));
    setMarked(new Set());
    setSuggestionRequest(null);
    consumedSuggestionRequest.current = 0;
  }, [analysis.id, analysis.workflow, analysis.findings]);
  function documentRole(documentId: string) {
    const index = analysis.document_ids?.indexOf(documentId) ?? -1;
    return analysis.workflow === 'compare' && index >= 0 && index < 2
      ? ['Original', 'Gegenentwurf'][index]
      : undefined;
  }
  const comparisonDocumentNames =
    analysis.workflow === 'compare' && analysis.document_ids?.length === 2
      ? analysis.document_ids.map(
          (id) =>
            documents.find((document) => document.id === id)?.name ??
            analysis.findings.find((finding) => finding.source_document_id === id)
              ?.source_document_name,
        )
      : null;
  const reviewType =
    analysis.workflow === 'compliance' && analysis.compliance_task === 'avv'
      ? 'AVV-Prüfung'
      : analysis.workflow === 'compliance' && analysis.compliance_task === 'dsfa'
        ? 'DSFA-Vorbereitung'
        : workflowName(analysis.workflow);
  const filtered = analysis.findings.filter(
    (item) =>
      (filter === 'all' || item.severity === filter) &&
      `${item.title} ${item.description} ${item.category} ${item.source_quote} ${item.comparison?.original.source_quote ?? ''} ${item.comparison?.counterdraft.source_quote ?? ''}`
        .toLocaleLowerCase('de-DE')
        .includes(search.toLocaleLowerCase('de-DE')),
  );
  const suggestions = analysis.findings.filter((item) => item.suggestion);
  const hasTimeline = analysis.timeline.length > 0 || analysis.workflow === 'chronology';
  const views: { id: Tab; label: string; count: number }[] = [
    ...(analysis.workflow !== 'chronology' || analysis.findings.length > 0
      ? [
          {
            id: 'findings' as const,
            label: labels.findings,
            count: analysis.findings.length,
          },
        ]
      : []),
    ...(suggestions.length
      ? [{ id: 'suggestions' as const, label: labels.suggestions, count: suggestions.length }]
      : []),
    ...(hasTimeline
      ? [{ id: 'timeline' as const, label: 'Chronologie', count: analysis.timeline.length }]
      : []),
  ];
  if (analysis.workflow === 'chronology')
    views.sort((a, b) => Number(b.id === 'timeline') - Number(a.id === 'timeline'));
  const sourceIds = new Set([...(analysis.document_ids ?? []), analysis.source_text_document_id]);
  const analysisDocuments = documents.filter((doc) => sourceIds.has(doc.id));
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
        <span>{reviewType}</span>
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
                chronology={analysis.workflow === 'chronology'}
                onExport={(format) => {
                  closeExport(true);
                  onExport(format);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </header>
      {analysisDocuments.length > 0 && (
        <details className="analysis-documents">
          <summary>Quellen · {analysisDocuments.length}</summary>
          <ul>
            {analysisDocuments.map((doc) => (
              <li key={doc.id}>
                <button
                  className="document-name-button"
                  onClick={() =>
                    openPreview({ source_document_id: doc.id, role: documentRole(doc.id) })
                  }
                >
                  {doc.name}
                </button>
                <a
                  className="text-button"
                  href={`/api/documents/${doc.id}/text`}
                  download
                  aria-label={`${doc.name} als TXT herunterladen`}
                >
                  <ArrowDownToLine size={14} /> TXT
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {comparisonDocumentNames && (
        <dl className="review-comparison-documents" aria-label="Vergleichsdokumente">
          {['Original', 'Gegenentwurf'].map((role, index) => (
            <div key={role}>
              <dt>{role}</dt>
              <dd title={comparisonDocumentNames[index]}>
                {comparisonDocumentNames[index] || 'Dokument nicht mehr verfügbar'}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="review-overview">
        <div className="summary-block">
          <p>{analysis.summary}</p>
        </div>
      </div>
      <div className="review-tab-bar">
        {views.length === 1 ? (
          <h2 className="review-section-heading" id={`tab-${views[0].id}`}>
            {views[0].label}
            <span>{views[0].count}</span>
          </h2>
        ) : (
          <div className="review-tabs" role="tablist" aria-label="Analyseansichten">
            {views.map((item) => (
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
                onClick={() => {
                  setSuggestionRequest(null);
                  consumedSuggestionRequest.current = 0;
                  setTab(item.id);
                }}
              >
                {item.label}
                <span>{item.count}</span>
                {tab === item.id && <i className="review-tab-indicator" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === 'findings' && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
          role={views.length > 1 ? 'tabpanel' : 'region'}
          id="panel-findings"
          aria-labelledby="tab-findings"
          className="review-workspace"
        >
          <section className="findings-column" aria-label={labels.findings}>
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
                  placeholder="Ergebnisse durchsuchen"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label={`${labels.findings} durchsuchen`}
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
                  analysis={analysis}
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
                    openPreview({
                      ...finding,
                      role: documentRole(finding.source_document_id),
                    });
                  }}
                  onComparisonSource={(side) => {
                    const source = finding.comparison?.[side];
                    if (source)
                      openPreview({
                        ...source,
                        role: side === 'original' ? 'Original' : 'Gegenentwurf',
                      });
                  }}
                  onSuggestion={() => {
                    setSelectedId(finding.id);
                    setTab('suggestions');
                    setSuggestionRequest((previous) => ({
                      id: finding.id,
                      sequence: (previous?.sequence ?? 0) + 1,
                    }));
                  }}
                />
              ))}
              {!filtered.length && (
                <div className="empty-state compact">
                  <FileCheck2 size={28} />
                  <h3>
                    {analysis.findings.length
                      ? 'Keine Treffer für diese Auswahl'
                      : `Keine ${labels.findings} erfasst`}
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
            {analysis.questions.length > 0 && (
              <OpenQuestions questions={analysis.questions} title={labels.questions} />
            )}
          </section>
        </motion.div>
      )}
      {tab === 'suggestions' && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
          role={views.length > 1 ? 'tabpanel' : 'region'}
          id="panel-suggestions"
          aria-labelledby="tab-suggestions"
          className="review-workspace"
        >
          <section className="suggestions-column">
            {suggestions.map((finding, index) => (
              <article
                id={`suggestion-${finding.id}`}
                className={`suggestion-card ${selectedId === finding.id ? 'active' : ''}`}
                key={finding.id}
              >
                <header>
                  <h3 className="suggestion-title" tabIndex={-1}>
                    <span className="finding-number">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                    <span>{finding.title}</span>
                  </h3>
                  <span className={`severity-tag ${finding.severity}`}>
                    <i className={`severity-dot ${finding.severity}`} />
                    {SEVERITIES[finding.severity].short}
                  </span>
                </header>
                {finding.source_quote && (
                  <div className="original-clause">
                    <span className="clause-label">
                      {documentRole(finding.source_document_id)
                        ? `Wortlaut im ${documentRole(finding.source_document_id)}`
                        : 'Ausgangstext'}
                    </span>
                    <p>{finding.source_quote}</p>
                    {!finding.verified && <small>Zitat nicht bestätigt</small>}
                  </div>
                )}
                <div className="proposed-clause">
                  <span className="clause-label">{labels.suggestion}</span>
                  <p>{finding.suggestion}</p>
                </div>
                <footer>
                  {finding.source_quote && (
                    <MotionButton
                      className="text-button"
                      onClick={() =>
                        openPreview({
                          ...finding,
                          role: documentRole(finding.source_document_id),
                        })
                      }
                    >
                      <Quote size={14} /> Fundstelle ansehen
                    </MotionButton>
                  )}
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
        </motion.div>
      )}
      {tab === 'timeline' && (
        <motion.section
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={transition('fade')}
          role={views.length > 1 ? 'tabpanel' : 'region'}
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
                      <td data-label="Datum / Zeitraum">
                        <span className="timeline-date">
                          <span />
                          {event.date || 'Undatiert'}
                        </span>
                      </td>
                      <td data-label="Ereignis">{event.event}</td>
                      <td data-label="Beleg">
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
                        {event.source_document_id && (
                          <button
                            className="text-button timeline-source-action"
                            onClick={() => {
                              openPreview({
                                source_document_id: event.source_document_id ?? '',
                                source_quote: event.source_quote,
                                source_location: event.source,
                                verified: event.verified,
                              });
                            }}
                          >
                            <Quote size={13} /> Fundstelle ansehen
                          </button>
                        )}
                      </td>
                      <td data-label="Offene Frage">
                        {event.open_question || <span className="muted">—</span>}
                      </td>
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
          {analysis.questions.length > 0 && (
            <OpenQuestions questions={analysis.questions} title={labels.questions} />
          )}
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
                {analysis.usage.cache_write_tokens != null && (
                  <>
                    <dt>Davon in Cache geschrieben</dt>
                    <dd>{analysis.usage.cache_write_tokens.toLocaleString('de-DE')} Token</dd>
                  </>
                )}
                <dt>Ausgabe</dt>
                <dd>{analysis.usage.output_tokens.toLocaleString('de-DE')} Token</dd>
              </>
            )}
            {analysis.provider_duration_ms != null && (
              <>
                <dt>API-Dauer</dt>
                <dd>
                  {(analysis.provider_duration_ms / 1000).toLocaleString('de-DE', {
                    maximumFractionDigits: 1,
                  })}{' '}
                  s
                </dd>
              </>
            )}
            {analysis.prompt_version && (
              <>
                <dt>Promptversion</dt>
                <dd>{analysis.prompt_version}</dd>
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

function ExportPopover({
  onExport,
  chronology,
}: {
  onExport: (format: 'docx' | 'md') => void;
  chronology: boolean;
}) {
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
      exit={{ opacity: 0, transition: transition('exit') }}
      transition={transition('enter')}
    >
      <MotionButton ref={firstOption} onClick={() => onExport('docx')}>
        <FileText size={16} />
        <span>
          Word-Dokument<small>{chronology ? 'Chronologie mit Belegen' : 'Prüfbericht'}</small>
        </span>
      </MotionButton>
      <MotionButton onClick={() => onExport('md')}>
        <FileText size={16} />
        <span>
          Markdown<small>Bericht als Textdatei</small>
        </span>
      </MotionButton>
    </motion.div>
  );
}

function FindingCard({
  analysis,
  finding,
  index,
  active,
  selected,
  onSelect,
  onShowSource,
  onComparisonSource,
  onSuggestion,
}: {
  analysis: Analysis;
  finding: Finding;
  index: number;
  active: boolean;
  selected: boolean;
  onSelect: () => void;
  onShowSource: () => void;
  onComparisonSource: (side: ComparisonSide) => void;
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
          {analysis.workflow === 'compare' ? (
            <ComparisonFinding finding={finding} onShowSource={onComparisonSource} />
          ) : (
            <WorkflowFindingContent analysis={analysis} finding={finding} />
          )}
          <div className="finding-actions">
            {finding.source_quote && !finding.comparison && (
              <MotionButton className="text-button" onClick={onShowSource}>
                <Quote size={13} />
                Fundstelle ansehen
                <ChevronRight size={12} />
              </MotionButton>
            )}
            {finding.suggestion && (
              <MotionButton className="text-button" onClick={onSuggestion}>
                {reviewLabels(analysis).suggestion}
                <ArrowRight size={13} />
              </MotionButton>
            )}
          </div>
        </div>
      </Collapse>
    </article>
  );
}

function OpenQuestions({ questions, title }: { questions: string[]; title: string }) {
  return (
    <section className="open-questions">
      <h3>
        <CircleHelp size={16} />
        {title}
      </h3>
      <ol>
        {questions.map((question, index) => (
          <li key={index}>{question}</li>
        ))}
      </ol>
    </section>
  );
}
