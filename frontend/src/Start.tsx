import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  FileText,
  LoaderCircle,
  Paperclip,
  Plus,
  ScanLine,
  ShieldCheck,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { ErrorMessage, ModelPicker } from './ui';
import DocumentPicker from './DocumentPicker';
import { WORKFLOWS } from './workflows';
import type { DocumentRecord, Health, Model, Playbook, Workflow } from './types';

const COMPLIANCE_TASKS = [
  {
    label: 'AVV prüfen',
    prompt:
      'Prüfen Sie die Auftragsverarbeitungsvereinbarung aus Sicht des Verantwortlichen. Stellen Sie fehlende Regelungen, offene Nachweise und konkrete Formulierungsvorschläge zusammen.',
  },
  {
    label: 'DSFA vorbereiten',
    prompt:
      'Bereiten Sie eine Datenschutz-Folgenabschätzung vor: Verarbeitung und Zwecke, Erforderlichkeit und Verhältnismäßigkeit, Risiken für betroffene Personen und geplante Abhilfemaßnahmen. Kennzeichnen Sie fehlende Angaben und offene Bewertungen ausdrücklich.',
  },
];

interface Props {
  workflow: Workflow;
  onWorkflow: (value: Workflow) => void;
  documents: DocumentRecord[];
  libraryDocuments: DocumentRecord[];
  onSelectDocuments: (ids: string[]) => void;
  onUpload: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onReorder: () => void;
  context: string;
  onContext: (value: string) => void;
  model: string;
  effort: string;
  models: Model[];
  onModel: (value: string) => void;
  onEffort: (value: string) => void;
  playbooks: Playbook[];
  playbookId: string;
  onPlaybook: (value: string) => void;
  research: boolean;
  onResearch: (value: boolean) => void;
  onRun: () => void;
  onCancel: () => void;
  onDemo: () => void;
  onPlaybooks: () => void;
  health: Health | null;
  uploading: boolean;
  running: boolean;
  demoLoading: boolean;
  error: string;
}

