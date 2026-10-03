import { Quote } from 'lucide-react';
import type { ComparisonSource, Finding } from './types';
import { ExternalLink } from './ui';
import './comparison-results.css';

export type ComparisonSide = 'original' | 'counterdraft';
const CHANGE_NAMES = { modified: 'Geändert', added: 'Ergänzt', removed: 'Gestrichen' };

export function ComparisonFinding({
  finding,
  onShowSource,
}: {
  finding: Finding;
  onShowSource: (side: ComparisonSide) => void;
}) {
  const comparison = finding.comparison;
  return (
    <div className="comparison-finding">
      {comparison ? (
        <>
          <span className="comparison-change">{CHANGE_NAMES[comparison.change_type]}</span>
          <div className="comparison-pair">
            {(['original', 'counterdraft'] as const).map((side) => (
              <ComparisonQuote
                key={side}
                label={side === 'original' ? 'Original' : 'Gegenentwurf'}
                source={comparison[side]}
                onShowSource={() => onShowSource(side)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="comparison-legacy">
          Für diese Analyse sind keine getrennten Textstellen beider Fassungen gespeichert.
        </p>
      )}
      <div className="comparison-assessment">
        <h4>Bewertung der Änderung</h4>
        <p>{finding.description}</p>
      </div>
      {(finding.legal_basis || finding.source_urls?.length) && (
        <div className="legal-basis">
          <span>Rechtsbezug</span>
          <p>{finding.legal_basis}</p>
          {finding.source_urls?.map((url, index) => (
            <ExternalLink key={url} url={url}>
              Recherchebeleg {index + 1}
            </ExternalLink>
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonQuote({
  label,
  source,
  onShowSource,
}: {
  label: string;
  source: ComparisonSource;
  onShowSource: () => void;
}) {
  return (
    <section className="comparison-version" aria-label={label}>
      <h4>{label}</h4>
      <p className="comparison-document">
        {source.source_document_name}
        {source.verified && source.source_location ? ` · ${source.source_location}` : ''}
      </p>
      {source.source_quote ? (
        <>
          <blockquote>{source.source_quote}</blockquote>
          <p className="comparison-verification">
            {source.verified ? 'Zitat im Dokument gefunden' : 'Zitat nicht bestätigt'}
          </p>
          <button
            className="text-button"
            aria-label={`Fundstelle im ${label} ansehen`}
            onClick={onShowSource}
          >
            <Quote size={14} /> Fundstelle ansehen
          </button>
        </>
      ) : (
        <p className="comparison-empty">Keine Textstelle angegeben.</p>
      )}
    </section>
  );
}
