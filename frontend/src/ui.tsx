import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { ArrowUpRight, Check, ChevronDown, X } from 'lucide-react';
import type { Model } from './types';
import { MotionButton, useMotionPreferences } from './motion';
import './overlay-motion.css';

export const DEFAULT_MODELS: Model[] = [
  {
    id: 'gpt-6-luna',
    name: 'GPT-6 Luna',
    description: '',
    efforts: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
    default_effort: 'high',
  },
  {
    id: 'gpt-6.1-sol',
    name: 'GPT-6.1 Sol',
    description: '',
    efforts: ['low', 'medium', 'high', 'xhigh', 'max'],
    default_effort: 'medium',
  },
];
export const EFFORT_NAMES: Record<string, string> = {
  none: 'Ohne',
  low: 'Niedrig',
  medium: 'Mittel',
  high: 'Hoch',
  xhigh: 'Sehr hoch',
  max: 'Maximum',
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg className="brand-symbol" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M7 5v22h19M14 5v15h12" />
      </svg>
      {!compact && (
        <span>
          LegalThink<span className="brand-suffix">GPT</span>
        </span>
      )}
    </span>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const { reduced, transition } = useMotionPreferences();
  return (
    <motion.div
      className="page-transition"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={transition('fade')}
    >
      {children}
    </motion.div>
  );
}

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';
type ActiveModal = { portal: HTMLDivElement; dialog: HTMLDivElement };
const modalStack: ActiveModal[] = [];
const backgroundState = new Map<HTMLElement, boolean>();
let originalOverflow = '';
let originalFocus: HTMLElement | null = null;

function focusDialog(dialog: HTMLDivElement) {
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 2 && bounds.height > 2 && !element.closest('[inert]');
    },
  );
  const autofocus = controls.find((element) => element.hasAttribute('autofocus'));
  const editable = controls.find((element) =>
    element.matches('input:not([type="file"]), textarea, select'),
  );
  // React autoFocus runs before a new portal is attached. Focus its editable field here.
  (autofocus ?? editable ?? controls[0] ?? dialog).focus({ preventScroll: true });
}

function lockModal(modal: ActiveModal) {
  if (backgroundState.size === 0) {
    originalFocus = document.activeElement as HTMLElement | null;
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    for (const element of Array.from(document.body.children)) {
      if (!(element instanceof HTMLElement) || element.hasAttribute('data-modal-portal')) continue;
      backgroundState.set(element, element.inert);
      element.inert = true;
    }
  }
  modalStack.push(modal);
  for (const item of modalStack) item.portal.inert = item !== modal;
  focusDialog(modal.dialog);
  return () => {
    const index = modalStack.indexOf(modal);
    if (index < 0) return;
    const wasTop = index === modalStack.length - 1;
    modalStack.splice(index, 1);
    const top = modalStack.at(-1);
    if (top) {
      top.portal.inert = false;
      if (wasTop) focusDialog(top.dialog);
      return;
    }
    // A replacement dialog can mount in this commit. Keep its lock and original trigger.
    queueMicrotask(() => {
      if (modalStack.length) return;
      for (const [element, wasInert] of backgroundState) element.inert = wasInert;
      backgroundState.clear();
      document.body.style.overflow = originalOverflow;
      if (originalFocus?.isConnected && !originalFocus.closest('[inert]'))
        originalFocus.focus({ preventScroll: true });
      originalFocus = null;
    });
  };
}

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const present = useIsPresent();
  const { reduced, transition } = useMotionPreferences();
  const [portal] = useState(() => {
    const element = document.createElement('div');
    element.setAttribute('data-modal-portal', '');
    return element;
  });
  useLayoutEffect(() => {
    document.body.appendChild(portal);
    return () => portal.remove();
  }, [portal]);
  useLayoutEffect(() => {
    portal.inert = !present;
    if (!present || !ref.current) return;
    const unlock = lockModal({ portal, dialog: ref.current });
    const handleKey = (event: KeyboardEvent) => {
      if (modalStack.at(-1)?.portal !== portal) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width > 2 && bounds.height > 2 && !element.closest('[inert]');
      });
      const firstElement = focusable[0],
        lastElement = focusable.at(-1);
      if (!firstElement) {
        event.preventDefault();
        ref.current?.focus();
      } else if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      unlock();
    };
  }, [portal, present]);
  return createPortal(
    <motion.div
      className="modal-backdrop motion-modal-backdrop"
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition('fade')}
      onMouseDown={(event) => {
        if (present && event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transition('fade')}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <MotionButton className="icon-button" onClick={onClose} aria-label="Dialog schließen">
            <X size={19} />
          </MotionButton>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    portal,
  );
}

function PickerPopover({
  children,
  id,
  effort,
}: {
  children: ReactNode;
  id: string;
  effort: boolean;
}) {
  const present = useIsPresent();
  const { reduced, transition } = useMotionPreferences();
  return (
    <motion.div
      id={id}
      className={`picker-popover motion-picker-popover ${effort ? 'effort-popover' : ''}`}
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition('fade')}
    >
      {children}
    </motion.div>
  );
}

