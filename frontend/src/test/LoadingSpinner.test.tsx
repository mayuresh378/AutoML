import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner, PageLoader } from '../components/LoadingSpinner';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('LoadingSpinner', () => {
  it('renders spinner SVG', () => {
    render(<LoadingSpinner />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders label text when provided', () => {
    render(<LoadingSpinner label="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('does not render label when not provided', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('applies small size class', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-5 w-5');
  });

  it('applies medium size class', () => {
    const { container } = render(<LoadingSpinner size="md" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-8 w-8');
  });

  it('applies large size class', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-12 w-12');
  });

  it('renders premium variant', () => {
    const { container } = render(<LoadingSpinner variant="premium" />);
    const path = container.querySelector('svg path:last-child');
    expect(path).toHaveClass('text-primary');
  });

  it('renders pulse variant ring', () => {
    const { container } = render(<LoadingSpinner variant="pulse" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });
});

describe('PageLoader', () => {
  it('renders with default label', () => {
    render(<PageLoader />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<PageLoader label="Fetching..." />);
    expect(screen.getByText('Fetching...')).toBeInTheDocument();
  });
});
