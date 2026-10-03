import type { Analysis, Finding } from './types';
import { ExternalLink } from './ui';
import './workflow-results.css';

export interface WorkflowFindingContentProps {
  analysis: Pick<Analysis, 'workflow' | 'compliance_task'>;
  finding: Finding;
}

export function WorkflowFindingContent({ analysis, finding }: WorkflowFindingContentProps) {
  const compliance = analysis.workflow === 'compliance';
  const dsfa = compliance && analysis.compliance_task === 'dsfa';
  const advertising = analysis.workflow === 'advertising';
  const contract = analysis.workflow === 'contract';
  const quoteLabel = advertising
    ? 'Zitierte Textstelle'
    : contract || (compliance && analysis.compliance_task === 'avv')
      ? 'Textstelle zur Klausel'
      : 'Quellenauszug';
  const descriptionLabel = dsfa
    ? 'Risiko / Klärungsbedarf'
    : compliance
      ? 'Prüfergebnis'
      : 'Einordnung';
  const researchUrls = [...new Set(finding.source_urls ?? [])].filter((url) =>
    /^https?:\/\//i.test(url),
  );
  const evidence = finding.source_quote.trim() ? (
    <div className="workflow-finding-section workflow-finding-evidence">
      <dt>{quoteLabel}</dt>
      <dd>
        <blockquote>{finding.source_quote}</blockquote>
        {!finding.verified && <p className="workflow-finding-unverified">Zitat nicht bestätigt</p>}
      </dd>
    </div>
  ) : null;

  return (
    <dl className="workflow-finding-content">
      {!compliance && evidence}
      {finding.description.trim() && (
        <div className="workflow-finding-section">
          <dt>{descriptionLabel}</dt>
          <dd>{finding.description}</dd>
        </div>
      )}
      {compliance && evidence}
      {(finding.legal_basis.trim() || researchUrls.length > 0) && (
        <div className="workflow-finding-section workflow-finding-law">
          <dt>{finding.legal_basis.trim() ? 'Rechtsbezug' : 'Recherchebelege'}</dt>
          <dd>
            {finding.legal_basis.trim() && <p>{finding.legal_basis}</p>}
            {researchUrls.length > 0 && (
              <ul className="workflow-finding-research">
                {researchUrls.map((url, index) => (
                  <li key={url}>
                    <ExternalLink url={url}>Recherchebeleg {index + 1}</ExternalLink>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}
