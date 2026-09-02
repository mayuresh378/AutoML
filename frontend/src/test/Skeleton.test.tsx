import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton, CardSkeleton, ChartSkeleton, MetricSkeleton, TableSkeleton } from '../components/Skeleton';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('Skeleton', () => {
  it('renders one div element by default', () => {
    const { container } = render(<Skeleton />);
    const divs = container.querySelectorAll('[class*="shimmer-loading"]');
    expect(divs.length).toBe(1);
  });

  it('renders correct number of elements with count prop', () => {
    const { container } = render(<Skeleton count={5} />);
    const divs = container.querySelectorAll('[class*="shimmer-loading"]');
    expect(divs.length).toBe(5);
  });

  it('applies text variant class by default', () => {
    const { container } = render(<Skeleton />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-4');
  });

  it('applies circular variant class', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-10 w-10 rounded-full');
  });

  it('applies rectangular variant class', () => {
    const { container } = render(<Skeleton variant="rectangular" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-24 rounded-xl');
  });

  it('applies card variant class', () => {
    const { container } = render(<Skeleton variant="card" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-40 rounded-[32px]');
  });

  it('applies chart variant class', () => {
    const { container } = render(<Skeleton variant="chart" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-48 rounded-2xl');
  });

  it('applies metric variant class', () => {
    const { container } = render(<Skeleton variant="metric" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-24 rounded-2xl');
  });

  it('applies badge variant class', () => {
    const { container } = render(<Skeleton variant="badge" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveClass('h-6 w-16 rounded-full');
  });

  it('applies custom width as number', () => {
    const { container } = render(<Skeleton width={120} />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveStyle('width: 120px');
  });

  it('applies custom width as string', () => {
    const { container } = render(<Skeleton width="50%" />);
    const div = container.querySelector('[class*="shimmer-loading"]');
    expect(div).toHaveStyle('width: 50%');
  });

  it('applies premium class when premium prop true', () => {
    const { container } = render(<Skeleton premium />);
    const div = container.querySelector('[class*="shimmer-loading-premium"]');
    expect(div).toBeInTheDocument();
  });

  it('renders CardSkeleton sub-component', () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector('[class*="rounded-[32px]"]')).toBeInTheDocument();
  });

  it('renders ChartSkeleton sub-component', () => {
    const { container } = render(<ChartSkeleton />);
    expect(container.querySelector('[class*="rounded-[32px]"]')).toBeInTheDocument();
  });

  it('renders MetricSkeleton sub-component', () => {
    const { container } = render(<MetricSkeleton />);
    expect(container.querySelector('[class*="rounded-2xl"]')).toBeInTheDocument();
  });

  it('renders TableSkeleton with correct row count', () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll('[class*="flex gap-4"]');
    expect(rows.length).toBe(4);
  });
});
