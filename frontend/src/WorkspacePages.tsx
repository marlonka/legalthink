import { useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  FolderOpen,
  LoaderCircle,
  Plus,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Analysis, DocumentRecord, Health, Model, Playbook } from './types';
import { api } from './types';
import { dateLabel, ErrorMessage, ExternalLink, Modal, ModelPicker } from './ui';
import { workflowName } from './workflows';

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
        <div className="eyebrow">IHR ARBEITSRAUM</div>
        <div className="page-heading-row">
          <div>
            <h1>Ihre Analysen</h1>
            <p>Prüfungen wieder aufnehmen. Gedanken weiterführen.</p>
          </div>
          <button className="button primary" onClick={onNew}>
            <Plus size={16} />
            Neue Analyse
          </button>
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
            <button
              className="icon-button small"
              onClick={() => setSearch('')}
              aria-label="Suche zurücksetzen"
            >
              <X size={14} />
            </button>
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
              <button className="history-item-main" onClick={() => onOpen(analysis)}>
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
              </button>
              <button
                className="icon-button delete-hover"
                onClick={() => onDelete(analysis)}
                aria-label={`${analysis.title} löschen`}
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state large">
          <div className="empty-state-icon">
            <Clock3 size={29} strokeWidth={1.3} />
          </div>
          <h2>{search ? 'Keine Analysen gefunden' : 'Raum für Ihre nächste Erkenntnis.'}</h2>
          <p>
            {search
              ? 'Versuchen Sie einen anderen Suchbegriff.'
              : 'Ihre Prüfungen werden hier gespeichert. Beginnen Sie mit einem Dokument oder erkunden Sie das Beispiel.'}
          </p>
          {!search && (
            <button className="button secondary" onClick={onNew}>
              Erste Analyse vorbereiten
              <ArrowRight size={16} />
            </button>
          )}
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
        <div className="eyebrow">KANZLEIWISSEN</div>
        <div className="page-heading-row">
          <div>
            <h1>Ihre Standards. Immer dabei.</h1>
            <p>Playbooks geben Ihren Prüfungen eine gemeinsame Linie.</p>
          </div>
          <button
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
          </button>
        </div>
      </header>
      <div className="playbook-intro">
        <BookOpen size={22} strokeWidth={1.4} />
        <p>
          Halten Sie Verhandlungspositionen, Musterklauseln und Sprachregeln fest. Wählen Sie Ihr
          Playbook vor einer Analyse unter den Prüfoptionen aus.
        </p>
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {playbooks.length ? (
        <div className="playbooks-grid">
          {playbooks.map((playbook) => (
            <article className="playbook-card" key={playbook.id}>
              <button onClick={() => setSelected(playbook)} className="playbook-card-content">
                <div>
                  <BookOpen size={22} strokeWidth={1.4} />
                  <ArrowUpRight size={15} />
                </div>
                <h2>{playbook.name}</h2>
                <p>{playbook.content}</p>
              </button>
              <footer>
                <span>{playbook.content.length.toLocaleString('de-DE')} Zeichen</span>
                <button
                  className="icon-button small"
                  aria-label={`${playbook.name} löschen`}
                  onClick={() => onDelete(playbook)}
                >
                  <Trash2 size={14} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="playbook-empty">
          <div className="playbook-example">
            <span className="eyebrow">SO KÖNNTE IHR PLAYBOOK AUSSEHEN</span>
            <h3>Unsere Position als Auftraggeber</h3>
            <div>
              <Check size={15} />
              <span>Haftung bei Vorsatz und grober Fahrlässigkeit ausnehmen</span>
            </div>
            <div>
              <Check size={15} />
              <span>Kündigung und Datenherausgabe zusammen betrachten</span>
            </div>
            <div>
              <Check size={15} />
              <span>Klare, kurze Formulierungen ohne unnötige Fachsprache</span>
            </div>
            <span className="sample-label">Beispiel · noch nicht gespeichert</span>
          </div>
          <div className="playbook-empty-copy">
            <h2>
              Was macht eine gute Klausel
              <br />
              für Ihre Kanzlei aus?
            </h2>
            <p>Machen Sie aus bewährtem Wissen einen wiederverwendbaren Prüfmaßstab.</p>
            <button
              className="text-button"
              onClick={() => {
                setEditingId(null);
                setName('');
                setContent('');
                setOpen(true);
                setFormError('');
              }}
            >
              Erstes Playbook erstellen
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      {open && (
        <Modal
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
              <p className="modal-description">
                Beschreiben Sie die Standards Ihrer Kanzlei. Importieren Sie ein Muster oder
                schreiben Sie Ihre Vorgaben direkt.
              </p>
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
                <label htmlFor="playbook-content">Prüfvorgaben & Muster</label>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={importing || saving}
                >
                  {importing ? <LoaderCircle className="spin" size={14} /> : <Upload size={14} />}
                  Dokument importieren
                </button>
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
              <button
                className="button secondary"
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving || importing}
              >
                Abbrechen
              </button>
              <button className="button primary" type="submit" disabled={saving || importing}>
                {saving && <LoaderCircle className="spin" size={15} />}Playbook speichern
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)} wide>
          <div className="modal-body">
            <div className="playbook-read-content">{selected.content}</div>
          </div>
          <div className="modal-footer">
            {onUpdate && (
              <button
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
              </button>
            )}
            <button
              className="button secondary"
              onClick={() => {
                setEditingId(null);
                setName(`${selected.name} · Variante`);
                setContent(selected.content);
                setSelected(null);
                setOpen(true);
              }}
            >
              Als Vorlage verwenden
            </button>
            <button className="button primary" onClick={() => setSelected(null)}>
              Fertig
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Settings({
  health,
  models,
  model,
  effort,
  onModel,
  onEffort,
  documents,
  onDeleteDocument,
  onRefresh,
  refreshing,
}: {
  health: Health | null;
  models: Model[];
  model: string;
  effort: string;
  onModel: (value: string) => void;
  onEffort: (value: string) => void;
  documents: DocumentRecord[];
  onDeleteDocument: (document: DocumentRecord) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="standard-page settings-page">
      <header className="standard-page-header">
        <div className="eyebrow">ARBEITSUMGEBUNG</div>
        <h1>Einstellungen</h1>
        <p>Ein klarer Blick auf Modelle, Verbindung und Ihre Daten.</p>
      </header>
      <section className="settings-section">
        <div className="settings-section-heading">
          <Server size={20} strokeWidth={1.4} />
          <div>
            <h2>API-Verbindung</h2>
            <p>Der API-Schlüssel wird ausschließlich auf dem Server hinterlegt.</p>
          </div>
          <span className={`connection-badge ${health?.api_configured ? 'connected' : ''}`}>
            <span className="status-dot" />
            {health?.api_configured
              ? 'Konfiguriert'
              : health
                ? 'Nicht eingerichtet'
                : 'Nicht erreichbar'}
          </span>
        </div>
        {!health?.api_configured && (
          <div className="setup-instructions">
            <p>Für eigene Analysen braucht der Server einen OpenAI-API-Schlüssel.</p>
            <ol>
              <li>
                Tragen Sie <code>OPENAI_API_KEY</code> in der serverseitigen <code>.env</code>-Datei
                ein.
              </li>
              <li>Starten Sie den Backend-Server neu und prüfen Sie die Verbindung.</li>
            </ol>
            <p className="field-help">
              Das Beispiel funktioniert ohne API-Schlüssel. Schlüssel niemals in das Frontend oder
              ein Playbook kopieren.
            </p>
          </div>
        )}
        <button className="button secondary small-button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}Verbindung
          prüfen
        </button>
      </section>
      <section className="settings-section">
        <div className="settings-section-heading">
          <BookOpen size={20} strokeWidth={1.4} />
          <div>
            <h2>Modell & Denkaufwand</h2>
            <p>Ihre Auswahl für die nächste Analyse. Sie bleibt in diesem Browser gespeichert.</p>
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
            <h2>Daten & Verantwortung</h2>
            <p>Transparenz vor der ersten Analyse.</p>
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
        <div className="settings-section-heading">
          <FolderOpen size={20} strokeWidth={1.4} />
          <div>
            <h2>Gespeicherte Dokumente</h2>
            <p>
              {documents.length} {documents.length === 1 ? 'Dokument' : 'Dokumente'} auf diesem
              Server. Löschen entfernt den gespeicherten Volltext.
            </p>
          </div>
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
                <button
                  className="icon-button"
                  onClick={() => onDeleteDocument(document)}
                  aria-label={`${document.name} endgültig löschen`}
                >
                  <Trash2 size={15} />
                </button>
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
      <footer className="settings-footer">
        LegalThinkGPT <span>·</span> Ein Arbeitsraum für juristisches Denken.
      </footer>
    </div>
  );
}
