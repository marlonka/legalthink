import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  FileText,
  LoaderCircle,
  Paperclip,
  Plus,
  X,
} from 'lucide-react';
import { ErrorMessage, ModelPicker } from './ui';
import DocumentPicker from './DocumentPicker';
import { WORKFLOWS } from './workflows';
import type { DocumentRecord, Model, Playbook, Workflow } from './types';

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
  const contextWithoutPreset = COMPLIANCE_TASKS.reduce(
    (value, task) =>
      value === task.prompt || value.startsWith(`${task.prompt}\n\n`)
        ? value.slice(task.prompt.length).trimStart()
        : value,
    context,
  );
  return (
    <div className="start-page">
      <header className="analysis-start-heading">
        <h1>Neue Analyse</h1>
        <button className="text-button" onClick={onDemo} disabled={demoLoading || running}>
          {demoLoading && <LoaderCircle className="spin" size={14} />}
          Beispiel öffnen
          <ArrowRight size={14} />
        </button>
      </header>
      <div className="workflow-selector" role="group" aria-label="Prüfungsart">
        {WORKFLOWS.map((item) => (
          <button
            key={item.id}
            onClick={() => onWorkflow(item.id)}
            aria-pressed={workflow === item.id}
            disabled={running || uploading}
          >
            <item.icon size={17} strokeWidth={1.6} />
            {item.short}
          </button>
        ))}
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
        <div className="document-input-heading">
          <div className="composer-document-actions">
            <button
              className="button secondary"
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || running}
            >
              {uploading ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}
              {uploading ? 'Wird eingelesen …' : 'Dokumente hinzufügen'}
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
          <span>PDF, DOCX, TXT, MD · max. 12 MB pro Datei</span>
          {workflow === 'compare' && (
            <p className="comparison-order-note">
              Zwei Dokumente: zuerst Original, dann Gegenentwurf.
            </p>
          )}
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
        <label className="context-label" htmlFor="analysis-context">
          Prüfauftrag <span>(optional)</span>
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
          rows={4}
        />
        {!options && (research || playbookId) && (
          <p className="active-options" aria-live="polite">
            {[
              playbookId
                ? `Playbook: ${playbooks.find((item) => item.id === playbookId)?.name ?? 'Ausgewählt'}`
                : '',
              research ? 'Webrecherche aktiv' : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p className="analysis-data-note" id="analysis-data-note">
          Beim Start werden die ausgewählten Inhalte an OpenAI gesendet.
        </p>
        <div className="composer-toolbar">
          <button
            className={`text-button options-toggle ${options ? 'active' : ''}`}
            onClick={() => setOptions(!options)}
            disabled={running}
            aria-expanded={options}
            aria-controls="analysis-options"
          >
            Prüfoptionen
            <ChevronDown size={15} />
          </button>
          <div className="composer-toolbar-right">
            <ModelPicker
              models={models}
              model={model}
              effort={effort}
              onModel={onModel}
              onEffort={onEffort}
              disabled={running}
            />
            <button
              className="button primary run-analysis-button"
              type="button"
              aria-label="Analyse starten"
              aria-describedby="analysis-data-note"
              title="Analyse starten"
              onClick={onRun}
              disabled={uploading || running}
            >
              {running ? <LoaderCircle className="spin" size={16} /> : null}
              Analyse starten
              <ArrowRight size={15} />
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
                <small>Suchanfragen können Dokumentinhalte enthalten.</small>
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
              <strong>Analyse läuft …</strong>
              <small>Das Ergebnis wird nach Abschluss gespeichert.</small>
            </div>
            <button className="text-button" onClick={onCancel}>
              Warten abbrechen
            </button>
          </div>
        )}
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
    </div>
  );
}
