import { forwardRef, useId, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useIsPresent } from 'motion/react';
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
import { Collapse, MotionButton, useMotionPreferences } from './motion';
import './composer-motion.css';

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
  const workflowMotionId = useId();
  const documentMotionId = useId();
  const { reduced, transition } = useMotionPreferences();
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
        <MotionButton className="text-button" onClick={onDemo} disabled={demoLoading || running}>
          {demoLoading && <LoaderCircle className="spin" size={14} />}
          Beispiel öffnen
          <ArrowRight size={14} />
        </MotionButton>
      </header>
      <LayoutGroup id={workflowMotionId}>
        <div className="workflow-selector motion-workflows" role="group" aria-label="Prüfungsart">
          {WORKFLOWS.map((item) => (
            <button
              key={item.id}
              onClick={() => onWorkflow(item.id)}
              aria-pressed={workflow === item.id}
              title={item.short}
              disabled={running || uploading}
            >
              {workflow === item.id && (
                <motion.span
                  className="workflow-selection-surface"
                  layoutId={reduced ? undefined : 'workflow-selection'}
                  initial={false}
                  transition={transition('control')}
                  aria-hidden="true"
                />
              )}
              <item.icon size={17} strokeWidth={1.6} />
              <span className="workflow-option-label">{item.label}</span>
            </button>
          ))}
        </div>
      </LayoutGroup>
      <section
        className="analysis-composer"
        aria-label="Neue Analyse"
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes('Files') || running || uploading) return;
          event.preventDefault();
          dragCounter.current++;
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragCounter.current = Math.max(0, dragCounter.current - 1);
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
        <AnimatePresence initial={false}>
          {dragging && !running && !uploading && (
            <motion.div
              className="drop-overlay composer-drop-feedback"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition('fade')}
            >
              <motion.div
                className="composer-drop-perimeter"
                initial={reduced ? false : { scale: 0.986 }}
                animate={{ scale: 1 }}
                transition={transition('control')}
                aria-hidden="true"
              />
              <motion.div
                className="composer-drop-icon"
                initial={reduced ? false : { y: -4, rotate: -6 }}
                animate={{ y: 0, rotate: 0 }}
                transition={transition('control')}
                aria-hidden="true"
              >
                <Paperclip size={28} />
              </motion.div>
              <strong>Dokumente hier ablegen</strong>
              <span>PDF, DOCX, TXT oder Markdown</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="document-input-heading">
          <div className="composer-document-actions">
            <MotionButton
              className="button secondary"
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || running}
            >
              {uploading ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}
              {uploading ? 'Wird eingelesen …' : 'Dokumente hinzufügen'}
            </MotionButton>
            {libraryDocuments.length > 0 && (
              <MotionButton
                className="text-button library-button"
                type="button"
                onClick={() => setDocumentPickerOpen(true)}
                disabled={uploading || running}
              >
                Gespeicherte auswählen
              </MotionButton>
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
              <MotionButton
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
              </MotionButton>
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
        <Collapse open={documents.length > 0} className="composer-documents-collapse">
          <LayoutGroup id={documentMotionId}>
            <div className="uploaded-documents motion-document-list">
              <AnimatePresence initial={false} mode="popLayout">
                {documents.map((doc, index) => (
                  <ComposerDocument
                    key={doc.id}
                    document={doc}
                    index={index}
                    compare={workflow === 'compare'}
                    running={running}
                    onRemove={onRemove}
                  />
                ))}
              </AnimatePresence>
              {workflow === 'compare' && documents.length === 2 && (
                <MotionButton
                  className="text-button reorder-button"
                  onClick={onReorder}
                  disabled={running}
                >
                  <ArrowDown size={13} /> Reihenfolge tauschen
                </MotionButton>
              )}
            </div>
          </LayoutGroup>
        </Collapse>
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
          <MotionButton
            className={`text-button options-toggle ${options ? 'active' : ''}`}
            onClick={() => setOptions(!options)}
            disabled={running}
            aria-expanded={options}
            aria-controls="analysis-options"
          >
            Prüfoptionen
            <motion.span
              className="composer-disclosure-icon"
              initial={false}
              animate={{ rotate: options ? 180 : 0 }}
              transition={transition('control')}
              aria-hidden="true"
            >
              <ChevronDown size={15} />
            </motion.span>
          </MotionButton>
          <div className="composer-toolbar-right">
            <ModelPicker
              models={models}
              model={model}
              effort={effort}
              onModel={onModel}
              onEffort={onEffort}
              disabled={running}
            />
            <MotionButton
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
            </MotionButton>
          </div>
        </div>
        <Collapse open={options} id="analysis-options" className="composer-options-collapse">
          <div className="composer-options">
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
        </Collapse>
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
            <MotionButton className="text-button" onClick={onCancel}>
              Warten abbrechen
            </MotionButton>
          </div>
        )}
      </section>
      <AnimatePresence initial={false}>
        {documentPickerOpen && (
          <DocumentPicker
            key="document-picker"
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
      </AnimatePresence>
    </div>
  );
}

const ComposerDocument = forwardRef<
  HTMLDivElement,
  {
    document: DocumentRecord;
    index: number;
    compare: boolean;
    running: boolean;
    onRemove: (id: string) => void;
  }
>(function ComposerDocument({ document, index, compare, running, onRemove }, ref) {
  const present = useIsPresent();
  const { reduced, transition } = useMotionPreferences();
  return (
    <motion.div
      ref={ref}
      className="document-chip"
      layout={reduced ? false : 'position'}
      initial={reduced ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -2 }}
      transition={{
        layout: transition('layout'),
        y: transition('control'),
        opacity: transition('fade'),
      }}
      inert={!present}
      aria-hidden={!present || undefined}
    >
      <div className="document-chip-icon">
        <FileText size={18} />
      </div>
      <div>
        <span>{document.name}</span>
        <small>
          {compare
            ? index === 0
              ? '01 · Original'
              : index === 1
                ? '02 · Gegenentwurf'
                : 'Zusätzliches Dokument'
            : `${document.page_count ? `${document.page_count} ${document.page_count === 1 ? 'Seite' : 'Seiten'}` : `${document.char_count.toLocaleString('de-DE')} Zeichen`} · bereit`}
        </small>
      </div>
      <MotionButton
        className="icon-button small"
        onClick={(event) => {
          const button = event.currentTarget;
          const buttons = Array.from(
            button
              .closest('.uploaded-documents')
              ?.querySelectorAll<HTMLButtonElement>(
                '.document-chip:not([inert]) button:not(:disabled)',
              ) ?? [],
          );
          const position = buttons.indexOf(button);
          const next = buttons[position + 1] ?? buttons[position - 1];
          onRemove(document.id);
          (next ?? button.ownerDocument.getElementById('analysis-context'))?.focus({
            preventScroll: true,
          });
        }}
        disabled={running || !present}
        aria-label={`${document.name} aus Auswahl entfernen`}
      >
        <X size={14} />
      </MotionButton>
    </motion.div>
  );
});
