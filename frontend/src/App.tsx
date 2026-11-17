import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  CircleAlert,
  FileText,
  History as HistoryIcon,
  LoaderCircle,
  Menu,
  Plus,
  RotateCw,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import Start from './Start';
import { DocumentPreviewProvider } from './DocumentPreview';
import { RouteContent } from './RouteContent';
import { api, MAX_INSTRUCTION_CHARS, MAX_MATERIAL_CHARS, request } from './types';
import { useThemePreference } from './theme';
import { useMotionPreferences } from './motion';
import type {
  Analysis,
  ComplianceTask,
  DemoScenario,
  DocumentRecord,
  Health,
  Model,
  Playbook,
  ProcessingRegion,
  ServiceTier,
  Workflow,
} from './types';
import { Brand, DEFAULT_MODELS, ErrorMessage, Modal, PageTransition } from './ui';
import { INSTRUCTION_TEMPLATES } from './instruction-templates';
import { CUSTOM_MODELS_KEY, MAX_CUSTOM_MODELS, readCustomModels } from './custom-models';
import './polish.css';
import './navigation-motion.css';

const Review = lazy(() => import('./Review'));
const History = lazy(() =>
  import('./WorkspacePages').then((pages) => ({ default: pages.History })),
);
const Playbooks = lazy(() =>
  import('./WorkspacePages').then((pages) => ({ default: pages.Playbooks })),
);
const Settings = lazy(() =>
  import('./WorkspacePages').then((pages) => ({ default: pages.Settings })),
);
const PAGE_NAMES: Record<string, string> = {
  history: 'Analysen',
  playbooks: 'Kanzlei-Playbooks',
  settings: 'Einstellungen',
};
function pageName(route: string) {
  return route.startsWith('analysis/') ? 'Analyse' : (PAGE_NAMES[route] ?? 'Neue Analyse');
}

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
  | { type: 'document'; item: DocumentRecord }
  | { type: 'documents'; items: DocumentRecord[] };

type Draft = {
  context: string;
  sourceText: string;
  selectedIds: string[];
  playbookId: string;
  research: boolean;
};
function initialDraft(scenario: DemoScenario): Draft {
  return {
    context: INSTRUCTION_TEMPLATES[scenario],
    sourceText: '',
    selectedIds: scenario === 'compare' ? ['', ''] : [],
    playbookId: '',
    research: true,
  };
}

type Drafts = Partial<Record<DemoScenario, Draft>>;
/** Remove documents and playbooks from every draft that no longer exist. */
function pruneDrafts(
  drafts: Drafts,
  documentExists: (id: string) => boolean,
  playbookExists: (id: string) => boolean,
): Drafts {
  return Object.fromEntries(
    Object.entries(drafts).map(([key, draft]) => [
      key,
      {
        ...draft,
        selectedIds:
          key === 'compare'
            ? draft.selectedIds.map((id) => (documentExists(id) ? id : ''))
            : draft.selectedIds.filter(documentExists),
        playbookId: playbookExists(draft.playbookId) ? draft.playbookId : '',
      },
    ]),
  );
}
/** A server list plus local records added while it was being loaded. */
function withNewer<T extends { id: string }>(
  server: T[],
  local: T[],
  newer: (id: string) => boolean,
) {
  const ids = new Set(server.map((item) => item.id));
  return [...local.filter((item) => !ids.has(item.id) && newer(item.id)), ...server];
}

type Toast = { id: number; text: string; failed: boolean };

