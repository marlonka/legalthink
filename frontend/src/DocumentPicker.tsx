import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownUp, Check, FileText, Search, X } from 'lucide-react';
import type { DocumentRecord } from './types';
import { Modal } from './ui';
import { MotionButton } from './motion';

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
  const [listHeight, setListHeight] = useState<number>();
  const listRef = useRef<HTMLDivElement>(null);
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

  useLayoutEffect(() => {
    // Keep the opening list size while searching; CSS still caps it on short screens.
    const height = listRef.current?.getBoundingClientRect().height;
    if (height) setListHeight(height);
  }, []);

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
            ? 'Zuerst Original, dann Gegenentwurf auswählen.'
            : 'Bis zu 12 Dokumente pro Analyse.'}
        </p>
        <label className="list-search document-picker-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Dokument suchen …"
            aria-label="Gespeicherte Dokumente durchsuchen"
          />
          <MotionButton
            className={`icon-button small document-search-clear ${search ? '' : 'is-empty'}`}
            onClick={(event) => {
              setSearch('');
              event.currentTarget
                .closest('label')
                ?.querySelector('input')
                ?.focus({ preventScroll: true });
            }}
            aria-label="Dokumentsuche zurücksetzen"
            aria-hidden={!search || undefined}
            tabIndex={search ? 0 : -1}
            disabled={!search}
          >
            <X size={14} />
          </MotionButton>
        </label>
        <div
          ref={listRef}
          className="document-picker-list"
          style={listHeight === undefined ? undefined : { height: listHeight }}
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
                  <span className="document-picker-status-slot" aria-hidden="true">
                    {checked && (
                      <span className="document-picker-number">
                        {compare ? String(index + 1).padStart(2, '0') : <Check size={14} />}
                      </span>
                    )}
                  </span>
                </label>
              );
            })
          ) : (
            <div className="document-picker-empty">
              <strong>
                {search ? 'Keine Dokumente gefunden' : 'Noch keine Dokumente gespeichert'}
              </strong>
              {!search && <p>Dokument unter „Neue Analyse“ hochladen.</p>}
            </div>
          )}
        </div>
        <p className="field-help document-picker-count" role="status">
          {selected.length} von {limit} Dokumenten ausgewählt
        </p>
        {compare && (
          <div className="document-order" aria-label="Vergleichsreihenfolge">
            <div>
              {['01 · Original', '02 · Gegenentwurf'].map((label, index) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong title={selected[index]?.name}>
                    {selected[index]?.name ?? 'Nicht ausgewählt'}
                  </strong>
                </div>
              ))}
            </div>
            <MotionButton
              className="text-button"
              disabled={selected.length !== 2}
              onClick={() => setSelection((previous) => [...previous].reverse())}
            >
              <ArrowDownUp size={14} />
              Reihenfolge tauschen
            </MotionButton>
          </div>
        )}
      </div>
      <div className="modal-footer document-picker-footer">
        <MotionButton className="button secondary" onClick={onClose}>
          Abbrechen
        </MotionButton>
        <MotionButton
          className="button primary"
          disabled={!valid}
          onClick={() => onApply(selection)}
        >
          <span className="stable-action-label">
            <span className="stable-action-size" aria-hidden="true">
              12 Dokumente übernehmen
            </span>
            <span>
              {selected.length} {selected.length === 1 ? 'Dokument' : 'Dokumente'} übernehmen
            </span>
          </span>
        </MotionButton>
      </div>
    </Modal>
  );
}
