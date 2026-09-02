import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/ToastProvider';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

function TestConsumer({ fireImmediate }: { fireImmediate?: boolean }) {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast('success', 'Success!', 'It worked')}>Show Success</button>
      <button onClick={() => toast('error', 'Error!')}>Show Error</button>
      <button onClick={() => toast('warning', 'Warning!')}>Show Warning</button>
      <button onClick={() => toast('info', 'Info!')}>Show Info</button>
    </div>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('provides toast function via context', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    expect(screen.getByText('Show Success')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <p>Child Content</p>
      </ToastProvider>
    );
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('displays success toast with title and message', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('It worked')).toBeInTheDocument();
  });

  it('displays error toast with title only', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('displays warning toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Warning'));
    expect(screen.getByText('Warning!')).toBeInTheDocument();
  });

  it('displays info toast', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Info'));
    expect(screen.getByText('Info!')).toBeInTheDocument();
  });

  it('shows multiple toasts simultaneously', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('removes toast after timeout', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByText('Success!')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3600);
    });
    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });
});
