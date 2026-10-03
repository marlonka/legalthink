import { FileSearch, GitCompareArrows, ListOrdered, Megaphone, ShieldCheck } from 'lucide-react';
import type { Workflow } from './types';

export const WORKFLOWS = [
  {
    id: 'contract' as Workflow,
    title: 'Vertragsprüfung',
    short: 'Vertrag prüfen',
    label: 'Vertrag',
    icon: FileSearch,
    prompt: 'z. B. Auftraggeber vertreten. Haftung und Kündigung prüfen.',
  },
  {
    id: 'compare' as Workflow,
    title: 'Versionsvergleich',
    short: 'Versionen vergleichen',
    label: 'Vergleich',
    icon: GitCompareArrows,
    prompt: 'z. B. Änderungen zulasten des Auftraggebers prüfen.',
  },
  {
    id: 'chronology' as Workflow,
    title: 'Sachverhalt & Chronologie',
    short: 'Sachverhalt ordnen',
    label: 'Chronologie',
    icon: ListOrdered,
    prompt: 'Parteien, Streitfrage und relevanten Zeitraum angeben.',
  },
  {
    id: 'compliance' as Workflow,
    title: 'Datenschutz & Compliance',
    short: 'Datenschutz prüfen',
    label: 'Datenschutz',
    icon: ShieldCheck,
    prompt: 'z. B. AVV für einen Cloud-Dienstleister prüfen. Rolle: Verantwortlicher.',
  },
  {
    id: 'advertising' as Workflow,
    title: 'Wettbewerb & Werbung',
    short: 'Werbung prüfen',
    label: 'Werbung',
    icon: Megaphone,
    prompt: 'Zielgruppe, Werbemedium und Produkt angeben.',
  },
];
export function workflowName(workflow: Workflow) {
  return WORKFLOWS.find((item) => item.id === workflow)?.title ?? 'Analyse';
}
