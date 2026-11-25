import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Model } from './types';
import { CUSTOM_EFFORTS, MAX_CUSTOM_MODELS, customModel, validModelId } from './custom-models';
import { EFFORT_NAMES, ErrorMessage, ExternalLink, Modal } from './ui';
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
  // The dialog's validation error and a failed removal are separate notices.
  const [formError, setFormError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const custom = models.filter((model) => model.custom);

  function open(model?: Model) {
    setEditing(model?.id ?? '');
    setId(model?.id ?? '');
    setEfforts(model?.efforts.filter((value) => value !== 'auto') ?? []);
    setResearch(model?.supports_web_search ?? false);
    setFormError('');
  }
  function close() {
    setEditing(null);
    setFormError('');
  }
  return (
    <div className="custom-models">
      {custom.length > 0 && (
        <ul className="custom-model-list">
          {custom.map((model) => (
            <li key={model.id}>
              <span title={model.id}>{model.id}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`${model.id} bearbeiten`}
                onClick={() => open(model)}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
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
                    setRemoveError('');
                  } catch (cause) {
                    setRemoveError(
                      cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.',
                    );
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => open()}
        disabled={custom.length >= MAX_CUSTOM_MODELS}
      >
        <Plus size={15} /> Eigenes Modell hinzufügen
      </button>
      {removeError && <ErrorMessage>{removeError}</ErrorMessage>}
      <AnimatePresence initial={false}>
        {editing !== null && (
          <Modal title={editing ? 'Modell bearbeiten' : 'Eigenes OpenAI-Modell'} onClose={close}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const modelId = id.trim();
                if (!validModelId(modelId)) {
                  setFormError(
                    'Geben Sie die Modell-ID ein: höchstens 120 Zeichen, keine URL und keinen API-Schlüssel.',
                  );
                  return;
                }
                if (models.some((model) => model.id === modelId && model.id !== editing)) {
                  setFormError('Dieses Modell ist bereits vorhanden.');
                  return;
                }
                try {
                  onSave(customModel(modelId, efforts, research));
                  close();
                } catch (cause) {
                  setFormError(
                    cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen.',
                  );
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
                {formError && <ErrorMessage>{formError}</ErrorMessage>}
              </div>
              <div className="modal-footer">
                <button className="button secondary" type="button" onClick={close}>
                  Abbrechen
                </button>
                <button className="button primary" type="submit">
                  Modell speichern
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