function StablePickerLabel({ value, alternatives }: { value: string; alternatives: string[] }) {
  return (
    <span className="stable-picker-label">
      {alternatives.map((label) => (
        <span key={label} className="picker-label-reserve" aria-hidden="true">
          {label}
        </span>
      ))}
      <span>{value}</span>
    </span>
  );
}

export function ModelPicker({
  models,
  model,
  effort,
  onModel,
  onEffort,
  disabled = false,
}: {
  models: Model[];
  model: string;
  effort: string;
  onModel: (value: string) => void;
  onEffort: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState<'model' | 'effort' | null>(null);
  const { reduced, transition } = useMotionPreferences();
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((item) => item.id === model) ?? models[0];
  const menuId = useId();
  const effortIndex = Math.max(0, current.efforts.indexOf(effort));
  const effortLabels = Array.from(
    new Set(models.flatMap((item) => item.efforts.map((value) => EFFORT_NAMES[value] ?? value))),
  );
  function closePicker() {
    setOpen(null);
    ref.current
      ?.querySelector<HTMLButtonElement>(`[data-picker="${open}"]`)
      ?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!open) return;
    const listener = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', listener);
    return () => document.removeEventListener('pointerdown', listener);
  }, [open]);
  return (
    <div
      className="model-picker"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closePicker();
        }
      }}
    >
      <MotionButton
        type="button"
        className="picker-button"
        title={current.name}
        data-picker="model"
        aria-expanded={open === 'model'}
        aria-controls={`${menuId}-model`}
        onClick={() => setOpen(open === 'model' ? null : 'model')}
        disabled={disabled}
      >
        <StablePickerLabel
          value={current.name}
          alternatives={Array.from(new Set(models.map((item) => item.name)))}
        />
        <motion.span
          className="picker-chevron"
          animate={{ rotate: reduced ? 0 : open === 'model' ? 180 : 0 }}
          transition={transition('control')}
        >
          <ChevronDown size={12} />
        </motion.span>
      </MotionButton>
      <span className="picker-divider" />
      <MotionButton
        type="button"
        className="picker-button effort-picker"
        data-picker="effort"
        aria-label={`Denkaufwand: ${EFFORT_NAMES[effort] ?? effort}`}
        aria-expanded={open === 'effort'}
        aria-controls={`${menuId}-effort`}
        onClick={() => setOpen(open === 'effort' ? null : 'effort')}
        disabled={disabled}
      >
        <StablePickerLabel value={EFFORT_NAMES[effort] ?? effort} alternatives={effortLabels} />
        <motion.span
          className="picker-chevron"
          animate={{ rotate: reduced ? 0 : open === 'effort' ? 180 : 0 }}
          transition={transition('control')}
        >
          <ChevronDown size={12} />
        </motion.span>
      </MotionButton>
      <AnimatePresence initial={false}>
        {open && (
          <PickerPopover key="picker" id={`${menuId}-${open}`} effort={open === 'effort'}>
            {open === 'model' ? (
              models.map((item) => (
                <MotionButton
                  key={item.id}
                  type="button"
                  className="picker-option"
                  disabled={disabled}
                  aria-pressed={model === item.id}
                  onClick={() => {
                    onModel(item.id);
                    if (!item.efforts.includes(effort)) onEffort(item.default_effort);
                    closePicker();
                  }}
                >
                  <span>
                    <strong>{item.name}</strong>
                  </span>
                  {model === item.id && <Check size={16} />}
                </MotionButton>
              ))
            ) : (
              <div className="effort-control">
                <output className="effort-current" htmlFor={`${menuId}-range`}>
                  {EFFORT_NAMES[effort] ?? effort}
                </output>
                <div className="effort-track">
                  <input
                    id={`${menuId}-range`}
                    className="effort-range"
                    type="range"
                    disabled={disabled}
                    min={0}
                    max={current.efforts.length - 1}
                    step={1}
                    value={effortIndex}
                    aria-label="Denkaufwand"
                    aria-valuetext={EFFORT_NAMES[effort] ?? effort}
                    aria-describedby={`${menuId}-cost`}
                    onChange={(event) => onEffort(current.efforts[Number(event.target.value)])}
                    style={
                      {
                        '--effort-progress': `${(effortIndex / Math.max(1, current.efforts.length - 1)) * 100}%`,
                      } as CSSProperties
                    }
                  />
                  <div className="effort-ticks" aria-hidden="true">
                    {current.efforts.map((value, index) => (
                      <span
                        key={value}
                        style={{
                          left: `${(index / Math.max(1, current.efforts.length - 1)) * 100}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            {open === 'effort' && (
              <p className="popover-note" id={`${menuId}-cost`}>
                Höherer Denkaufwand kann länger dauern und mehr kosten.
              </p>
            )}
          </PickerPopover>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ExternalLink({ url, children }: { url: string; children: ReactNode }) {
  if (!/^https?:\/\//i.test(url)) return <span>{children}</span>;
  return (
    <a className="external-link" href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="error-message">
      {children}
    </p>
  );
}

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        date,
      );
}
