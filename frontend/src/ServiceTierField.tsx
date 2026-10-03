import type { ServiceTier } from './types';
import { ExternalLink } from './ui';

export default function ServiceTierField({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: ServiceTier;
  onChange: (value: ServiceTier) => void;
  disabled?: boolean;
}) {
  return (
    <div className="service-tier-field">
      <label className="field-label" htmlFor={id}>
        Verarbeitungsmodus
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as ServiceTier)}
        disabled={disabled}
        aria-describedby={`${id}-help`}
      >
        <option value="default">Standard</option>
        <option value="flex">Flex</option>
      </select>
      <p className="field-help processing-links" id={`${id}-help`}>
        <ExternalLink url="https://developers.openai.com/api/docs/guides/flex-processing">
          Flex bei OpenAI
        </ExternalLink>
        <ExternalLink url="https://developers.openai.com/api/docs/pricing">
          Preise bei OpenAI
        </ExternalLink>
      </p>
    </div>
  );
}
