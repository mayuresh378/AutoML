import { Component, type ReactNode } from 'react';
import { ErrorState } from './ui/ErrorState';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Application-level error boundary. Prevents an unexpected runtime error (auth
 * failure, Firebase init error, API error, render error) from blanking the
 * entire page. On error it renders the existing ErrorState UI with a retry.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep the error visible to developers without surfacing internals to users.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
          <ErrorState
            title="Something went wrong"
            message={this.state.message || 'An unexpected error occurred. Please try again.'}
            onRetry={this.handleReset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
