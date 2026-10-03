import { useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  LoaderCircle,
  Monitor,
  Moon,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Analysis, DocumentRecord, Health, Model, Playbook } from './types';
import type { ThemePreference } from './theme';
import { api } from './types';
import { dateLabel, ErrorMessage, ExternalLink, Modal, ModelPicker } from './ui';
import { workflowName } from './workflows';
import { MotionButton } from './motion';

export function History({
  analyses,
  loading,
  onOpen,
  onNew,
  onDelete,
}: {
  analyses: Analysis[];
  loading: boolean;
  onOpen: (analysis: Analysis) => void;
  onNew: () => void;
  onDelete: (analysis: Analysis) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = analyses.filter((item) =>
    `${item.title} ${workflowName(item.workflow)}`
      .toLocaleLowerCase('de-DE')
      .includes(search.toLocaleLowerCase('de-DE')),
  );
  return (
    <div className="standard-page">
      <header className="standard-page-header">
        <div className="page-heading-row">
          <div>
            <h1>Analysen</h1>
          </div>
          <MotionButton className="button primary" onClick={onNew}>
            <Plus size={16} />
            Neue Analyse
          </MotionButton>
        </div>
      </header>
      <div className="list-toolbar">
        <label className="list-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Analysen durchsuchen …"
            aria-label="Analysen durchsuchen"
          />
          {search && (
            <MotionButton
              className="icon-button small"
              onClick={() => setSearch('')}
              aria-label="Suche zurücksetzen"
            >
              <X size={14} />
            </MotionButton>
          )}
        </label>
        <span>
          {analyses.length} {analyses.length === 1 ? 'Analyse' : 'Analysen'}
        </span>
      </div>
      {loading ? (
        <div className="loading-state" role="status">
          <LoaderCircle size={22} className="spin" />
          Analysen werden geladen …
        </div>
      ) : filtered.length ? (
        <div className="history-list">
          {filtered.map((analysis) => (
            <article className="history-item" key={analysis.id}>
              <MotionButton className="history-item-main" onClick={() => onOpen(analysis)}>
                <span className="history-icon">
                  <FileText size={21} strokeWidth={1.4} />
                </span>
                <span className="history-item-title">
                  <strong>{analysis.title}</strong>
                  <span>
                    {workflowName(analysis.workflow)}
                    <i />
                    {dateLabel(analysis.created_at)}
                    {analysis.is_demo && (
                      <>
                        <i />
                        <span className="sample-label">Beispiel</span>
                      </>
                    )}
                  </span>
                </span>
                <span className="history-findings">
                  {analysis.findings.length} Befunde
                  <ChevronRight size={16} />
                </span>
              </MotionButton>
              <MotionButton
                className="icon-button delete-hover"
                onClick={() => onDelete(analysis)}
                aria-label={`${analysis.title} löschen`}
              >
                <Trash2 size={15} />
              </MotionButton>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state large">
          <div className="empty-state-icon">
            <Clock3 size={29} strokeWidth={1.3} />
          </div>
          <h2>{search ? 'Keine Analysen gefunden' : 'Noch keine Analysen'}</h2>
        </div>
      )}
    </div>
  );
}

export function Playbooks({
  playbooks,
  onCreate,
  onUpdate,
  onDelete,
  onDocumentImported,
  error,
}: {
  playbooks: Playbook[];
  onCreate: (name: string, content: string) => Promise<void>;
  onUpdate?: (id: string, name: string, content: string) => Promise<void>;
  onDelete: (playbook: Playbook) => void;
  onDocumentImported?: (document: DocumentRecord) => void;
  error: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  async function save() {
    if (!name.trim() || !content.trim()) {
      setFormError('Geben Sie einen Namen und mindestens eine Prüfvorgabe ein.');
      return;
    }
    if (content.trim().length > 30000) {
      setFormError(
        'Das Playbook darf höchstens 30.000 Zeichen enthalten. Kürzen Sie die importierten Vorgaben vor dem Speichern.',
      );
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId && onUpdate) await onUpdate(editingId, name.trim(), content.trim());
      else await onCreate(name.trim(), content.trim());
      setOpen(false);
      setName('');
      setContent('');
      setEditingId(null);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Das Playbook konnte nicht gespeichert werden.',
      );
    } finally {
      setSaving(false);
    }
  }
  async function importFile(file: File) {
    setImporting(true);
    setFormError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const document = await api<DocumentRecord>('/documents', { method: 'POST', body: form });
      onDocumentImported?.(document);
      setContent(document.text);
      if (document.text.length > 30000)
        setFormError(
          'Das importierte Dokument enthält mehr als 30.000 Zeichen. Der vollständige Text ist unten editierbar; kürzen Sie ihn vor dem Speichern.',
        );
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Das Dokument konnte nicht eingelesen werden.',
      );
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="standard-page">
      <header className="standard-page-header">
        <div className="page-heading-row">
          <div>
            <h1>Kanzlei-Playbooks</h1>
            <p>Prüfvorgaben speichern und vor einer Analyse auswählen.</p>
          </div>
          <MotionButton
            className="button primary"
            onClick={() => {
              setEditingId(null);
              setName('');
              setContent('');
              setOpen(true);
              setFormError('');
            }}
          >
            <Plus size={16} />
            Playbook erstellen
          </MotionButton>
        </div>
      </header>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {playbooks.length ? (
        <div className="playbooks-grid">
          {playbooks.map((playbook) => (
            <article className="playbook-card" key={playbook.id}>
              <MotionButton onClick={() => setSelected(playbook)} className="playbook-card-content">
                <div>
                  <BookOpen size={22} strokeWidth={1.4} />
                  <ArrowUpRight size={15} />
                </div>
                <h2>{playbook.name}</h2>
                <p>{playbook.content}</p>
              </MotionButton>
              <footer>
                <span>{playbook.content.length.toLocaleString('de-DE')} Zeichen</span>
                <MotionButton
                  className="icon-button small"
                  aria-label={`${playbook.name} löschen`}
                  onClick={() => onDelete(playbook)}
                >
                  <Trash2 size={14} />
                </MotionButton>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state large">
          <div className="empty-state-icon">
            <BookOpen size={29} strokeWidth={1.3} />
          </div>
          <h2>Noch keine Playbooks</h2>
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <Modal
            key="playbook-editor"
            title={editingId ? 'Playbook bearbeiten' : 'Neues Playbook'}
            onClose={() => {
              if (!saving && !importing) setOpen(false);
            }}
            wide
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="modal-body">
                <label className="field-label">
                  Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="z. B. SaaS-Verträge · Auftraggeber"
                    maxLength={120}
                    autoFocus
                    required
                    disabled={saving}
                  />
                </label>
                <div className="field-label-row">
                  <label htmlFor="playbook-content">Prüfvorgaben</label>
                  <MotionButton
                    className="text-button"
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={importing || saving}
                  >
                    {importing ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}
                    Dokument importieren
                  </MotionButton>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  className="sr-only"
                  accept=".pdf,.docx,.txt,.md"
                  aria-label="Playbook-Dokument importieren"
                  onChange={(event) => {
                    if (event.target.files?.[0]) void importFile(event.target.files[0]);
                    event.target.value = '';
                  }}
                />
                <textarea
                  id="playbook-content"
                  className="playbook-textarea"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={
                    'Unsere Perspektive: Auftraggeber\n\nHaftung: …\nKündigung: …\nSprache und Stil: …'
                  }
                  rows={11}
                  maxLength={30000}
                  required
                  disabled={saving || importing}
                />
                <p className="field-help">
                  PDF, DOCX, TXT oder Markdown. Importierte Unterlagen werden auf diesem Server
                  gespeichert und können unter Einstellungen gelöscht werden.
                </p>
                {formError && <ErrorMessage>{formError}</ErrorMessage>}
              </div>
              <div className="modal-footer">
                <MotionButton
                  className="button secondary"
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={saving || importing}
                >
                  Abbrechen
                </MotionButton>
                <MotionButton
                  className="button primary"
                  type="submit"
                  disabled={saving || importing}
                >
                  {saving && <LoaderCircle className="spin" size={15} />}Playbook speichern
                </MotionButton>
              </div>
            </form>
          </Modal>
        )}
        {selected && (
          <Modal
            key="playbook-preview"
            title={selected.name}
            onClose={() => setSelected(null)}
            wide
          >
            <div className="modal-body">
              <div className="playbook-read-content">{selected.content}</div>
            </div>
            <div className="modal-footer">
              {onUpdate && (
                <MotionButton
                  className="button secondary"
                  onClick={() => {
                    setName(selected.name);
                    setContent(selected.content);
                    setEditingId(selected.id);
                    setSelected(null);
                    setOpen(true);
                    setFormError('');
                  }}
                >
                  Bearbeiten
                </MotionButton>
              )}
              <MotionButton
                className="button secondary"
                onClick={() => {
                  setEditingId(null);
                  setName(`${selected.name} · Variante`);
                  setContent(selected.content);
                  setSelected(null);
                  setOpen(true);
                }}
              >
                Duplizieren
              </MotionButton>
              <MotionButton className="button primary" onClick={() => setSelected(null)}>
                Schließen
              </MotionButton>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Settings({
  themePreference,
  onThemePreference,
  health,
  models,
  model,
  effort,
  onModel,
  onEffort,
  documents,
  onDeleteDocument,
  onDeleteAllDocuments,
  onRefresh,
  refreshing,
}: {
  themePreference: ThemePreference;
  onThemePreference: (preference: ThemePreference) => void;
  health: Health | null;
  models: Model[];
  model: string;
  effort: string;
  onModel: (value: string) => void;
  onEffort: (value: string) => void;
  documents: DocumentRecord[];
  onDeleteDocument: (document: DocumentRecord) => void;
  onDeleteAllDocuments: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="standard-page settings-page">
      <header className="standard-page-header">
        <h1>Einstellungen</h1>
      </header>
      <section
        className="settings-section appearance-settings"
        aria-labelledby="appearance-heading"
      >
        <div className="settings-section-heading">
          <h2 id="appearance-heading">Erscheinungsbild</h2>
        </div>
        <div className="appearance-row">
          <span id="appearance-mode">Modus</span>
          <div
            className="theme-options motion-theme-options"
            role="radiogroup"
            aria-labelledby="appearance-mode"
          >
            {(
              [
                { value: 'system', label: 'System', icon: Monitor },
                { value: 'light', label: 'Hell', icon: Sun },
                { value: 'dark', label: 'Dunkel', icon: Moon },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <label className="theme-option" key={value}>
                {themePreference === value && (
                  <span aria-hidden="true" className="theme-selection-surface" />
                )}
                <input
                  type="radio"
                  name="appearance"
                  value={value}
                  checked={themePreference === value}
                  onChange={() => onThemePreference(value)}
                />
                <Icon
                  className="theme-option-icon"
                  size={18}
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <span className="theme-option-label">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <Server size={20} strokeWidth={1.4} />
          <div>
            <h2>OpenAI API</h2>
          </div>
          <span className={`connection-badge ${health?.api_configured ? 'connected' : ''}`}>
            <span className="status-dot" />
            {health?.api_configured
              ? 'Schlüssel hinterlegt'
              : health
                ? 'Nicht eingerichtet'
                : 'Nicht erreichbar'}
          </span>
        </div>
        {!health?.api_configured && (
          <div className="setup-instructions">
            <p>Für Analysen wird ein OpenAI-API-Schlüssel benötigt.</p>
            <ol>
              <li>
                Tragen Sie <code>OPENAI_API_KEY</code> in <code>backend/.env</code> ein.
              </li>
              <li>Starten Sie den Server neu und aktualisieren Sie den Status.</li>
            </ol>
            <p className="field-help">Das Beispiel funktioniert ohne API-Schlüssel.</p>
          </div>
        )}
        <MotionButton
          className="button secondary small-button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}Status
          aktualisieren
        </MotionButton>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <BookOpen size={20} strokeWidth={1.4} />
          <div>
            <h2>Modell und Denkaufwand</h2>
            <p>Voreinstellung für neue Analysen. In diesem Browser gespeichert.</p>
          </div>
        </div>
        <div className="settings-model-row">
          <ModelPicker
            models={models}
            model={model}
            effort={effort}
            onModel={onModel}
            onEffort={onEffort}
          />
          <span>Höherer Denkaufwand kann Dauer und Kosten erhöhen.</span>
        </div>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <ShieldCheck size={20} strokeWidth={1.4} />
          <div>
            <h2>Datenverarbeitung</h2>
          </div>
        </div>
        <div className="privacy-facts">
          <div>
            <span>01</span>
            <p>Dokumente, Playbooks und Ergebnisse werden auf diesem Server gespeichert.</p>
          </div>
          <div>
            <span>02</span>
            <p>
              Beim Analysestart werden die ausgewählten Inhalte an die OpenAI API übertragen.
              API-Anfragen verwenden <code>store: false</code>; dies ist keine Zusage einer
              vollständigen Löschung durch den Anbieter.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              Aktivierte Webrecherche kann Inhalte aus Ihrem Auftrag in Suchanfragen einbeziehen.
              Klären Sie die Zulässigkeit für Ihre Unterlagen vorab.
            </p>
          </div>
        </div>
        <ExternalLink url="https://platform.openai.com/docs/guides/your-data">
          Datenverarbeitung bei OpenAI
        </ExternalLink>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading settings-documents-heading">
          <FolderOpen size={20} strokeWidth={1.4} />
          <div>
            <h2>Gespeicherte Dokumente</h2>
            <p>
              {documents.length} {documents.length === 1 ? 'Dokument' : 'Dokumente'} auf diesem
              Server. Löschen entfernt den gespeicherten Volltext.
            </p>
          </div>
          <MotionButton
            className="icon-button delete-all-documents"
            onClick={onDeleteAllDocuments}
            disabled={!documents.length}
            aria-label="Alle gespeicherten Dokumente löschen"
            title="Alle gespeicherten Dokumente löschen"
          >
            <Trash2 size={18} aria-hidden="true" />
          </MotionButton>
        </div>
        {documents.length ? (
          <div className="document-management-list">
            {documents.map((document) => (
              <div className="managed-document" key={document.id}>
                <FileText size={17} />
                <div>
                  <strong>{document.name}</strong>
                  <small>{document.char_count.toLocaleString('de-DE')} Zeichen</small>
                </div>
                <MotionButton
                  className="icon-button"
                  onClick={() => onDeleteDocument(document)}
                  aria-label={`${document.name} endgültig löschen`}
                >
                  <Trash2 size={15} />
                </MotionButton>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Noch keine Dokumente gespeichert.</p>
        )}
        <p className="field-help">
          Bereits gespeicherte Analyseberichte können weiterhin Zitate aus gelöschten Dokumenten
          enthalten. Löschen Sie bei Bedarf auch die zugehörigen Analysen.
        </p>
      </section>
    </div>
  );
}