function Notification({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const present = useIsPresent();
  const { reduced, transition } = useMotionPreferences();
  return (
    <motion.div
      className={`toast motion-toast${toast.failed ? ' failed' : ''}`}
      role={toast.failed ? 'alert' : 'status'}
      aria-atomic="true"
      aria-hidden={!present || undefined}
      inert={!present}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: transition('exit') }}
      transition={transition('enter')}
    >
      {toast.failed ? <CircleAlert size={16} /> : <Check size={16} />}
      <span>{toast.text}</span>
      <button
        type="button"
        className="icon-button small"
        onClick={onClose}
        aria-label="Hinweis schließen"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

export default function App() {
  const { transition } = useMotionPreferences();
  const [themePreference, setThemePreference] = useThemePreference();
  const [route, setRoute] = useState(routeFromHash);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(
    () => window.matchMedia('(max-width: 700px)').matches,
  );
  const [drawerPresented, setDrawerPresented] = useState(false);
  const mobileOpenRef = useRef(mobileOpen);
  mobileOpenRef.current = mobileOpen;
  const [health, setHealth] = useState<Health | null>(null);
  const [defaultModels, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [customModels, setCustomModels] = useState(readCustomModels);
  const models = useMemo(
    () => [
      ...defaultModels,
      ...customModels.filter((custom) => !defaultModels.some((model) => model.id === custom.id)),
    ],
    [defaultModels, customModels],
  );
  const [model, setModelState] = useState(() => stored('legalthink-model', 'gpt-6-luna'));
  const [effort, setEffortState] = useState(() => stored('legalthink-effort', 'xhigh'));
  const [processingRegion, setProcessingRegionState] = useState<ProcessingRegion | null>(() => {
    const value = stored('legalthink-processing-region', 'server');
    return value === 'eu' || value === 'global' ? value : null;
  });
  const [serviceTier, setServiceTierState] = useState<ServiceTier>(() =>
    stored('legalthink-service-tier', 'default') === 'flex' ? 'flex' : 'default',
  );
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const userDocuments = useMemo(
    () => documents.filter((document) => !document.is_demo),
    [documents],
  );
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>('contract');
  const [complianceTask, setComplianceTask] = useState<ComplianceTask>('general');
  const scenario: DemoScenario =
    workflow === 'compliance' && complianceTask !== 'general' ? complianceTask : workflow;
  const [drafts, setDrafts] = useState<Drafts>({});
  // When this browser added a record. A workspace load that started earlier keeps it.
  const added = useRef(new Map<string, number>());
  function markAdded(...ids: string[]) {
    const time = performance.now();
    for (const id of ids) added.current.set(id, time);
  }
  const { context, sourceText, selectedIds, playbookId, research } =
    drafts[scenario] ?? initialDraft(scenario);
  const sourceTextCharCount = useMemo(() => Array.from(sourceText).length, [sourceText]);
  const selectedDocumentIds = selectedIds.filter(Boolean);
  const materialCharCount =
    sourceTextCharCount +
    documents
      .filter((document) => selectedDocumentIds.includes(document.id))
      .reduce((total, document) => total + document.char_count, 0);
  function updateDraft(patch: Partial<Draft> | ((previous: Draft) => Partial<Draft>)) {
    setDrafts((previous) => {
      const current = previous[scenario] ?? initialDraft(scenario);
      return {
        ...previous,
        [scenario]: { ...current, ...(typeof patch === 'function' ? patch(current) : patch) },
      };
    });
  }
  function setSelectedIds(value: string[] | ((previous: string[]) => string[])) {
    updateDraft((previous) => ({
      selectedIds: typeof value === 'function' ? value(previous.selectedIds) : value,
    }));
  }
  function changeWorkflow(value: Workflow) {
    setWorkflow(value);
    setError('');
  }
  function changeComplianceTask(value: ComplianceTask) {
    setComplianceTask(value);
    setError('');
  }
  const [loading, setLoading] = useState(true);
  const [loadFailures, setLoadFailures] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [running, setRunning] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [pageError, setPageError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  const toastCount = useRef(0);
  // Errors stay until closed; a repeated message is announced and timed again.
  const notify = useCallback((text: string, failed = false) => {
    toastCount.current += 1;
    setToast({ id: toastCount.current, text, failed });
  }, []);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const requestController = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  function openNavigation() {
    setDrawerPresented(true);
    setMobileOpen(true);
  }

  useEffect(() => {
    const query = window.matchMedia('(max-width: 700px)');
    const onChange = () => {
      setMobileNavigation(query.matches);
      if (!query.matches) {
        setMobileOpen(false);
        setDrawerPresented(false);
      }
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  function setModel(value: string) {
    setModelState(value);
    savePreference('legalthink-model', value);
  }
  function setEffort(value: string) {
    setEffortState(value);
    savePreference('legalthink-effort', value);
  }
  function saveCustomModels(next: Model[]) {
    try {
      localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        'Die Modellkonfiguration konnte nicht im Browser gespeichert werden. Prüfen Sie die Speichereinstellungen.',
      );
    }
    setCustomModels(next);
  }
  function saveCustomModel(value: Model) {
    if (defaultModels.some((model) => model.id === value.id))
      throw new Error('Mitgelieferte Modelle können nicht überschrieben werden.');
    const exists = customModels.some((model) => model.id === value.id);
    if (!exists && customModels.length >= MAX_CUSTOM_MODELS)
      throw new Error(`Sie können höchstens ${MAX_CUSTOM_MODELS} eigene Modelle speichern.`);
    saveCustomModels(
      exists
        ? customModels.map((model) => (model.id === value.id ? value : model))
        : [...customModels, value],
    );
  }
  function removeCustomModel(id: string) {
    if (id === model) throw new Error('Wählen Sie zuerst ein anderes Modell.');
    saveCustomModels(customModels.filter((item) => item.id !== id));
  }
  function setProcessingRegion(value: ProcessingRegion | null) {
    setProcessingRegionState(value);
    savePreference('legalthink-processing-region', value ?? 'server');
  }
  function setServiceTier(value: ServiceTier) {
    setServiceTierState(value);
    savePreference('legalthink-service-tier', value);
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
    const started = performance.now();
    const [healthResult, modelResult, documentsResult, analysesResult, playbookResult] =
      await Promise.allSettled([
        api<Health>('/health', { signal }),
        api<{ models: Model[] }>('/models', { signal }),
        api<DocumentRecord[]>('/documents', { signal }),
        api<Analysis[]>('/analyses', { signal }),
        api<Playbook[]>('/playbooks', { signal }),
      ]);
    if (signal?.aborted) return false;
    const newer = (id: string) => (added.current.get(id) ?? -Infinity) > started;
    const failures: string[] = [];
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    else {
      setHealth(null);
      failures.push('Verbindungsstatus');
    }
    if (modelResult.status === 'fulfilled' && modelResult.value.models?.length)
      setModels(modelResult.value.models);
    else failures.push('Modelle');
    const documentIds =
      documentsResult.status === 'fulfilled'
        ? new Set(documentsResult.value.map((document) => document.id))
        : null;
    const playbookIds =
      playbookResult.status === 'fulfilled'
        ? new Set(playbookResult.value.map((playbook) => playbook.id))
        : null;
    if (documentsResult.status === 'fulfilled')
      setDocuments((previous) => withNewer(documentsResult.value, previous, newer));
    else failures.push('Dokumente');
    if (analysesResult.status === 'fulfilled')
      setAnalyses((previous) => withNewer(analysesResult.value, previous, newer));
    else failures.push('Analysen');
    if (playbookResult.status === 'fulfilled')
      setPlaybooks((previous) => withNewer(playbookResult.value, previous, newer));
    else failures.push('Playbooks');
    setDrafts((previous) =>
      pruneDrafts(
        previous,
        (id) => !documentIds || documentIds.has(id) || newer(id),
        (id) => !playbookIds || playbookIds.has(id) || newer(id),
      ),
    );
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
    document.title = `${pageName(route)} · LegalThink`;
  }, [route]);
  useEffect(() => {
    if (!route.startsWith('analysis/')) return;
    const id = route.split('/')[1];
    if (analysis?.id === id) return;
    const existing = analyses.find((item) => item.id === id);
    if (existing) {
      setPageError('');
      setAnalysis(existing);
      return;
    }
    const controller = new AbortController();
    setPageError('');
    void api<Analysis>(`/analyses/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setAnalysis(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setPageError(message(error));
      });
    return () => controller.abort();
  }, [route, analyses, analysis?.id]);
  useEffect(() => {
    if (!toast || toast.failed) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
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
    const limit = workflow === 'compare' ? 2 : 12;
    if (selectedDocumentIds.length + files.length > limit) {
      setError(
        workflow === 'compare'
          ? selectedDocumentIds.length === 2
            ? 'Beide Fassungen sind ausgewählt. Entfernen Sie zuerst die zu ersetzende Fassung.'
            : 'Wählen Sie genau zwei Fassungen aus: Original und Gegenentwurf.'
          : 'Wählen Sie höchstens 12 Dokumente pro Analyse aus.',
      );
      return;
    }
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
    markAdded(...uploaded.map((item) => item.id));
    setDocuments((previous) => [
      ...uploaded,
      ...previous.filter((item) => !uploaded.some((newItem) => newItem.id === item.id)),
    ]);
    setSelectedIds((previous) => {
      if (workflow !== 'compare')
        return [...new Set([...previous, ...uploaded.map((item) => item.id)])];
      const slots = [...previous];
      for (const document of uploaded) {
        const free = slots.indexOf('');
        if (free !== -1) slots[free] = document.id;
      }
      return slots;
    });
    setUploading(false);
    setError(errors.join(' '));
  }

  async function runAnalysis() {
    if (running) return;
    setError('');
    if (workflow !== 'compare' && !selectedDocumentIds.length && !sourceText.trim()) {
      setError('Fügen Sie ein Dokument hinzu oder geben Sie einen Text zur Prüfung ein.');
      document.getElementById('analysis-source-text')?.focus();
      return;
    }
    if (selectedDocumentIds.length > 12) {
      setError('Wählen Sie höchstens 12 Dokumente pro Analyse aus.');
      return;
    }
    if (workflow === 'compare' && selectedDocumentIds.length !== 2) {
      setError(
        'Für den Versionsvergleich benötigen Sie genau zwei Dokumente: zuerst das Original, dann den Gegenentwurf.',
      );
      return;
    }
    if (materialCharCount > MAX_MATERIAL_CHARS) {
      setError(
        `Text und Dokumente dürfen zusammen höchstens ${MAX_MATERIAL_CHARS.toLocaleString('de-DE')} Zeichen enthalten. Bitte den Umfang reduzieren.`,
      );
      document.getElementById('analysis-source-text')?.focus();
      return;
    }
    if (Array.from(context).length > MAX_INSTRUCTION_CHARS) {
      setError(
        `Der Prüfauftrag darf höchstens ${MAX_INSTRUCTION_CHARS.toLocaleString('de-DE')} Zeichen enthalten. Bitte kürzen Sie den Prüfauftrag.`,
      );
      document.getElementById('analysis-context')?.focus();
      return;
    }
    const selectedModel = models.find((item) => item.id === model);
    if (selectedModel?.custom && research && !selectedModel.supports_web_search) {
      setError(
        'Webrecherche ist für dieses eigene Modell nicht freigegeben. Deaktivieren Sie die Webrecherche oder prüfen Sie die Modellkonfiguration in den Einstellungen.',
      );
      return;
    }
    if (health?.api_configured === false) {
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
          document_ids: selectedDocumentIds,
          compliance_task: workflow === 'compliance' ? complianceTask : 'general',
          context,
          source_text: sourceText,
          model,
          effort,
          custom_model: selectedModel?.custom
            ? {
                efforts: selectedModel.efforts,
                supports_web_search: selectedModel.supports_web_search === true,
              }
            : null,
          playbook_id: playbookId || null,
          research,
          processing_region: processingRegion,
          service_tier: serviceTier,
        }),
      });
      setAnalysis(result);
      markAdded(result.id);
      if (result.source_text_document_id) {
        markAdded(result.source_text_document_id);
        // The server preserves the submitted text and returns its saved source ID.
        // Populate the local source view immediately without another loading state.
        const sourceDocument: DocumentRecord = {
          id: result.source_text_document_id,
          name: result.source_text_document_name || 'Eingefügter Text.txt',
          text: sourceText,
          page_count: 1,
          char_count: sourceTextCharCount,
        };
        setDocuments((previous) => [
          sourceDocument,
          ...previous.filter((document) => document.id !== sourceDocument.id),
        ]);
      }
      setAnalyses((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      navigate(`analysis/${result.id}`);
    } catch (error) {
      setError(
        error instanceof DOMException && error.name === 'AbortError'
          ? 'Das Warten auf die Antwort wurde abgebrochen.'
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
        (item.demo_scenario ?? (item.workflow === 'contract' ? 'contract' : undefined)) ===
          scenario &&
        (item.document_ids?.length
          ? item.document_ids
          : item.findings.map((finding) => finding.source_document_id)
        ).every((id) => !id || documents.some((document) => document.id === id)),
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
      const result = await api<Analysis>('/demo', {
        method: 'POST',
        body: JSON.stringify({ scenario }),
      });
      markAdded(result.id);
      setAnalysis(result);
      setAnalyses((previous) => [result, ...previous.filter((item) => item.id !== result.id)]);
      // Add the example's sources without replacing records added in the meantime.
      const sources = new Set(result.document_ids);
      const examples = (await api<DocumentRecord[]>('/documents')).filter((document) =>
        sources.has(document.id),
      );
      markAdded(...examples.map((document) => document.id));
      setDocuments((previous) => [
        ...examples,
        ...previous.filter((document) => !sources.has(document.id)),
      ]);
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
      if (await loadWorkspace()) notify('Daten aktualisiert.');
    } finally {
      setRefreshing(false);
    }
  }

  async function createPlaybook(name: string, content: string) {
    const result = await api<Playbook>('/playbooks', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    });
    markAdded(result.id);
    setPlaybooks((previous) => [result, ...previous]);
    notify('Playbook gespeichert.');
  }

  async function updatePlaybook(id: string, name: string, content: string) {
    const result = await api<Playbook>(`/playbooks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, content }),
    });
    setPlaybooks((previous) =>
      previous.map((playbook) => (playbook.id === id ? result : playbook)),
    );
    notify('Playbook aktualisiert.');
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
      if (deleteTarget.type === 'documents') {
        await api('/documents', {
          method: 'DELETE',
          body: JSON.stringify({ document_ids: deleteTarget.items.map((item) => item.id) }),
        });
      } else {
        await api(`/${path}/${encodeURIComponent(deleteTarget.item.id)}`, { method: 'DELETE' });
      }
      if (deleteTarget.type === 'analysis') {
        setAnalyses((previous) => previous.filter((item) => item.id !== deleteTarget.item.id));
        setAnalysis((previous) => (previous?.id === deleteTarget.item.id ? null : previous));
      } else if (deleteTarget.type === 'playbook') {
        const removed = deleteTarget.item.id;
        setPlaybooks((previous) => previous.filter((item) => item.id !== removed));
        setDrafts((previous) =>
          pruneDrafts(
            previous,
            () => true,
            (id) => id !== removed,
          ),
        );
      } else {
        const removedIds = new Set(
          deleteTarget.type === 'documents'
            ? deleteTarget.items.map((item) => item.id)
            : [deleteTarget.item.id],
        );
        setDocuments((previous) => previous.filter((item) => !removedIds.has(item.id)));
        setDrafts((previous) =>
          pruneDrafts(
            previous,
            (id) => !removedIds.has(id),
            () => true,
          ),
        );
      }
      setDeleteTarget(null);
      notify('Gelöscht.');
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
      const response = await request(
        `/analyses/${encodeURIComponent(analysis.id)}/export?format=${format}`,
      );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${analysis.title.replace(/[<>:"/\\|?*]/g, '-').slice(0, 100)}.${format}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Export wurde heruntergeladen.');
    } catch (error) {
      notify(message(error), true);
    } finally {
      setExporting(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify('Formulierung in die Zwischenablage kopiert.');
    } catch {
      notify(
        'Die Zwischenablage ist nicht verfügbar. Markieren und kopieren Sie den Text direkt.',
        true,
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
  const unavailablePage =
    (route === 'history' && loadFailures.includes('Analysen') && !analyses.length) ||
    (route === 'playbooks' && loadFailures.includes('Playbooks') && !playbooks.length) ||
    (route === 'settings' && loadFailures.includes('Dokumente') && !documents.length);
  return (
    <DocumentPreviewProvider
      route={route}
      documents={documents}
      onUpdated={(updated) =>
        setDocuments((previous) => previous.map((doc) => (doc.id === updated.id ? updated : doc)))
      }
    >
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
        <motion.button
          className="sidebar-overlay navigation-backdrop"
          tabIndex={-1}
          aria-hidden="true"
          aria-label="Navigation schließen"
          onClick={() => setMobileOpen(false)}
          initial={false}
          animate={{ opacity: mobileOpen ? 1 : 0 }}
          transition={transition(mobileOpen ? 'enter' : 'exit')}
          style={{ pointerEvents: mobileOpen ? 'auto' : 'none' }}
        />
        <motion.aside
          ref={sidebarRef}
          id="workspace-navigation"
          role={mobileOpen ? 'dialog' : undefined}
          aria-modal={mobileOpen || undefined}
          tabIndex={mobileOpen ? -1 : undefined}
          className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
          aria-label="Hauptnavigation"
          aria-hidden={(mobileNavigation && !mobileOpen) || undefined}
          inert={mobileNavigation && !mobileOpen}
          data-motion-navigation="true"
          data-presented={drawerPresented}
          initial={false}
          animate={{ opacity: mobileNavigation && !mobileOpen ? 0 : 1 }}
          transition={
            mobileNavigation ? transition(mobileOpen ? 'enter' : 'exit') : { duration: 0 }
          }
          onAnimationComplete={() => {
            if (!mobileOpenRef.current) setDrawerPresented(false);
          }}
        >
          <div className="sidebar-brand">
            <button
              type="button"
              onClick={() => navigate('new')}
              aria-label="LegalThink Startseite"
            >
              <Brand />
            </button>
            <button
              type="button"
              className="icon-button sidebar-mobile-close"
              aria-label="Navigation schließen"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <nav className="primary-nav">
            <button
              type="button"
              className={`nav-item nav-motion-item new-analysis-nav ${route === 'new' ? 'active' : ''}`}
              aria-current={route === 'new' ? 'page' : undefined}
              onClick={() => navigate('new')}
            >
              <Plus size={18} strokeWidth={1.6} />
              <span>Neue Analyse</span>
            </button>
            <button
              type="button"
              className={`nav-item nav-motion-item ${route === 'history' || isReview ? 'active' : ''}`}
              aria-current={route === 'history' ? 'page' : undefined}
              onClick={() => navigate('history')}
            >
              <HistoryIcon size={17} strokeWidth={1.6} />
              <span>Analysen</span>
              {analyses.length > 0 && <span className="nav-count">{analyses.length}</span>}
            </button>
            <button
              type="button"
              className={`nav-item nav-motion-item ${route === 'playbooks' ? 'active' : ''}`}
              aria-current={route === 'playbooks' ? 'page' : undefined}
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
                  type="button"
                  className={`recent-item nav-motion-item ${route === `analysis/${item.id}` ? 'active' : ''}`}
                  aria-current={route === `analysis/${item.id}` ? 'page' : undefined}
                  title={item.title}
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
              type="button"
              className={`nav-item nav-motion-item ${route === 'settings' ? 'active' : ''}`}
              aria-current={route === 'settings' ? 'page' : undefined}
              onClick={() => navigate('settings')}
            >
              <Settings2 size={17} strokeWidth={1.6} />
              <span>Einstellungen</span>
            </button>
          </div>
        </motion.aside>
        <div className="main-shell" inert={mobileOpen}>
          <header className="topbar">
            <div>
              <button
                type="button"
                ref={menuTriggerRef}
                className="icon-button mobile-menu"
                aria-controls="workspace-navigation"
                aria-label="Navigation öffnen"
                aria-expanded={mobileOpen}
                onClick={openNavigation}
              >
                <Menu size={20} />
              </button>
              <span className="mobile-page-name">LegalThink</span>
            </div>
            {health?.api_configured === false && (
              <button className="topbar-status" onClick={() => navigate('settings')}>
                <span className="status-dot" />
                API einrichten
              </button>
            )}
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
                  <span className="action-icon" aria-hidden="true">
                    {refreshing ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <RotateCw size={14} />
                    )}
                  </span>
                  <span className="stable-action-label">
                    <span className="stable-action-size" aria-hidden="true">
                      Wird geladen …
                    </span>
                    <span>{refreshing ? 'Wird geladen …' : 'Erneut laden'}</span>
                  </span>
                </button>
              </section>
            )}
            <PageTransition key={route}>
              <RouteContent onReturn={() => navigate('new')}>
                {unavailablePage ? (
                  <section className="standard-page">
                    <h1>{pageName(route)}</h1>
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
                    onDocumentImported={(document) => {
                      markAdded(document.id);
                      setDocuments((previous) => [
                        document,
                        ...previous.filter((item) => item.id !== document.id),
                      ]);
                    }}
                    onDelete={(item) => askDelete({ type: 'playbook', item })}
                  />
                ) : route === 'settings' ? (
                  <Settings
                    themePreference={themePreference}
                    onThemePreference={setThemePreference}
                    health={health}
                    models={models}
                    model={model}
                    effort={effort}
                    onModel={setModel}
                    onEffort={setEffort}
                    onSaveCustomModel={saveCustomModel}
                    onRemoveCustomModel={removeCustomModel}
                    processingRegion={processingRegion}
                    onProcessingRegion={setProcessingRegion}
                    serviceTier={serviceTier}
                    onServiceTier={setServiceTier}
                    documents={userDocuments}
                    onDeleteDocument={(item) => askDelete({ type: 'document', item })}
                    onDeleteAllDocuments={() =>
                      askDelete({ type: 'documents', items: [...userDocuments] })
                    }
                    onRefresh={() => void refresh()}
                    refreshing={refreshing || loading}
                  />
                ) : isReview ? (
                  analysis?.id === route.split('/')[1] ? (
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
                    onWorkflow={changeWorkflow}
                    complianceTask={complianceTask}
                    onComplianceTask={changeComplianceTask}
                    comparisonIds={drafts.compare?.selectedIds ?? ['', '']}
                    documents={selectedDocuments}
                    libraryDocuments={userDocuments}
                    onSelectDocuments={(ids) => {
                      setSelectedIds(ids);
                      setError('');
                    }}
                    onUpload={(files) => void upload(files)}
                    onRemove={(id) =>
                      setSelectedIds((previous) =>
                        workflow === 'compare'
                          ? previous.map((item) => (item === id ? '' : item))
                          : previous.filter((item) => item !== id),
                      )
                    }
                    onReorder={() => setSelectedIds((previous) => [...previous].reverse())}
                    context={context}
                    onContext={(value) => {
                      updateDraft({ context: value });
                      setError('');
                    }}
                    sourceText={sourceText}
                    onSourceText={(value) => updateDraft({ sourceText: value })}
                    materialCharCount={materialCharCount}
                    model={model}
                    effort={effort}
                    models={models}
                    onModel={setModel}
                    onEffort={setEffort}
                    processingRegion={processingRegion}
                    serverDefaultRegion={health?.default_processing_region}
                    onProcessingRegion={setProcessingRegion}
                    serviceTier={serviceTier}
                    onServiceTier={setServiceTier}
                    playbooks={playbooks}
                    playbookId={playbookId}
                    onPlaybook={(value) => updateDraft({ playbookId: value })}
                    research={research}
                    onResearch={(value) => updateDraft({ research: value })}
                    onRun={() => void runAnalysis()}
                    onCancel={() => requestController.current?.abort()}
                    onDemo={() => void openDemo()}
                    uploading={uploading}
                    running={running}
                    demoLoading={demoLoading}
                    error={error}
                  />
                )}
              </RouteContent>
            </PageTransition>
          </main>
        </div>
        <AnimatePresence initial={false}>
          {toast && <Notification key={toast.id} toast={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {deleteTarget && (
            <Modal
              title={
                deleteTarget.type === 'analysis'
                  ? 'Analyse löschen?'
                  : deleteTarget.type === 'playbook'
                    ? 'Playbook löschen?'
                    : deleteTarget.type === 'documents'
                      ? 'Alle Dokumente löschen?'
                      : 'Dokument löschen?'
              }
              onClose={() => {
                if (!deleting) setDeleteTarget(null);
              }}
            >
              <div className="modal-body">
                {deleteTarget.type === 'documents' ? (
                  <p>
                    {deleteTarget.items.length === 1
                      ? 'Das gespeicherte Dokument wird'
                      : `Alle ${deleteTarget.items.length} gespeicherten Dokumente werden`}{' '}
                    dauerhaft von diesem Server gelöscht.
                  </p>
                ) : (
                  <p>
                    <strong>
                      {'title' in deleteTarget.item
                        ? deleteTarget.item.title
                        : deleteTarget.item.name}
                    </strong>{' '}
                    wird dauerhaft von diesem Server gelöscht.
                  </p>
                )}
                {(deleteTarget.type === 'document' || deleteTarget.type === 'documents') && (
                  <p className="field-help">
                    Fundstellen in bestehenden Analysen können danach nicht mehr mit dem
                    vollständigen Dokument abgeglichen werden. Gespeicherte Zitate in
                    Analyseberichten bleiben erhalten.
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
                  aria-busy={deleting}
                >
                  {deleting ? (
                    <LoaderCircle className="spin" size={15} aria-hidden="true" />
                  ) : (
                    <Trash2 size={15} aria-hidden="true" />
                  )}
                  Endgültig löschen
                </button>
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </DocumentPreviewProvider>
  );
}
