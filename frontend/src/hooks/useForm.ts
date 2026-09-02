import { useState, useCallback, type ChangeEvent } from 'react';

interface FieldState<T = string> {
  value: T;
  error: string;
  touched: boolean;
  dirty: boolean;
}

interface UseFormOptions<T extends Record<string, any>> {
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => Promise<void> | void;
}

type FormFields<T> = {
  [K in keyof T]: FieldState<T[K]>;
};

export function useForm<T extends Record<string, any>>({ initialValues, validate, onSubmit }: UseFormOptions<T>) {
  const initialFields = Object.keys(initialValues).reduce((acc, key) => {
    acc[key as keyof T] = { value: initialValues[key], error: '', touched: false, dirty: false };
    return acc;
  }, {} as FormFields<T>);

  const [fields, setFields] = useState<FormFields<T>>(initialFields);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const setValue = useCallback((name: keyof T, value: T[keyof T]) => {
    setFields(prev => ({
      ...prev,
      [name]: { ...prev[name], value, dirty: true, touched: true, error: '' },
    }));
    setFormError(null);
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setValue(name as keyof T, val as T[keyof T]);
  }, [setValue]);

  const handleBlur = useCallback((e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name } = e.target;
    setFields(prev => ({
      ...prev,
      [name]: { ...prev[name], touched: true },
    }));
  }, []);

  const setError = useCallback((name: keyof T, error: string) => {
    setFields(prev => ({ ...prev, [name]: { ...prev[name], error } }));
  }, []);

  const validateAll = useCallback((): boolean => {
    if (!validate) return true;
    const errors = validate(Object.keys(fields).reduce((acc, key) => {
      acc[key as keyof T] = fields[key as keyof T].value;
      return acc;
    }, {} as T));
    const hasErrors = Object.keys(errors).length > 0;
    setFields(prev => {
      const next = { ...prev };
      for (const key of Object.keys(errors)) {
        next[key as keyof T] = { ...next[key as keyof T], error: errors[key as keyof T] || '' };
      }
      return next;
    });
    return !hasErrors;
  }, [fields, validate]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFormError(null);
    if (!validateAll()) return;
    setIsSubmitting(true);
    try {
      const values = Object.keys(fields).reduce((acc, key) => {
        acc[key as keyof T] = fields[key as keyof T].value;
        return acc;
      }, {} as T);
      await onSubmit(values);
    } catch (err: any) {
      setFormError(err?.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [fields, validateAll, onSubmit]);

  const reset = useCallback(() => {
    setFields(initialFields);
    setFormError(null);
    setIsSubmitting(false);
  }, [initialFields]);

  const values = Object.keys(fields).reduce((acc, key) => {
    acc[key as keyof T] = fields[key as keyof T].value;
    return acc;
  }, {} as T);

  return {
    fields,
    values,
    setValue,
    handleChange,
    handleBlur,
    setError,
    handleSubmit,
    reset,
    isSubmitting,
    formError,
    isValid: Object.values(fields).every(f => !f.error),
    isDirty: Object.values(fields).some(f => f.dirty),
  };
}
