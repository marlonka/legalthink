import type { ServiceTier } from './types';

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
        Verarbeitung
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
      <p className="field-help" id={`${id}-help`}>
        Flex: 50 % niedrigere Tokenpreise, längere Wartezeit und zeitweise nicht verfügbar.
        Suchgebühren bleiben unverändert. Kein automatischer Wechsel zu Standard.
      </p>
    </div>
  );
}
