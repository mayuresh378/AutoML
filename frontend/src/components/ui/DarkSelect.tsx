import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Position {
  top: number;
  left: number;
  width: number;
  minWidth: number;
  maxHeight: number;
  openUp: boolean;
}

export interface DarkSelectProps {
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  /** Direct value callback, preferred for new call sites. */
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  label?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
  /** Compact trigger for dense toolbars and tables. */
  size?: 'sm' | 'md';
}

/**
 * The single dark-themed select for the whole application.
 *
 * Native <select> popups are painted by the OS, not the page. `color-scheme`
 * alone is unreliable across platforms, so every dropdown is rendered in a
 * portal that we style explicitly, which also keeps it from being clipped by
 * cards, modals, tables and scroll containers.
 *
 * A visually hidden native <select> is kept in sync underneath so form
 * submission, validation, ref access and existing tests that read
 * `.options` all continue to work.
 */
export const DarkSelect = forwardRef<HTMLSelectElement, DarkSelectProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      options,
      placeholder,
      disabled,
      required,
      name,
      id,
      label,
      className,
      triggerClassName,
      menuClassName,
      size = 'md',
      ...aria
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [innerValue, setInnerValue] = useState(defaultValue ?? '');
    const currentValue = isControlled ? (value as string) : innerValue;

    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(-1);
    const [position, setPosition] = useState<Position | null>(null);

    const generatedId = useId();
    const selectId = id || generatedId;
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const nativeRef = useRef<HTMLSelectElement | null>(null);
    const typeahead = useRef({ query: '', timer: 0 });

  // jsdom does not implement scrollIntoView, so guard every call.
    const scrollIntoView = useCallback((node: Element | null | undefined) => {
      if (typeof node?.scrollIntoView === 'function') node.scrollIntoView({ block: 'nearest' });
    }, []);

    const selected = useMemo(
      () => options.find((o) => o.value === currentValue) ?? null,
      [options, currentValue],
    );
    const hasValue = currentValue !== '' && selected !== null;

    // Keep the hidden native control in step for both controlled and
    // uncontrolled usage.
    useEffect(() => {
      if (nativeRef.current && nativeRef.current.value !== currentValue) {
        nativeRef.current.value = currentValue;
      }
    }, [currentValue]);

    const commit = useCallback(
      (next: string) => {
        if (!isControlled) setInnerValue(next);
        // Hand existing `onChange={(e) => setState(e.target.value)}` handlers a
        // real change event whose target is the hidden native select, so no
        // call site has to be rewritten.
        const native = nativeRef.current;
        if (native) {
          if (native.value !== next) native.value = next;
          onChange?.({ target: native, currentTarget: native } as ChangeEvent<HTMLSelectElement>);
        } else {
          onChange?.({ target: { value: next } } as unknown as ChangeEvent<HTMLSelectElement>);
        }
        onValueChange?.(next);
      },
      [isControlled, onChange, onValueChange],
    );

    const enabledOptions = useMemo(() => options.filter((o) => !o.disabled), [options]);

    useEffect(() => {
      if (!open) return;
      const idx = enabledOptions.findIndex((o) => o.value === currentValue);
      setHighlight(idx >= 0 ? idx : 0);
    }, [open, enabledOptions, currentValue]);

    const moveHighlight = useCallback(
      (dir: 1 | -1) => {
        setHighlight((h) => {
          const n = enabledOptions.length;
          if (n === 0) return -1;
          const next = h + dir;
          if (next < 0) return n - 1;
          if (next >= n) return 0;
          return next;
        });
      },
      [enabledOptions],
    );

    // Commit and dismiss. Every selection path funnels through this so the menu
    // always closes, whichever route the value was chosen by.
    const choose = useCallback(
      (next: string) => {
        commit(next);
        setOpen(false);
      },
      [commit],
    );

    const selectHighlighted = useCallback(() => {
      const opt = enabledOptions[highlight];
      if (opt) choose(opt.value);
    }, [enabledOptions, highlight, choose]);

    const onKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        if (!open) {
          if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
          }
          return;
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            moveHighlight(1);
            break;
          case 'ArrowUp':
            e.preventDefault();
            moveHighlight(-1);
            break;
          case 'Home':
            e.preventDefault();
            setHighlight(0);
            break;
          case 'End':
            e.preventDefault();
            setHighlight(enabledOptions.length - 1);
            break;
          case 'Enter':
            e.preventDefault();
            selectHighlighted();
            break;
          case 'Escape':
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            break;
          case 'Tab':
            setOpen(false);
            break;
          default: {
            if (e.key.length !== 1) return;
            // Type-to-jump, matching native select behaviour.
            window.clearTimeout(typeahead.current.timer);
            typeahead.current.query += e.key.toLowerCase();
            typeahead.current.timer = window.setTimeout(() => {
              typeahead.current.query = '';
            }, 700);
            const q = typeahead.current.query;
            const found = enabledOptions.findIndex((o) => o.label.toLowerCase().startsWith(q));
            if (found >= 0) {
              setHighlight(found);
              scrollIntoView(listRef.current?.querySelector(`[data-index="${found}"]`));
            }
          }
        }
      },
      [disabled, open, moveHighlight, selectHighlighted, enabledOptions, scrollIntoView],
    );

    useLayoutEffect(() => {
      if (!open) return;
      const update = () => {
        const el = triggerRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const spaceBelow = vh - r.bottom - 12;
        const spaceAbove = r.top - 12;
        const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
        const maxHeight = Math.max(140, Math.min(320, openUp ? spaceAbove : spaceBelow));
        const width = Math.max(r.width, 140);
        setPosition({
          top: openUp ? Math.max(8, r.top - 8 - maxHeight) : r.bottom + 6,
          left: Math.min(Math.max(8, r.left), Math.max(8, vw - width - 8)),
          width,
          minWidth: Math.min(width, vw - 16),
          maxHeight,
          openUp,
        });
      };
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
      };
    }, [open]);

    useEffect(() => {
      if (open && highlight >= 0) {
        scrollIntoView(listRef.current?.querySelector(`[data-index="${highlight}"]`));
      }
    }, [open, highlight, scrollIntoView]);

    useEffect(() => {
      if (!open) return;
      const onPointerDown = (e: PointerEvent | MouseEvent) => {
        const t = e.target as Node;
        if (triggerRef.current?.contains(t)) return;
        if (menuRef.current?.contains(t)) return;
        setOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [open]);

    useEffect(() => {
      if (!open) setHighlight(-1);
    }, [open]);

    const triggerText = hasValue ? selected!.label : placeholder;

    const menu = open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={cn(
              'fixed overflow-hidden rounded-xl border border-white/10 bg-zinc-900 text-zinc-100 shadow-dropdown',
              menuClassName,
            )}
            style={{
              top: position.top,
              left: position.left,
              minWidth: position.minWidth,
              maxWidth: position.width,
              maxHeight: position.maxHeight,
              // Above command palettes and the hard-coded z-index dialogs so a
              // menu opened inside a modal is never painted behind it.
              zIndex: 'var(--z-select-menu)',
            }}
            onKeyDown={onKeyDown}
          >
            <div
              ref={listRef}
              id={`${selectId}-listbox`}
              role="listbox"
              aria-label={label || aria['aria-label'] || 'Options'}
              className="overflow-y-auto overscroll-contain py-1 popover-scroll"
              style={{ maxHeight: position.maxHeight }}
            >
              {options.map((opt, i) => {
                const isSelected = opt.value === currentValue;
                const isActive = enabledOptions[highlight]?.value === opt.value && !isSelected;
                const enabledIndex = enabledOptions.findIndex((o) => o.value === opt.value);
                return (
                  <div
                    key={opt.value}
                    id={`${selectId}-option-${i}`}
                    role="option"
                    data-value={opt.value}
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    data-index={enabledIndex}
                    onMouseEnter={() => !opt.disabled && setHighlight(enabledIndex)}
                    onClick={() => !opt.disabled && choose(opt.value)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors duration-100',
                      !opt.disabled && (isActive || isSelected)
                        ? 'bg-zinc-800 text-zinc-50'
                        : 'text-zinc-200',
                      !opt.disabled && !isActive && !isSelected && 'hover:bg-zinc-800 hover:text-zinc-50',
                      opt.disabled && 'cursor-not-allowed text-zinc-600',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </div>
                );
              })}
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-zinc-500">No options available</div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-zinc-300">
            {label}
          </label>
        )}
        <div className="relative">
          <button
            ref={triggerRef}
            id={selectId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? `${selectId}-listbox` : undefined}
            aria-required={required || undefined}
            // role="combobox" cannot take its name from the trigger's text, so
            // without this a screen reader announces the control as unlabelled.
            aria-label={
              aria['aria-label'] || aria['aria-labelledby'] ? undefined : label || placeholder || 'Select an option'
            }
            disabled={disabled}
            onClick={() => !disabled && setOpen((o) => !o)}
            onKeyDown={onKeyDown}
            {...aria}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card text-left transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50',
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
              'text-zinc-100 placeholder:text-zinc-500',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-primary/30',
              open && 'border-primary/50',
              triggerClassName,
            )}
          >
            <span className={cn('truncate', !hasValue && 'text-zinc-500')}>
              {triggerText ?? ''}
            </span>
            <ChevronDown
              className={cn(
                'pointer-events-none shrink-0 text-zinc-500 transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </button>

          {/* Keeps form submission, validation and native ref access working. */}
          <select
            ref={(el) => {
              nativeRef.current = el;
              if (typeof ref === 'function') ref(el);
              else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = el;
            }}
            tabIndex={-1}
            name={name}
            required={required}
            disabled={disabled}
            aria-hidden="true"
            defaultValue={defaultValue}
            value={isControlled ? currentValue : undefined}
            onChange={(e) => {
              if (!isControlled) setInnerValue(e.target.value);
              onValueChange?.(e.target.value);
            }}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
              opacity: 0,
              pointerEvents: 'none',
            }}
          >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {menu}
      </div>
    );
  },
);

DarkSelect.displayName = 'DarkSelect';