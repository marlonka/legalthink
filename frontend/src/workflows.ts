import { FileSearch, GitCompareArrows, ListOrdered, Megaphone, ShieldCheck } from 'lucide-react';
import type { ComplianceTask, Workflow } from './types';

export const COMPLIANCE_TASKS: {
  id: ComplianceTask;
  label: string;
  short: string;
  prompt: string;
}[] = [
  {
    id: 'general',
    label: 'Allgemein',
    short: 'Allgemein',
    prompt:
      'z. B. Kundenportal geplant: Rollen und Datenflüsse prüfen. Unklar ist, welche Dienstleister Zugriff erhalten.',
  },
  {
    id: 'avv',
    label: 'AVV prüfen',
    short: 'AVV',
    prompt:
      'z. B. Wir vertreten den Kunden eines Hostinganbieters. AVV und Anlagen zu Unterauftragnehmern und Löschung prüfen.',
  },
  {
    id: 'dsfa',
    label: 'DSFA vorbereiten',
    short: 'DSFA',
    prompt:
      'z. B. DSFA für eine geplante Videoüberwachung vorbereiten. Offene Angaben zum Erfassungsbereich und zu Schutzmaßnahmen benennen.',
  },
];

export const WORKFLOWS = [
  {
    id: 'contract' as Workflow,
    title: 'Vertragsprüfung',
    short: 'Vertrag prüfen',
    label: 'Vertrag',
    icon: FileSearch,
    prompt:
      'z. B. Wir vertreten den Kunden. Haftungsgrenzen und Datenherausgabe vor Unterzeichnung prüfen.',
  },
  {
    id: 'compare' as Workflow,
    title: 'Versionsvergleich',
    short: 'Versionen vergleichen',
    label: 'Vergleich',
    icon: GitCompareArrows,
    prompt:
      'z. B. Wir vertreten den Auftraggeber. Änderungen im Gegenentwurf bei Haftung und Kündigung bewerten.',
  },
  {
    id: 'chronology' as Workflow,
    title: 'Sachverhalt & Chronologie',
    short: 'Sachverhalt ordnen',
    label: 'Chronologie',
    icon: ListOrdered,
    prompt:
      'z. B. Softwareprojekt: Ablauf von Lieferung bis Kündigung ordnen. Widersprüchliche Daten in den Unterlagen markieren.',
  },
  {
    id: 'compliance' as Workflow,
    title: 'Datenschutzprüfung',
    short: 'Datenschutz prüfen',
    label: 'Datenschutz',
    icon: ShieldCheck,
    prompt: COMPLIANCE_TASKS[0].prompt,
  },
  {
    id: 'advertising' as Workflow,
    title: 'Wettbewerb & Werbung',
    short: 'Werbung prüfen',
    label: 'Werbung',
    icon: Megaphone,
    prompt:
      'z. B. Produktseite für Kleidung, Verbraucher in Deutschland: „klimaneutral geliefert“ prüfen. Nachweise fehlen bislang.',
  },
];
export function workflowName(workflow: Workflow) {
  return WORKFLOWS.find((item) => item.id === workflow)?.title ?? 'Analyse';
}
