import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in FOCUS OS:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBFBFA] flex items-center justify-center p-6 selection:bg-[#EBEBE8]">
          <div className="w-full max-w-md bg-white border border-[#E8E8E4] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-6 sm:p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1C1D1F]">Application Error</h2>
              <p className="text-xs text-[#71717A] mt-1">
                FOCUS OS encountered an unexpected rendering problem.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded text-left text-xs font-mono text-zinc-700 break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1C1D1F] hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer w-full"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload FOCUS OS
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
