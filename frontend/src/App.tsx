import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  FileText,
  History as HistoryIcon,
  LoaderCircle,
  Menu,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import Start from './Start';
import Review from './Review';
import { History, Playbooks, Settings } from './WorkspacePages';
import { api } from './types';
import type { Analysis, DocumentRecord, Health, Model, Playbook, Workflow } from './types';
import { Brand, DEFAULT_MODELS, ErrorMessage, Modal, PageTransition } from './ui';
import './polish.css';

function stored(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Browser preferences are optional. */
  }
}
function routeFromHash() {
  return window.location.hash.replace(/^#\/?/, '') || 'new';
}
function message(error: unknown) {
  return error instanceof Error ? error.message : 'Die Aktion konnte nicht abgeschlossen werden.';
}
type DeleteTarget =
  | { type: 'analysis'; item: Analysis }
  | { type: 'playbook'; item: Playbook }
  | { type: 'document'; item: DocumentRecord };

export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [model, setModelState] = useState(() => stored('legalthink-model', 'gpt-6.1-sol'));
  const [effort, setEffortState] = useState(() => stored('legalthink-effort', 'medium'));
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>('contract');
  const [context, setContext] = useState('');
  const [playbookId, setPlaybookId] = useState('');
  const [research, setResearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailures, setLoadFailures] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [toast, setToast] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const requestController = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  function setModel(value: string) {
    setModelState(value);
    savePreference('legalthink-model', value);
  }
  function setEffort(value: string) {
    setEffortState(value);
    savePreference('legalthink-effort', value);
  }
  const navigate = useCallback((next: string) => {
    window.location.hash = next;
    setRoute(next);
    setMobileOpen(false);
    setPageError('');
  }, []);
  useEffect(() => {
    const listener = () => {
      setRoute(routeFromHash());
      setMobileOpen(false);
      setPageError('');
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    const [healthResult, modelResult, documentsResult, analysesResult, playbookResult] =
      await Promise.allSettled([
        api<Health>('/health', { signal }),
        api<{ models: Model[] }>('/models', { signal }),
        api<DocumentRecord[]>('/documents', { signal }),
        api<Analysis[]>('/analyses', { signal }),
        api<Playbook[]>('/playbooks', { signal }),
      ]);
    if (signal?.aborted) return false;
    const failures: string[] = [];
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    else {
      setHealth(null);
      failures.push('Verbindungsstatus');
    }
    if (modelResult.status === 'fulfilled' && modelResult.value.models?.length)
      setModels(modelResult.value.models);
    else failures.push('Modelle');
    if (documentsResult.status === 'fulfilled') {
      setDocuments(documentsResult.value);
      setSelectedIds((previous) =>
        previous.filter((id) => documentsResult.value.some((document) => document.id === id)),
      );
    } else failures.push('Dokumente');
    if (analysesResult.status === 'fulfilled') setAnalyses(analysesResult.value);
    else failures.push('Analysen');
    if (playbookResult.status === 'fulfilled') {
      setPlaybooks(playbookResult.value);
      setPlaybookId((previous) =>
        playbookResult.value.some((playbook) => playbook.id === previous) ? previous : '',
      );
    } else failures.push('Playbooks');
    setLoadFailures(failures);
    setLoading(false);
    return failures.length === 0;
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadWorkspace]);
  useEffect(() => {
    const current = models.find((item) => item.id === model);
    if (!current) setModel(models[0].id);
    if (current && !current.efforts.includes(effort)) setEffort(current.default_effort);
  }, [models, model, effort]);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
    document.title = `${route.startsWith('analysis/') ? 'Analyse' : route === 'history' ? 'Analysen' : route === 'playbooks' ? 'Kanzlei-Playbooks' : route === 'settings' ? 'Einstellungen' : 'Neue Analyse'} · LegalThinkGPT`;
    if (!route.startsWith('analysis/')) return;
    const id = route.split('/')[1];
    if (analysis?.id === id) return;
    const existing = analyses.find((item) => item.id === id);
    if (existing) {
      setAnalysis(existing);
      return;
    }
    let active = true;
    setAnalysis(null);
    void api<Analysis>(`/analyses/${encodeURIComponent(id)}`)
      .then((value) => {
        if (active) setAnalysis(value);
      })
      .catch((error) => {
        if (active) setPageError(message(error));
      });
    return () => {
      active = false;
    };
  }, [route, analyses, analysis?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => requestController.current?.abort(), []);
  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = sidebarRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        sidebar?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        ) ?? [],
      ).filter(
        (element) =>
          element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
      );
    sidebar?.querySelector<HTMLButtonElement>('.sidebar-mobile-close')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        sidebar?.focus();
        return;
      }
      if (!sidebar?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia('(min-width: 701px)');
    const onResize = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    desktop.addEventListener('change', onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      desktop.removeEventListener('change', onResize);
      if (menuTriggerRef.current?.getClientRects().length) menuTriggerRef.current.focus();
      else contentRef.current?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

  async function upload(files: FileList | File[]) {
    if (!files.length || uploading || running) return;
    setUploading(true);
    setError('');
    const uploaded: DocumentRecord[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) {
        errors.push(`${file.name}: Bitte PDF, DOCX, TXT oder Markdown verwenden.`);
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        errors.push(`${file.name}: Die Datei darf höchstens 12 MB groß sein.`);
        continue;
      }
      const form = new FormData();
      form.append('file', file);
      try {
        uploaded.push(await api<DocumentRecord>('/documents', { method: 'POST', body: form }));
      } catch (error) {
        errors.push(`${file.name}: ${message(error)}`);
      }
    }
    setDocuments((previous) => [
      ...uploaded,
      ...previous.filter((item) => !uploaded.some((newItem) => newItem.id === item.id)),
    ]);
    setSelectedIds((previous) => [...new Set([...previous, ...uploaded.map((item) => item.id)])]);
    setUploading(false);
    setError(errors.join(' '));
  }

  async function runAnalysis() {
    if (running) return;
    setError('');
    if (!selectedIds.length) {
      setError('Fügen Sie mindestens ein Dokument hinzu, um die Prüfung zu beginnen.');
      return;
    }
    if (selectedIds.length > 12) {
      setError('Wählen Sie höchstens 12 Dokumente pro Analyse aus.');
      return;
    }
    if (workflow === 'compare' && selectedIds.length !== 2) {
      setError(
        'Für den Versionsvergleich benötigen Sie genau zwei Dokumente: zuerst das Original, dann den Gegenentwurf.',
      );
      return;
    }
    if (!health?.api_configured) {
      setError(
        'API-Schlüssel fehlt. Hinterlegen Sie OPENAI_API_KEY in backend/.env und starten Sie den Server neu.',
      );
      return;
    }
    const controller = new AbortController();
    requestController.current = controller;
    setRunning(true);
    try {
      const result = await api<Analysis>('/analyses', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          workflow,
          document_ids: selectedIds,
          context,
          model,
          effort,
          playbook_id: playbookId || null,
          research,
        }),
      });
      setAnalysis(result);
      setAnalyses((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      navigate(`analysis/${result.id}`);
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Das Warten wurde abgebrochen. Eine bereits gestartete Verarbeitung auf dem Server kann noch weiterlaufen. Prüfen Sie später Ihre Analysen.'
          : message(error),
      );
    } finally {
      setRunning(false);
      requestController.current = null;
    }
  }

  async function openDemo() {
    if (demoLoading || running) return;
    const existing = analyses.find(
      (item) =>
        item.is_demo &&
        item.findings.every(
          (finding) =>
            !finding.source_document_id ||
            documents.some((document) => document.id === finding.source_document_id),
        ),
    );
    if (existing) {
      setAnalysis(existing);
      setError('');
      navigate(`analysis/${existing.id}`);
      return;
    }
    setDemoLoading(true);
    setError('');
    try {
      const result = await api<Analysis>('/demo', { method: 'POST' });
      setAnalysis(result);
      setAnalyses((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      const docs = await api<DocumentRecord[]>('/documents');
      setDocuments(docs);
      navigate(`analysis/${result.id}`);
    } catch (error) {
      setError(message(error));
    } finally {
      setDemoLoading(false);
    }
  }

  async function refresh() {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      if (await loadWorkspace()) setToast('Daten aktualisiert.');
    } finally {
      setRefreshing(false);
    }
  }

  async function createPlaybook(name: string, content: string) {
    const result = await api<Playbook>('/playbooks', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    });
    setPlaybooks((previous) => [result, ...previous]);
    setToast('Playbook gespeichert.');
    void api<DocumentRecord[]>('/documents')
      .then(setDocuments)
      .catch(() => {});
  }

  async function updatePlaybook(id: string, name: string, content: string) {
    const result = await api<Playbook>(`/playbooks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, content }),
    });
    setPlaybooks((previous) =>
      previous.map((playbook) => (playbook.id === id ? result : playbook)),
    );
    setToast('Playbook aktualisiert.');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const path =
        deleteTarget.type === 'analysis'
          ? 'analyses'
          : deleteTarget.type === 'playbook'
            ? 'playbooks'
            : 'documents';
      await api(`/${path}/${encodeURIComponent(deleteTarget.item.id)}`, { method: 'DELETE' });
      if (deleteTarget.type === 'analysis')
        setAnalyses((previous) => previous.filter((item) => item.id !== deleteTarget.item.id));
      else if (deleteTarget.type === 'playbook') {
        setPlaybooks((previous) => previous.filter((item) => item.id !== deleteTarget.item.id));
        if (playbookId === deleteTarget.item.id) setPlaybookId('');
      } else {
        setDocuments((previous) => previous.filter((item) => item.id !== deleteTarget.item.id));
        setSelectedIds((previous) => previous.filter((id) => id !== deleteTarget.item.id));
      }
      setDeleteTarget(null);
      setToast('Gelöscht.');
    } catch (error) {
      setDeleteError(message(error));
    } finally {
      setDeleting(false);
    }
  }

  async function exportAnalysis(format: 'docx' | 'md') {
    if (!analysis) return;
    setExporting(true);
    try {
      const response = await fetch(
        `/api/analyses/${encodeURIComponent(analysis.id)}/export?format=${format}`,
      );
      if (!response.ok)
        throw new Error('Der Export konnte nicht erstellt werden. Versuchen Sie es erneut.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${analysis.title.replace(/[<>:"/\\|?*]/g, '-').slice(0, 100)}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast('Export wurde heruntergeladen.');
    } catch (error) {
      setToast(message(error));
    } finally {
      setExporting(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Formulierung in die Zwischenablage kopiert.');
    } catch {
      setToast(
        'Die Zwischenablage ist nicht verfügbar. Markieren und kopieren Sie den Text direkt.',
      );
    }
  }
  function askDelete(target: DeleteTarget) {
    setDeleteTarget(target);
    setDeleteError('');
  }
  const selectedDocuments = selectedIds
    .map((id) => documents.find((item) => item.id === id))
    .filter((item): item is DocumentRecord => Boolean(item));
  const isReview = route.startsWith('analysis/');
  const pageName = isReview
    ? 'Analyse'
    : route === 'history'
      ? 'Analysen'
      : route === 'playbooks'
        ? 'Kanzlei-Playbooks'
        : route === 'settings'
          ? 'Einstellungen'
          : 'Neue Analyse';
  const unavailablePage =
    (route === 'history' && loadFailures.includes('Analysen') && !analyses.length) ||
    (route === 'playbooks' && loadFailures.includes('Playbooks') && !playbooks.length) ||
    (route === 'settings' && loadFailures.includes('Dokumente') && !documents.length);
  return (
    <MotionConfig reducedMotion="user">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
      >
        Zum Inhalt springen
      </a>
      <div className="app-shell">
        {mobileOpen && (
          <button
            className="sidebar-overlay"
            tabIndex={-1}
            aria-hidden="true"
            aria-label="Navigation schließen"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside
          ref={sidebarRef}
          id="workspace-navigation"
          role={mobileOpen ? 'dialog' : undefined}
          aria-modal={mobileOpen || undefined}
          tabIndex={mobileOpen ? -1 : undefined}
          className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
          aria-label="Hauptnavigation"
        >
          <div className="sidebar-brand">
            <button onClick={() => navigate('new')} aria-label="LegalThinkGPT Startseite">
              <Brand />
            </button>
            <button
              className="icon-button sidebar-mobile-close"
              aria-label="Navigation schließen"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <nav className="primary-nav">
            <button
              className={`nav-item new-analysis-nav ${route === 'new' ? 'active' : ''}`}
              onClick={() => navigate('new')}
            >
              <Plus size={18} strokeWidth={1.6} />
              <span>Neue Analyse</span>
            </button>
            <button
              className={`nav-item ${route === 'history' || isReview ? 'active' : ''}`}
              onClick={() => navigate('history')}
            >
              <HistoryIcon size={17} strokeWidth={1.6} />
              <span>Analysen</span>
              {analyses.length > 0 && <span className="nav-count">{analyses.length}</span>}
            </button>
            <button
              className={`nav-item ${route === 'playbooks' ? 'active' : ''}`}
              onClick={() => navigate('playbooks')}
            >
              <BookOpen size={17} strokeWidth={1.6} />
              <span>Kanzlei-Playbooks</span>
            </button>
          </nav>
          {analyses.length > 0 && (
            <div className="sidebar-recent">
              <div className="nav-section-label">Letzte Analysen</div>
              {analyses.slice(0, 4).map((item) => (
                <button
                  className={`recent-item ${analysis?.id === item.id && isReview ? 'active' : ''}`}
                  key={item.id}
                  onClick={() => {
                    setAnalysis(item);
                    navigate(`analysis/${item.id}`);
                  }}
                >
                  <FileText size={14} />
                  <span>{item.title}</span>
                  {item.is_demo && <span className="recent-demo-dot" aria-label="Beispiel" />}
                </button>
              ))}
            </div>
          )}
          <div className="sidebar-bottom">
            <button
              className={`nav-item ${route === 'settings' ? 'active' : ''}`}
              onClick={() => navigate('settings')}
            >
              <Settings2 size={17} strokeWidth={1.6} />
              <span>Einstellungen</span>
            </button>
          </div>
        </aside>
        <div className="main-shell" inert={mobileOpen}>
          <header className="topbar">
            <div>
              <button
                ref={menuTriggerRef}
                className="icon-button mobile-menu"
                aria-controls="workspace-navigation"
                aria-label="Navigation öffnen"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>
              <span className="mobile-page-name">LegalThinkGPT</span>
            </div>
            <button className="topbar-status" onClick={() => navigate('settings')}>
              <span className={`status-dot ${health?.api_configured ? 'connected' : ''}`} />
              {health?.api_configured
                ? 'API-Schlüssel hinterlegt'
                : health
                  ? 'API einrichten'
                  : loading
                    ? 'Server wird geprüft …'
                    : 'Server nicht erreichbar'}
            </button>
          </header>
          <main ref={contentRef} id="main-content" className="main-content" tabIndex={-1}>
            {loadFailures.length > 0 && (
              <section className="workspace-load-error" aria-label="Arbeitsraum erneut laden">
                <div role="alert">
                  <strong>Daten konnten nicht geladen werden.</strong>
                  <p>Betroffen: {loadFailures.join(', ')}.</p>
                </div>
                <button
                  className="button secondary small-button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                >
                  {refreshing && <LoaderCircle className="spin" size={14} />}
                  {refreshing ? 'Wird geladen …' : 'Erneut laden'}
                </button>
              </section>
            )}
            <PageTransition key={route}>
              {unavailablePage ? (
                <section className="standard-page">
                  <h1>{pageName}</h1>
                  <p className="muted">
                    Diese Ansicht steht nach dem erneuten Laden wieder zur Verfügung.
                  </p>
                </section>
              ) : loading && route === 'playbooks' ? (
                <div className="loading-state" role="status">
                  <LoaderCircle className="spin" size={22} />
                  Playbooks werden geladen …
                </div>
              ) : pageError ? (
                <div className="standard-page">
                  <ErrorMessage>{pageError}</ErrorMessage>
                  <button className="button secondary" onClick={() => navigate('new')}>
                    Neue Analyse
                  </button>
                </div>
              ) : route === 'history' ? (
                <History
                  analyses={analyses}
                  loading={loading}
                  onOpen={(item) => {
                    setAnalysis(item);
                    navigate(`analysis/${item.id}`);
                  }}
                  onNew={() => navigate('new')}
                  onDelete={(item) => askDelete({ type: 'analysis', item })}
                />
              ) : route === 'playbooks' ? (
                <Playbooks
                  playbooks={playbooks}
                  onCreate={createPlaybook}
                  onUpdate={updatePlaybook}
                  onDocumentImported={(document) =>
                    setDocuments((previous) => [
                      document,
                      ...previous.filter((item) => item.id !== document.id),
                    ])
                  }
                  onDelete={(item) => askDelete({ type: 'playbook', item })}
                  error=""
                />
              ) : route === 'settings' ? (
                <Settings
                  health={health}
                  models={models}
                  model={model}
                  effort={effort}
                  onModel={setModel}
                  onEffort={setEffort}
                  documents={documents}
                  onDeleteDocument={(item) => askDelete({ type: 'document', item })}
                  onRefresh={() => void refresh()}
                  refreshing={refreshing || loading}
                />
              ) : isReview ? (
                analysis ? (
                  <Review
                    analysis={analysis}
                    documents={documents}
                    onBack={() => navigate('new')}
                    onExport={(format) => void exportAnalysis(format)}
                    exporting={exporting}
                    onCopy={(text) => void copy(text)}
                  />
                ) : (
                  <div className="loading-state" role="status">
                    <LoaderCircle className="spin" size={22} />
                    Analyse wird geöffnet …
                  </div>
                )
              ) : (
                <Start
                  workflow={workflow}
                  onWorkflow={setWorkflow}
                  documents={selectedDocuments}
                  libraryDocuments={documents}
                  onSelectDocuments={setSelectedIds}
                  onUpload={(files) => void upload(files)}
                  onRemove={(id) =>
                    setSelectedIds((previous) => previous.filter((item) => item !== id))
                  }
                  onReorder={() => setSelectedIds((previous) => [...previous].reverse())}
                  context={context}
                  onContext={setContext}
                  model={model}
                  effort={effort}
                  models={models}
                  onModel={setModel}
                  onEffort={setEffort}
                  playbooks={playbooks}
                  playbookId={playbookId}
                  onPlaybook={setPlaybookId}
                  research={research}
                  onResearch={setResearch}
                  onRun={() => void runAnalysis()}
                  onCancel={() => requestController.current?.abort()}
                  onDemo={() => void openDemo()}
                  uploading={uploading}
                  running={running}
                  demoLoading={demoLoading}
                  error={error}
                />
              )}
            </PageTransition>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <Check size={16} />
            <span>{toast}</span>
            <button
              className="icon-button small"
              onClick={() => setToast('')}
              aria-label="Hinweis schließen"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {deleteTarget && (
          <Modal
            title={
              deleteTarget.type === 'analysis'
                ? 'Analyse löschen?'
                : deleteTarget.type === 'playbook'
                  ? 'Playbook löschen?'
                  : 'Dokument löschen?'
            }
            onClose={() => {
              if (!deleting) setDeleteTarget(null);
            }}
          >
            <div className="modal-body">
              <p>
                <strong>
                  {'title' in deleteTarget.item ? deleteTarget.item.title : deleteTarget.item.name}
                </strong>{' '}
                wird dauerhaft von diesem Server gelöscht.
              </p>
              {deleteTarget.type === 'document' && (
                <p className="field-help">
                  Fundstellen in bestehenden Analysen können danach nicht mehr mit dem vollständigen
                  Dokument abgeglichen werden. Gespeicherte Zitate in Analyseberichten bleiben
                  erhalten.
                </p>
              )}
              {deleteError && <ErrorMessage>{deleteError}</ErrorMessage>}
            </div>
            <div className="modal-footer">
              <button
                className="button secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Abbrechen
              </button>
              <button
                className="button danger"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting && <LoaderCircle className="spin" size={15} />}Endgültig löschen
              </button>
            </div>
          </Modal>
        )}
      </div>
    </MotionConfig>
  );
}
