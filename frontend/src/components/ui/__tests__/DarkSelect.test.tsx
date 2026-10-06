import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { DarkSelect } from '../DarkSelect';

const OPTIONS = [
  { value: 'ridge', label: 'Ridge' },
  { value: 'knn', label: 'KNN' },
  { value: 'dt', label: 'Decision Tree', disabled: true },
];

function Harness({ initial = '', onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DarkSelect
      aria-label="Algorithm"
      placeholder="Choose algorithm"
      value={value}
      options={OPTIONS}
      onChange={(e) => {
        setValue(e.target.value);
        onChange?.(e.target.value);
      }}
    />
  );
}

/** jsdom reports zero-size rects, so give the trigger a real box to position against. */
function stubRect() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 40, y: 100, top: 100, left: 40, right: 240, bottom: 140, width: 200, height: 40,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('DarkSelect (global dropdown)', () => {
  it('renders no native <select> popup for options, only the hidden form control', () => {
    render(<Harness />);
    // The visible control is a button, so the OS never paints a white menu.
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('opens a dark menu with readable, light option text', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('combobox'));

    const listbox = await screen.findByRole('listbox');
    // The styled surface is the portal container wrapping the scroll area.
    const surface = listbox.parentElement as HTMLElement;
    expect(surface.className).toContain('bg-zinc-900');
    expect(surface.className).toContain('text-zinc-100');

    // Light text on a dark surface: the exact failure was white-on-white.
    const ridge = screen.getByRole('option', { name: /Ridge/ });
    expect(ridge.className).toMatch(/text-zinc-\d+/);
    expect(ridge.className).not.toMatch(/text-white(\s|$)/);
  });

  it('never uses a white background anywhere in the menu', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');

    const nodes = [
      screen.getByRole('listbox').parentElement as HTMLElement,
      ...screen.getAllByRole('option'),
    ];
    for (const node of nodes) {
      expect(node.className).not.toMatch(/bg-white(\s|$|["'])/);
      expect(node.className).not.toMatch(/bg-\[#fff/i);
    }
  });

  it('marks the selected option with a dark highlight and a check', async () => {
    render(<Harness initial="knn" />);
    fireEvent.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');

    const selected = screen.getByRole('option', { name: /KNN/ });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.className).toContain('bg-zinc-800');
    expect(selected.className).toContain('text-zinc-50');
  });

  it('dims disabled options and refuses to select them', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    await screen.findByRole('listbox');

    const disabled = screen.getByRole('option', { name: /Decision Tree/ });
    expect(disabled.getAttribute('aria-disabled')).toBe('true');
    expect(disabled.className).toContain('cursor-not-allowed');

    fireEvent.click(disabled);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('updates the value and closes the menu on selection', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger.textContent).toContain('Choose algorithm');

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: /Ridge/ }));

    expect(onChange).toHaveBeenCalledWith('ridge');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(screen.getByRole('combobox').textContent).toContain('Ridge');
  });

  it('keeps the hidden native select in sync for form submission', async () => {
    const { container } = render(<Harness />);
    const native = container.querySelector('select') as HTMLSelectElement;

    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: /KNN/ }));

    expect(native.value).toBe('knn');
    // Hidden from pointer/keyboard input so the OS popup can never appear.
    expect(native.tabIndex).toBe(-1);
    expect(native.getAttribute('aria-hidden')).toBe('true');
  });

  it('supports keyboard navigation and closes on Escape', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('combobox');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await screen.findByRole('listbox');

    const menu = (await screen.findByRole('listbox')).parentElement as HTMLElement;
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /KNN/ }).className).toContain('text-zinc-50');

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('does not open when disabled', () => {
    render(
      <DarkSelect aria-label="Algorithm" disabled placeholder="Pick" options={OPTIONS} />,
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger.hasAttribute('disabled')).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('derives an accessible name when the call site provides none', () => {
    // role="combobox" cannot take its name from the trigger text, so a control
    // with only a placeholder would otherwise be announced as unlabelled.
    render(<DarkSelect placeholder="Choose algorithm" options={OPTIONS} />);
    const trigger = screen.getByRole('combobox', { name: 'Choose algorithm' });
    expect(trigger).toBeTruthy();
  });

  it('prefers a caller-supplied label over the placeholder for its name', () => {
    render(<DarkSelect label="Algorithm" placeholder="Choose algorithm" options={OPTIONS} />);
    expect(screen.getByRole('combobox', { name: 'Algorithm' })).toBeTruthy();
  });

  it('renders the menu in a portal above modals', async () => {
    render(
      <div style={{ overflow: 'hidden', height: 40 }}>
        <Harness />
      </div>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    const surface = (await screen.findByRole('listbox')).parentElement as HTMLElement;

    // Rendered on document.body, so cards/tables/modals cannot clip it.
    expect(surface.parentElement).toBe(document.body);
    // Above modals (310), toasts (400), the command palette (500) and the
    // hard-coded z-index dialogs (1000), so it is never painted behind them.
    expect(surface.style.zIndex).toBe('var(--z-select-menu)');
    expect(surface.style.zIndex).not.toBe('');
  });

  it('positions the menu below the trigger when there is room', async () => {
    // jsdom reports zero-size rects, so give the trigger a real box first.
    stubRect();
    try {
      render(<Harness />);
      fireEvent.click(screen.getByRole('combobox'));
      const surface = (await screen.findByRole('listbox')).parentElement as HTMLElement;
      const top = Number.parseFloat(surface.style.top);
      expect(Number.isNaN(top)).toBe(false);
      // Roomy viewport: opens below the trigger (bottom edge y=140).
      expect(top).toBeGreaterThan(140);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('flips the menu above the trigger when there is no room below', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 40, y: 700, top: 700, left: 40, right: 240, bottom: 740, width: 200, height: 40,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      render(<Harness />);
      fireEvent.click(screen.getByRole('combobox'));
      const surface = (await screen.findByRole('listbox')).parentElement as HTMLElement;
      expect(Number.parseFloat(surface.style.top)).toBeLessThan(700);
    } finally {
      vi.restoreAllMocks();
    }
  });
});