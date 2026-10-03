import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { COMPLIANCE_TASKS, WORKFLOWS } from './workflows';
import type { ComplianceTask, DocumentRecord, Model, Playbook, Workflow } from './types';
import { MAX_MATERIAL_CHARS } from './types';
import { Collapse, MotionButton, useMotionPreferences } from './motion';
import './composer-motion.css';

interface Props {
  workflow: Workflow;
  onWorkflow: (value: Workflow) => void;
  complianceTask: ComplianceTask;
  onComplianceTask: (value: ComplianceTask) => void;
  documents: DocumentRecord[];
  comparisonIds: string[];
  libraryDocuments: DocumentRecord[];
  onSelectDocuments: (ids: string[]) => void;
  onUpload: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onReorder: () => void;
  context: string;
  onContext: (value: string) => void;
  sourceText: string;
  onSourceText: (value: string) => void;
  materialCharCount: number;
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
    complianceTask,
    onComplianceTask,
    documents,
    comparisonIds,
    libraryDocuments,
    onSelectDocuments,
    onUpload,
    onRemove,
    onReorder,
    context,
    onContext,
    sourceText,
    onSourceText,
    materialCharCount,
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
  const currentCompliance = COMPLIANCE_TASKS.find((item) => item.id === complianceTask)!;
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const dragCounter = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState(false);
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const { reduced, transition } = useMotionPreferences();
  return (
    <div className="start-page">
      <header className="analysis-start-heading">
        <h1>Neue Analyse</h1>
        <MotionButton className="text-button" onClick={onDemo} disabled={demoLoading || running}>
          Beispiel öffnen
          {demoLoading ? <LoaderCircle className="spin" size={14} /> : <ArrowRight size={14} />}
        </MotionButton>
      </header>
      <div className="workflow-selector" role="group" aria-label="Prüfungsart">
        {WORKFLOWS.map((item) => (
          <button
            key={item.id}
            onClick={() => onWorkflow(item.id)}
            aria-pressed={workflow === item.id}
            title={item.short}
            disabled={running || uploading}
          >
            <item.icon size={17} strokeWidth={1.6} />
            <span className="workflow-option-label">{item.label}</span>
          </button>
        ))}
      </div>
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
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          dragCounter.current = Math.max(0, dragCounter.current - 1);
          if (dragCounter.current === 0) setDragging(false);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('Files')) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
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
              <div className="composer-drop-perimeter" aria-hidden="true" />
              <div className="composer-drop-icon" aria-hidden="true">
                <Paperclip size={28} />
              </div>
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
              <span className="composer-action-icon" aria-hidden="true">
                {uploading ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
              </span>
              <span className="stable-action-label">
                <span className="stable-action-size" aria-hidden="true">
                  Dokumente hinzufügen
                </span>
                <span>{uploading ? 'Wird eingelesen …' : 'Dokumente hinzufügen'}</span>
              </span>
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
        </div>
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
          <div className="uploaded-documents composer-document-list">
            {(workflow === 'compare'
              ? comparisonIds.map((id) => documents.find((doc) => doc.id === id))
              : documents
            ).map((doc, index) =>
              doc ? (
                <ComposerDocument
                  key={doc.id}
                  document={doc}
                  index={index}
                  compare={workflow === 'compare'}
                  running={running}
                  onRemove={onRemove}
                />
              ) : (
                <div className="document-chip empty-comparison-slot" key={`empty-${index}`}>
                  <div className="document-chip-icon">
                    <FileText size={18} />
                  </div>
                  <div>
                    <span>Nicht ausgewählt</span>
                    <small>{index === 0 ? '01 · Original' : '02 · Gegenentwurf'}</small>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        <div className="composer-source-text">
          <label className="context-label" htmlFor="analysis-source-text">
            Text oder E-Mail-Verlauf <span>(optional)</span>
          </label>
          <textarea
            id="analysis-source-text"
            className="source-text-input"
            value={sourceText}
            onChange={(event) => onSourceText(event.target.value)}
            placeholder={
              workflow === 'compare'
                ? 'Begleitende Korrespondenz oder weitere Angaben einfügen. Verglichen werden die beiden Dokumente.'
                : 'E-Mail-Verlauf, Vertragstext oder weitere Unterlagen hier einfügen.'
            }
            rows={8}
            disabled={running}
            spellCheck={false}
            aria-describedby="analysis-source-limit"
            aria-invalid={materialCharCount > MAX_MATERIAL_CHARS || undefined}
          />
          <div className="source-text-meta" id="analysis-source-limit">
            <span>Text und Dokumente zusammen</span>
            <span>
              {materialCharCount.toLocaleString('de-DE')} /{' '}
              {MAX_MATERIAL_CHARS.toLocaleString('de-DE')} Zeichen
            </span>
          </div>
        </div>
        <div className="composer-context-header">
          <label className="context-label" htmlFor="analysis-context">
            Prüfauftrag <span>(optional)</span>
          </label>
          <div
            className="composer-task-field"
            aria-hidden={workflow !== 'compliance'}
            inert={workflow !== 'compliance'}
          >
            <select
              className="composer-task-select"
              value={complianceTask}
              onChange={(event) => onComplianceTask(event.target.value as ComplianceTask)}
              aria-label="Datenschutz-Aufgabe"
              title={currentCompliance.label}
              disabled={running || uploading || workflow !== 'compliance'}
            >
              {COMPLIANCE_TASKS.map((task) => (
                <option key={task.id} value={task.id} aria-label={task.label}>
                  {task.short}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          ref={textInput}
          id="analysis-context"
          className="context-input"
          value={context}
          onChange={(event) => onContext(event.target.value)}
          placeholder={workflow === 'compliance' ? currentCompliance.prompt : current.prompt}
          disabled={running}
          maxLength={20000}
          rows={4}
        />
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
              Analyse starten
              {running ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />}
            </MotionButton>
          </div>
        </div>
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
        <Collapse open={options} id="analysis-options" className="composer-options-collapse">
          <div className="composer-options aligned-composer-options">
            <label className="field-label composer-playbook-label" htmlFor="analysis-playbook">
              Kanzlei-Playbook
            </label>
            <select
              id="analysis-playbook"
              className="composer-playbook-select"
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
            <label className="research-option">
              <input
                type="checkbox"
                checked={research}
                onChange={(event) => onResearch(event.target.checked)}
                disabled={running}
                aria-describedby="analysis-research-note"
              />
              <strong>Webrecherche einbeziehen</strong>
            </label>
            <small className="composer-research-note" id="analysis-research-note">
              Suchanfragen können Dokumentinhalte enthalten.
            </small>
          </div>
        </Collapse>
        {workflow === 'compare' && (
          <div className="composer-workflow-details comparison-details">
            <p className="comparison-order-note">
              Zwei Dokumente: zuerst Original, dann Gegenentwurf.
            </p>
            <MotionButton
              className="text-button reorder-button"
              onClick={onReorder}
              disabled={running || documents.length !== 2}
            >
              <ArrowDown size={13} /> Reihenfolge tauschen
            </MotionButton>
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
            selectedIds={
              workflow === 'compare' ? comparisonIds : documents.map((document) => document.id)
            }
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

function ComposerDocument({
  document,
  index,
  compare,
  running,
  onRemove,
}: {
  document: DocumentRecord;
  index: number;
  compare: boolean;
  running: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="document-chip">
      <div className="document-chip-icon">
        <FileText size={18} />
      </div>
      <div>
        <span title={document.name}>{document.name}</span>
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
        disabled={running}
        aria-label={`${document.name} aus Auswahl entfernen`}
      >
        <X size={14} />
      </MotionButton>
    </div>
  );
}
