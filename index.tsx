import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Buffer } from 'buffer';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Polyfills for browser environment to support local AI libraries
if (typeof window !== 'undefined') {
  (window as any).Buffer = (window as any).Buffer || Buffer;
  if (typeof (window as any).process === 'undefined') {
    (window as any).process = { env: {} };
  }
}

// --- SECURITY: ERROR BOUNDARY (Section 11.1) ---
interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fix: Use named Component import and remove redundant constructor to ensure 'props' inheritance works correctly in TypeScript
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Application Error:", error, errorInfo);
  }

  handleReset = () => {
    if (confirm("Resetting interface. Your data remains safe in local storage. Reboot now?")) {
      window.location.reload();
    }
  }

  render(): ReactNode {
    // Fix: Accessing state which is now explicitly typed on the class
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] text-slate-200 flex flex-col items-center justify-center p-8 text-center font-sans">
          <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-3xl max-w-md backdrop-blur-xl">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-2 text-white">Neural Link Severed</h1>
            <p className="text-slate-400 mb-6 text-sm">
              The interface encountered a fatal exception during synchronization.
            </p>
            <div className="bg-black/30 p-4 rounded-xl mb-6 text-left overflow-auto max-h-32 text-xs font-mono text-red-300 border border-red-900/50">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={this.handleReset}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Reboot Interface
            </button>
          </div>
        </div>
      );
    }

    // Fix: Accessing props correctly inherited from React.Component
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);