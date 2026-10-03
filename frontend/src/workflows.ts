import { FileSearch, GitCompareArrows, ListOrdered, Megaphone, ShieldCheck } from 'lucide-react';
import type { Workflow } from './types';

export const WORKFLOWS = [
  {
    id: 'contract' as Workflow,
    title: 'Vertragsprüfung',
    short: 'Vertrag prüfen',
    description: 'Risiken erkennen. Position stärken.',
    icon: FileSearch,
    prompt:
      'Was ist für diese Prüfung wichtig? Zum Beispiel: Wir vertreten den Auftraggeber. Fokus auf Haftung und Kündigung.',
    context: 'Risiken, fehlende Regelungen und konkrete Formulierungsvorschläge.',
  },
  {
    id: 'compare' as Workflow,
    title: 'Versionsvergleich',
    short: 'Versionen vergleichen',
    description: 'Änderungen und ihre Folgen verstehen.',
    icon: GitCompareArrows,
    prompt:
      'Was soll beim Vergleich im Mittelpunkt stehen? Zum Beispiel: Welche Änderungen verschlechtern unsere Position als Auftraggeber?',
    context: 'Original und Gegenentwurf vergleichen. Zwei Dokumente erforderlich.',
  },
  {
    id: 'chronology' as Workflow,
    title: 'Sachverhalt & Chronologie',
    short: 'Sachverhalt ordnen',
    description: 'Aus Dokumenten wird ein klarer Verlauf.',
    icon: ListOrdered,
    prompt:
      'Welchen Sachverhalt möchten Sie aufbereiten? Beschreiben Sie Parteien, Streitfrage und relevante Zeiträume.',
    context: 'Ereignisse, Beweismittel und offene Fragen aus Ihren Unterlagen.',
  },
  {
    id: 'compliance' as Workflow,
    title: 'Datenschutz & Compliance',
    short: 'Datenschutz prüfen',
    description: 'Pflichten prüfen. Lücken schließen.',
    icon: ShieldCheck,
    prompt:
      'Welche Verarbeitung oder Vereinbarung prüfen wir? Zum Beispiel: AVV für einen Cloud-Dienstleister, Rolle: Verantwortlicher.',
    context: 'Datenschutzpflichten und Regelungslücken nachvollziehbar prüfen.',
  },
  {
    id: 'advertising' as Workflow,
    title: 'Wettbewerb & Werbung',
    short: 'Werbung prüfen',
    description: 'Aussagen prüfen, bevor sie live gehen.',
    icon: Megaphone,
    prompt:
      'Für wen und wo wird geworben? Beschreiben Sie Zielgruppe, Medium und Produkt sowie die zu prüfenden Aussagen.',
    context: 'Werbeaussagen auf mögliche Risiken und Nachweisbedarf prüfen.',
  },
];
export function workflowName(workflow: Workflow) {
  return WORKFLOWS.find((item) => item.id === workflow)?.title ?? 'Analyse';
}
