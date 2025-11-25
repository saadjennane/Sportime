import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-deep-navy flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-navy-accent rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-hot-red mb-4">Something went wrong</h2>
            <p className="text-text-secondary mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <details className="text-left text-xs text-text-disabled bg-deep-navy p-3 rounded-lg mb-4 max-h-48 overflow-auto">
              <summary className="cursor-pointer font-semibold mb-2">Error Details</summary>
              <pre className="whitespace-pre-wrap break-all">
                {this.state.error?.stack}
              </pre>
              {this.state.errorInfo && (
                <>
                  <p className="font-semibold mt-2">Component Stack:</p>
                  <pre className="whitespace-pre-wrap break-all">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </>
              )}
            </details>
            <button
              onClick={() => window.location.reload()}
              className="primary-button"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
