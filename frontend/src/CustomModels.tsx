import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Model } from './types';
import { CUSTOM_EFFORTS, MAX_CUSTOM_MODELS, validModelId } from './custom-models';
import { EFFORT_NAMES, ErrorMessage, ExternalLink, Modal } from './ui';
import { MotionButton } from './motion';
import './custom-models.css';

export default function CustomModels({
  models,
  selected,
  onSave,
  onRemove,
}: {
  models: Model[];
  selected: string;
  onSave: (model: Model) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [id, setId] = useState('');
  const [efforts, setEfforts] = useState<string[]>([]);
  const [research, setResearch] = useState(false);
  const [error, setError] = useState('');
  const custom = models.filter((model) => model.custom);

  function open(model?: Model) {
    setEditing(model?.id ?? '');
    setId(model?.id ?? '');
    setEfforts(model?.efforts.filter((value) => value !== 'auto') ?? []);
    setResearch(model?.supports_web_search ?? false);
    setError('');
  }
  return (
    <div className="custom-models">
      {custom.length > 0 && (
        <ul className="custom-model-list">
          {custom.map((model) => (
            <li key={model.id}>
              <span title={model.id}>{model.id}</span>
              <MotionButton
                className="icon-button"
                aria-label={`${model.id} bearbeiten`}
                onClick={() => open(model)}
              >
                <Pencil size={15} />
              </MotionButton>
              <MotionButton
                className="icon-button"
                aria-label={`${model.id} entfernen`}
                disabled={selected === model.id}
                title={
                  selected === model.id
                    ? 'Wählen Sie zuerst ein anderes Modell.'
                    : 'Modell entfernen'
                }
                onClick={() => {
                  try {
                    onRemove(model.id);
                    setError('');
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.');
                  }
                }}
              >
                <Trash2 size={15} />
              </MotionButton>
            </li>
          ))}
        </ul>
      )}
      <MotionButton
        className="text-button"
        onClick={() => open()}
        disabled={custom.length >= MAX_CUSTOM_MODELS}
      >
        <Plus size={15} /> Eigenes Modell hinzufügen
      </MotionButton>
      {editing === null && error && <ErrorMessage>{error}</ErrorMessage>}
      <AnimatePresence initial={false}>
        {editing !== null && (
          <Modal
            title={editing ? 'Modell bearbeiten' : 'Eigenes OpenAI-Modell'}
            onClose={() => setEditing(null)}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const modelId = id.trim();
                if (!validModelId(modelId)) {
                  setError(
                    'Geben Sie die Modell-ID ein: höchstens 120 Zeichen, keine URL und keinen API-Schlüssel.',
                  );
                  return;
                }
                if (models.some((model) => model.id === modelId && model.id !== editing)) {
                  setError('Dieses Modell ist bereits vorhanden.');
                  return;
                }
                try {
                  onSave({
                    id: modelId,
                    name: modelId,
                    custom: true,
                    default_effort: 'auto',
                    efforts: ['auto', ...CUSTOM_EFFORTS.filter((value) => efforts.includes(value))],
                    supports_web_search: research,
                  });
                  setEditing(null);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.');
                }
              }}
            >
              <div className="modal-body custom-model-form">
                <label className="field-label">
                  OpenAI-Modell-ID
                  <input
                    value={id}
                    onChange={(event) => setId(event.target.value)}
                    readOnly={Boolean(editing)}
                    maxLength={120}
                    autoFocus
                    required
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Exakte ID aus der OpenAI-Dokumentation"
                  />
                </label>
                <p className="field-help">
                  Benötigt die Responses API und Structured Outputs. Verfügbarkeit und Einstellungen
                  hängen vom Modell und Ihrem OpenAI-Projekt ab.
                </p>
                <ExternalLink url="https://developers.openai.com/api/docs/models">
                  OpenAI-Modelle und Fähigkeiten
                </ExternalLink>
                <fieldset className="custom-model-efforts">
                  <legend>Unterstützte Denkstufen laut OpenAI</legend>
                  <p className="field-help">
                    Ohne Auswahl gilt der Modellstandard. Aktivieren Sie nur dokumentierte Werte.
                  </p>
                  <div>
                    {CUSTOM_EFFORTS.map((value) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={efforts.includes(value)}
                          onChange={(event) =>
                            setEfforts((previous) =>
                              event.target.checked
                                ? [...previous, value]
                                : previous.filter((item) => item !== value),
                            )
                          }
                        />
                        {EFFORT_NAMES[value]} <code>{value}</code>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="custom-model-research">
                  <input
                    type="checkbox"
                    checked={research}
                    onChange={(event) => setResearch(event.target.checked)}
                  />{' '}
                  Unterstützt Websuche in der Responses API
                </label>
                <p className="field-help">
                  Hinzufügen sendet keine API-Anfrage und ändert Ihre Modellauswahl nicht.
                </p>
                {error && <ErrorMessage>{error}</ErrorMessage>}
              </div>
              <div className="modal-footer">
                <MotionButton
                  className="button secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Abbrechen
                </MotionButton>
                <MotionButton className="button primary" type="submit">
                  Modell speichern
                </MotionButton>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
