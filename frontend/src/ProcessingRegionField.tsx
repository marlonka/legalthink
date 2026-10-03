import type { ProcessingRegion } from './types';
import { ExternalLink } from './ui';

export default function ProcessingRegionField({
  id,
  value,
  serverDefaultRegion,
  onChange,
  disabled = false,
}: {
  id: string;
  value: ProcessingRegion | null;
  serverDefaultRegion: ProcessingRegion | undefined;
  onChange: (value: ProcessingRegion | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="processing-region-field">
      <label className="field-label" htmlFor={id}>
        Verarbeitungsregion
      </label>
      <select
        id={id}
        value={value ?? 'server'}
        onChange={(event) =>
          onChange(
            event.target.value === 'server' ? null : (event.target.value as ProcessingRegion),
          )
        }
        disabled={disabled}
        aria-describedby={`${id}-help`}
      >
        <option value="server">
          Servervorgabe
          {serverDefaultRegion ? ` · ${serverDefaultRegion === 'eu' ? 'Europa' : 'Global'}` : ''}
        </option>
        <option value="global">Global</option>
        <option value="eu">Europa (EWR + Schweiz)</option>
      </select>
      <p className="field-help processing-links" id={`${id}-help`}>
        <ExternalLink url="https://developers.openai.com/api/docs/guides/your-data#data-residency-controls">
          Regionen bei OpenAI
        </ExternalLink>
      </p>
    </div>
  );
}
