import { forwardRef, type ChangeEvent } from 'react';
import { cn } from '../../lib/cn';
import { DarkSelect, type DarkSelectProps, type SelectOption } from './DarkSelect';

export type { SelectOption } from './DarkSelect';

interface SelectProps
  extends Omit<DarkSelectProps, 'onValueChange' | 'triggerClassName' | 'menuClassName'> {
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  triggerClassName?: string;
  containerClassName?: string;
}

/**
 * Backwards-compatible wrapper over the shared dark select, so existing
 * `onChange={(e) => setState(e.target.value)}` call sites keep working while
 * the popup is rendered and styled by DarkSelect.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ containerClassName, className, options, placeholder, ...rest }, ref) => {
    const normalized: SelectOption[] = (options ?? []).map((o) =>
      typeof o === 'string' ? { value: o, label: o } : o,
    );

    return (
      <DarkSelect
        ref={ref}
        options={normalized}
        placeholder={placeholder}
        triggerClassName={className}
        className={containerClassName}
        {...rest}
      />
    );
  },
);

Select.displayName = 'Select';

export { DarkSelect } from './DarkSelect';