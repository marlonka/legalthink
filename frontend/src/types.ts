export const MAX_MATERIAL_CHARS = 1_000_000;
export const MAX_INSTRUCTION_CHARS = 10_000;

export type Workflow = 'contract' | 'compare' | 'chronology' | 'compliance' | 'advertising';
export type ComplianceTask = 'general' | 'avv' | 'dsfa';
export type DemoScenario = Workflow | 'avv' | 'dsfa';
export type Severity = 'high' | 'medium' | 'low' | 'info';
export type ProcessingRegion = 'global' | 'eu';
export type ServiceTier = 'default' | 'flex';
export interface DocumentRecord {
  id: string;
  name: string;
  text: string;
  page_count: number;
  char_count: number;
  original_available?: boolean;
  is_demo?: boolean;
}
export interface Model {
  id: string;
  name: string;
  efforts: string[];
  default_effort: string;
}
export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  source_quote: string;
  source_document_id: string;
  source_document_name?: string;
  source_location: string;
  suggestion: string;
  legal_basis: string;
  verified: boolean;
  source_urls?: string[];
  comparison?: {
    change_type: 'modified' | 'added' | 'removed';
    original: ComparisonSource;
    counterdraft: ComparisonSource;
  } | null;
}
export interface ComparisonSource {
  source_document_id: string;
  source_document_name: string;
  source_quote: string;
  source_location: string;
  verified: boolean;
}
export interface Analysis {
  id: string;
  title: string;
  workflow: Workflow;
  document_ids?: string[];
  source_text_document_id?: string | null;
  source_text_document_name?: string | null;
  compliance_task?: ComplianceTask;
  demo_scenario?: DemoScenario | null;
  summary: string;
  findings: Finding[];
  timeline: {
    date: string;
    event: string;
    source: string;
    open_question: string;
    source_document_id?: string;
    source_quote?: string;
    verified?: boolean;
  }[];
  questions: string[];
  created_at: string;
  model: string;
  effort: string;
  is_demo: boolean;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    cache_write_tokens?: number | null;
  };
  provider_request_id?: string | null;
  provider_duration_ms?: number | null;
  prompt_version?: string | null;
  processing_region?: ProcessingRegion | null;
  requested_service_tier?: ServiceTier | null;
  service_tier?: string | null;
  sources?: { title: string; url: string }[];
}
export interface Playbook {
  id: string;
  name: string;
  content: string;
  created_at?: string;
}
export interface Health {
  status: string;
  api_configured: boolean;
  default_processing_region: ProcessingRegion;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers:
        init?.body instanceof FormData
          ? init.headers
          : { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error(
      'Server nicht erreichbar. Prüfen Sie, ob er läuft, und versuchen Sie es erneut.',
    );
  }
  if (!response.ok) {
    let message = `Die Anfrage konnte nicht abgeschlossen werden (${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data.detail === 'string') message = data.detail;
      else if (typeof data.message === 'string') message = data.message;
      else if (typeof data.error?.message === 'string') message = data.error.message;
    } catch {
      /* Keep a useful error for non-JSON proxy failures. */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