export default function Start(props: Props) {
  const {
    workflow,
    onWorkflow,
    documents,
    libraryDocuments,
    onSelectDocuments,
    onUpload,
    onRemove,
    onReorder,
    context,
    onContext,
    model,
    effort,
    models,
    onModel,
    onEffort,
    playbooks,
    playbookId,
    onPlaybook,
    research,
    onResearch,
    onRun,
    onCancel,
    onDemo,
    onPlaybooks,
    health,
    uploading,
    running,
    demoLoading,
    error,
  } = props;
  const current = WORKFLOWS.find((item) => item.id === workflow)!;
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState(false);
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const contextWithoutPreset = COMPLIANCE_TASKS.reduce(
    (value, task) =>
      value === task.prompt || value.startsWith(`${task.prompt}\n\n`)
        ? value.slice(task.prompt.length).trimStart()
        : value,
    context,
  );
  return (
    <div className="start-page">
      <div className="start-intro">
        <div className="eyebrow">
          <span className="tiny-square" /> IHR JURISTISCHER ARBEITSRAUM
        </div>
        <h1>
          Mehr Klarheit.
          <br />
          <span>Für Ihr nächstes Argument.</span>
        </h1>
        <p>
          Dokumente verstehen, Risiken einordnen, Entscheidungen vorbereiten.
          <br className="desktop-break" /> Mit Quellen, die Sie selbst prüfen können.
        </p>
        {!health?.api_configured && (
          <button
            className="text-button intro-demo-link"
            onClick={onDemo}
            disabled={demoLoading || running}
          >
            {demoLoading ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}
            Beispiel öffnen<span>Ohne API-Schlüssel</span>
          </button>
        )}
      </div>
      <section
        className="analysis-composer"
        aria-label="Neue Analyse"
        onDragEnter={(event) => {
          event.preventDefault();
          dragCounter.current++;
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCounter.current--;
          if (dragCounter.current === 0) setDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dragCounter.current = 0;
          setDragging(false);
          if (!running && !uploading) onUpload(event.dataTransfer.files);
        }}
      >
        {dragging && (
          <div className="drop-overlay">
            <Paperclip size={28} />
            <strong>Dokumente hier ablegen</strong>
            <span>PDF, DOCX, TXT oder Markdown</span>
          </div>
        )}
        <div className="composer-heading">
          <span className="workflow-badge">
            <current.icon size={15} />
            {current.title}
          </span>
          <span className="composer-step">01 — Unterlagen & Auftrag</span>
        </div>
        {workflow === 'compliance' && (
          <div className="compliance-presets" role="group" aria-label="Datenschutz-Prüffokus">
            {COMPLIANCE_TASKS.map((task) => (
              <button
                key={task.label}
                type="button"
                aria-pressed={context.startsWith(task.prompt)}
                disabled={running || task.prompt.length + contextWithoutPreset.length + 2 > 20000}
                onClick={() => {
                  onContext(
                    `${task.prompt}${contextWithoutPreset ? `\n\n${contextWithoutPreset}` : ''}`,
                  );
                  textInput.current?.focus();
                }}
              >
                {task.label}
                <ArrowRight size={12} />
              </button>
            ))}
          </div>
        )}
        <label className="sr-only" htmlFor="analysis-context">
          Prüfauftrag und Perspektive
        </label>
        <textarea
          ref={textInput}
          id="analysis-context"
          className="context-input"
          value={context}
          onChange={(event) => onContext(event.target.value)}
          placeholder={current.prompt}
          disabled={running}
          maxLength={20000}
          rows={3}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          multiple
          className="sr-only"
          aria-label="Dokumente auswählen"
          onChange={(event) => {
            if (event.target.files) onUpload(event.target.files);
            event.target.value = '';
          }}
          disabled={uploading || running}
        />
        {documents.length > 0 && (
          <div className="uploaded-documents">
            {documents.map((doc, index) => (
              <div className="document-chip" key={doc.id}>
                <div className="document-chip-icon">
                  <FileText size={18} />
                </div>
                <div>
                  <span>{doc.name}</span>
                  <small>
                    {workflow === 'compare'
                      ? index === 0
                        ? '01 · Original'
                        : index === 1
                          ? '02 · Gegenentwurf'
                          : 'Zusätzliches Dokument'
                      : `${doc.page_count ? `${doc.page_count} ${doc.page_count === 1 ? 'Seite' : 'Seiten'}` : `${doc.char_count.toLocaleString('de-DE')} Zeichen`} · bereit`}
                  </small>
                </div>
                <button
                  type="button"
                  className="icon-button small"
                  onClick={() => onRemove(doc.id)}
                  disabled={running}
                  aria-label={`${doc.name} aus Auswahl entfernen`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {workflow === 'compare' && documents.length === 2 && (
              <button className="text-button reorder-button" onClick={onReorder} disabled={running}>
                <ArrowDown size={13} /> Reihenfolge tauschen
              </button>
            )}
          </div>
        )}
        <div className="composer-toolbar">
          <div className="composer-document-actions">
            <button
              className="attach-button"
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || running}
            >
              {uploading ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}
              <span>
                {uploading
                  ? 'Wird eingelesen …'
                  : documents.length
                    ? 'Hinzufügen'
                    : 'Dokumente hinzufügen'}
              </span>
            </button>
            {libraryDocuments.length > 0 && (
              <button
                className="text-button library-button"
                type="button"
                onClick={() => setDocumentPickerOpen(true)}
                disabled={uploading || running}
              >
                Gespeicherte auswählen
              </button>
            )}
          </div>
          <div className="composer-toolbar-right">
            <button
              className={`icon-button options-toggle ${options ? 'active' : ''}`}
              onClick={() => setOptions(!options)}
              disabled={running}
              aria-expanded={options}
              aria-controls="analysis-options"
              aria-label="Prüfoptionen"
            >
              <ChevronDown size={18} />
            </button>
            <ModelPicker
              models={models}
              model={model}
              effort={effort}
              onModel={onModel}
              onEffort={onEffort}
              disabled={running}
            />
            <button
              className="run-button"
              type="button"
              aria-label="Analyse starten"
              title="Analyse starten"
              onClick={onRun}
              disabled={uploading || running}
            >
              {running ? <LoaderCircle className="spin" size={19} /> : <ArrowUp size={20} />}
            </button>
          </div>
        </div>
        {options && (
          <div className="composer-options" id="analysis-options">
            <label className="field-label">
              Kanzlei-Playbook
              <select
                value={playbookId}
                onChange={(event) => onPlaybook(event.target.value)}
                disabled={running}
              >
                <option value="">Ohne Playbook</option>
                {playbooks.map((playbook) => (
                  <option key={playbook.id} value={playbook.id}>
                    {playbook.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="research-option">
              <input
                type="checkbox"
                checked={research}
                onChange={(event) => onResearch(event.target.checked)}
                disabled={running}
              />
              <span>
                <strong>Webrecherche einbeziehen</strong>
                <small>
                  Ergänzt externe Quellen. Suchanfragen können Dokumentinhalte enthalten.
                </small>
              </span>
            </label>
          </div>
        )}
        {error && (
          <div className="composer-error">
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        )}
        {running && (
          <div className="analysis-progress" role="status">
            <span />
            <div>
              <strong>Ihre Unterlagen werden geprüft.</strong>
              <small>
                Eine gründliche Analyse kann einige Minuten dauern. Sie können diese Ansicht
                geöffnet lassen.
              </small>
            </div>
            <button className="text-button" onClick={onCancel}>
              Warten abbrechen
            </button>
          </div>
        )}
      </section>
      <div className="composer-footnote">
        <span>
          <ShieldCheck size={13} /> Dokumente bleiben bis zum Analysestart auf diesem Server.
        </span>
        <span>PDF, DOCX, TXT, MD</span>
      </div>
      <section className="workflow-section" aria-labelledby="workflow-heading">
        <div className="section-label">
          <h2 id="workflow-heading">Womit möchten Sie beginnen?</h2>
          <span>Ein Auftrag. Ein klarer Fokus.</span>
        </div>
        <div className="workflow-grid">
          {WORKFLOWS.map((item) => (
            <button
              key={item.id}
              className={`workflow-card ${workflow === item.id ? 'selected' : ''}`}
              onClick={() => {
                onWorkflow(item.id);
                textInput.current?.focus({ preventScroll: true });
              }}
              aria-pressed={workflow === item.id}
              disabled={running || uploading}
            >
              <div className="workflow-card-top">
                <item.icon size={20} strokeWidth={1.45} />
                {workflow === item.id ? (
                  <span className="selection-check">
                    <Check size={11} />
                  </span>
                ) : (
                  <ArrowUpRightTiny />
                )}
              </div>
              <h3>{item.short}</h3>
              <p>{item.description}</p>
            </button>
          ))}
          <button className="workflow-card" onClick={onPlaybooks} disabled={running || uploading}>
            <div className="workflow-card-top">
              <BookOpen size={20} strokeWidth={1.45} />
              <ArrowUpRightTiny />
            </div>
            <h3>Kanzleiwissen einbinden</h3>
            <p>Ihre Standards. In jeder Prüfung.</p>
          </button>
        </div>
      </section>
      <section className="demo-section" aria-labelledby="demo-heading">
        <div className="demo-copy">
          <span className="eyebrow">VOM DOKUMENT ZUR ENTSCHEIDUNG</span>
          <h2 id="demo-heading">
            Die Fundstelle.
            <br />
            Der Kontext. Ihr Urteil.
          </h2>
          <p>
            Erkunden Sie eine Vertragsprüfung mit Risiken, Belegen und Formulierungsvorschlägen.
          </p>
          <button className="demo-button" onClick={onDemo} disabled={demoLoading || running}>
            {demoLoading ? <LoaderCircle className="spin" size={16} /> : <ScanLine size={16} />}
            {demoLoading ? 'Beispiel wird geöffnet …' : 'Beispiel erkunden'}
            <ArrowRight size={16} />
          </button>
          <span className="demo-disclaimer">Fiktiver Mustervertrag · ohne API-Aufruf</span>
        </div>
        <motion.div
          className="demo-preview"
          aria-hidden="true"
          whileHover={reducedMotion ? undefined : { y: -3 }}
          transition={{ type: 'spring', stiffness: 250, damping: 24 }}
        >
          <div className="preview-paper">
            <div className="preview-paper-top">
              <span>DIENSTLEISTUNGSVERTRAG</span>
              <FileText size={15} />
            </div>
            <div className="preview-line long" />
            <div className="preview-line" />
            <div className="preview-paper-title">§ 8 · Haftung</div>
            <div className="preview-highlight">
              Die Haftung des Auftragnehmers ist
              <br />
              in allen Fällen ausgeschlossen.
            </div>
            <div className="preview-line long" />
            <div className="preview-line medium" />
          </div>
          <div className="preview-finding">
            <div>
              <span className="severity-dot high" />
              <span>Hohe Priorität</span>
              <span className="preview-number">01</span>
            </div>
            <strong>Haftungsausschluss zu weit gefasst</strong>
            <p>Die Klausel verdient eine genauere Prüfung.</p>
            <span className="preview-source">
              <Check size={12} />
              Mit Fundstelle im Dokument
            </span>
          </div>
        </motion.div>
      </section>
      {documentPickerOpen && (
        <DocumentPicker
          documents={libraryDocuments}
          selectedIds={documents.map((document) => document.id)}
          compare={workflow === 'compare'}
          onApply={(ids) => {
            onSelectDocuments(ids);
            setDocumentPickerOpen(false);
          }}
          onClose={() => setDocumentPickerOpen(false)}
        />
      )}
      <footer className="start-footer">
        <span>Vorbereitet mit KI. Entschieden durch Sie.</span>
        {health && (
          <span className="connection-note">
            <span className={`status-dot ${health.api_configured ? 'connected' : ''}`} />
            {health.api_configured ? 'API konfiguriert' : 'Beispielmodus verfügbar'}
          </span>
        )}
      </footer>
    </div>
  );
}

function ArrowUpRightTiny() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="workflow-arrow"
    >
      <path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
