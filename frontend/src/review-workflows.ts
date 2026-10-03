import type { Analysis } from './types';

type ReviewKind = Pick<Analysis, 'workflow' | 'compliance_task'>;

export function reviewLabels(analysis: ReviewKind) {
  if (analysis.workflow === 'compare')
    return {
      findings: 'Änderungen',
      suggestion: 'Verhandlungsvorschlag',
      suggestions: 'Verhandlungsvorschläge',
      questions: 'Offene Fragen',
      count: 'Änderungen',
    };
  if (analysis.workflow === 'chronology')
    return {
      findings: 'Prüfpunkte',
      suggestion: 'Textvorschlag',
      suggestions: 'Textvorschläge',
      questions: 'Offene Fragen',
      count: 'Ereignisse',
    };
  if (analysis.workflow === 'advertising')
    return {
      findings: 'Werbeaussagen',
      suggestion: 'Textalternative',
      suggestions: 'Textalternativen',
      questions: 'Offene Fragen',
      count: 'Prüfpunkte',
    };
  if (analysis.workflow === 'compliance' && analysis.compliance_task !== 'avv')
    return {
      findings:
        analysis.compliance_task === 'dsfa' ? 'Risiken und Prüfpunkte' : 'Datenschutzfragen',
      suggestion: 'Textvorschlag',
      suggestions: 'Textvorschläge',
      questions: 'Offene Angaben',
      count: 'Prüfpunkte',
    };
  return {
    findings: 'Vertragspunkte',
    suggestion: 'Klauselvorschlag',
    suggestions: 'Klauselvorschläge',
    questions: analysis.workflow === 'compliance' ? 'Offene Angaben' : 'Offene Fragen',
    count: 'Vertragspunkte',
  };
}

export function reviewCount(analysis: Analysis) {
  const count =
    analysis.workflow === 'chronology' ? analysis.timeline.length : analysis.findings.length;
  const label = reviewLabels(analysis).count;
  const singular: Record<string, string> = {
    Änderungen: 'Änderung',
    Ereignisse: 'Ereignis',
    Prüfpunkte: 'Prüfpunkt',
    Vertragspunkte: 'Vertragspunkt',
  };
  return `${count} ${count === 1 ? singular[label] : label}`;
}
