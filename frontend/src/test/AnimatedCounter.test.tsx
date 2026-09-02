import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedCounter } from '../components/AnimatedCounter';

vi.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  useMotionValue: (initial: number) => {
    let val = initial;
    return {
      get: () => val,
      set: (v: number) => { val = v; },
      onChange: vi.fn(),
    };
  },
  useSpring: (mv: any) => mv,
  useTransform: (mv: any, fn: (v: number) => string) => fn(mv.get()),
}));

describe('AnimatedCounter', () => {
  it('renders with default from value', () => {
    render(<AnimatedCounter to={42} enabled={false} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders prefix string', () => {
    render(<AnimatedCounter to={100} prefix="$" enabled={false} />);
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('renders suffix string', () => {
    render(<AnimatedCounter to={95} suffix="%" enabled={false} />);
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('renders with prefix and suffix together', () => {
    render(<AnimatedCounter to={250} prefix="$" suffix="K" enabled={false} />);
    expect(screen.getByText('$250K')).toBeInTheDocument();
  });

  it('renders with decimal places', () => {
    render(<AnimatedCounter to={99.5678} decimals={2} enabled={false} />);
    expect(screen.getByText('99.57')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AnimatedCounter to={10} className="text-2xl font-bold" />);
    const span = container.querySelector('span');
    expect(span).toHaveClass('text-2xl');
    expect(span).toHaveClass('font-bold');
  });

  it('renders zero value correctly', () => {
    render(<AnimatedCounter to={0} enabled={false} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
