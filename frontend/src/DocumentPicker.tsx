import { useId, useState } from 'react';
import { ArrowDownUp, Check, FileText, Search, X } from 'lucide-react';
import type { DocumentRecord } from './types';
import { Modal } from './ui';

interface Props {
  documents: DocumentRecord[];
  selectedIds: string[];
  compare: boolean;
  onApply: (ids: string[]) => void;
  onClose: () => void;
}

export default function DocumentPicker({
  documents,
  selectedIds,
  compare,
  onApply,
  onClose,
}: Props) {
  const [selection, setSelection] = useState(selectedIds);
  const [search, setSearch] = useState('');
  const hintId = useId();
  const limit = compare ? 2 : 12;
  const filtered = documents.filter((document) =>
    document.name.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE')),
  );
  const selected = selection
    .map((id) => documents.find((document) => document.id === id))
    .filter((document): document is DocumentRecord => Boolean(document));
  const valid =
    selected.length > 0 && selected.length <= limit && (!compare || selected.length === 2);

  function toggle(id: string) {
    setSelection((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : previous.length < limit
          ? [...previous, id]
          : previous,
    );
  }

  return (
    <Modal title="Gespeicherte Dokumente" onClose={onClose} wide>
      <div className="modal-body document-picker-body">
        <p className="modal-description" id={hintId}>
          {compare
            ? 'Wählen Sie zuerst das Original, dann den Gegenentwurf. Die Reihenfolge lässt sich anschließend tauschen.'
            : 'Verwenden Sie bereits hochgeladene Unterlagen für einen neuen Prüfauftrag. Bis zu 12 Dokumente pro Analyse.'}
        </p>
        <label className="list-search document-picker-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Dokument suchen …"
            aria-label="Gespeicherte Dokumente durchsuchen"
          />
          {search && (
            <button
              className="icon-button small"
              onClick={() => setSearch('')}
              aria-label="Dokumentsuche zurücksetzen"
            >
              <X size={14} />
            </button>
          )}
        </label>
        {compare && selected.length > 0 && (
          <div className="document-order" aria-label="Vergleichsreihenfolge">
            <div>
              {selected.map((document, index) => (
                <div key={document.id}>
                  <span>
                    {index === 0
                      ? '01 · Original'
                      : index === 1
                        ? '02 · Gegenentwurf'
                        : 'Zusätzlich'}
                  </span>
                  <strong>{document.name}</strong>
                </div>
              ))}
            </div>
            {selected.length === 2 && (
              <button
                className="text-button"
                onClick={() => setSelection((previous) => [...previous].reverse())}
              >
                <ArrowDownUp size={14} />
                Reihenfolge tauschen
              </button>
            )}
          </div>
        )}
        <div
          className="document-picker-list"
          role="group"
          aria-label="Dokumentauswahl"
          aria-describedby={hintId}
        >
          {filtered.length ? (
            filtered.map((document) => {
              const index = selection.indexOf(document.id);
              const checked = index !== -1;
              const disabled = !checked && selection.length >= limit;
              return (
                <label
                  key={document.id}
                  className={`document-picker-row ${checked ? 'is-selected' : ''} ${disabled ? 'is-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(document.id)}
                    aria-label={document.name}
                  />
                  <FileText size={19} strokeWidth={1.5} />
                  <span className="document-picker-name">
                    <strong>{document.name}</strong>
                    <small>
                      {document.page_count
                        ? `${document.page_count} ${document.page_count === 1 ? 'Seite' : 'Seiten'} · `
                        : ''}
                      {document.char_count.toLocaleString('de-DE')} Zeichen
                    </small>
                  </span>
                  {checked && (
                    <span className="document-picker-number" aria-hidden="true">
                      {compare ? String(index + 1).padStart(2, '0') : <Check size={14} />}
                    </span>
                  )}
                </label>
              );
            })
          ) : (
            <div className="document-picker-empty">
              <FileText size={24} strokeWidth={1.4} />
              <strong>
                {search ? 'Keine Dokumente gefunden' : 'Noch keine Dokumente gespeichert'}
              </strong>
              <p>
                {search
                  ? 'Versuchen Sie einen anderen Suchbegriff.'
                  : 'Laden Sie ein Dokument im Arbeitsraum hoch.'}
              </p>
            </div>
          )}
        </div>
        <p className="field-help document-picker-count" role="status">
          {selected.length} von {limit} Dokumenten ausgewählt
          {compare && selected.length === 1
            ? ' · Wählen Sie den Gegenentwurf.'
            : selected.length === limit
              ? ' · Auswahl vollständig.'
              : '.'}
        </p>
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={onClose}>
          Abbrechen
        </button>
        <button className="button primary" disabled={!valid} onClick={() => onApply(selection)}>
          {selected.length} {selected.length === 1 ? 'Dokument' : 'Dokumente'} übernehmen
        </button>
      </div>
    </Modal>
  );
}
