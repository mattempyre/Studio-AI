import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Icons from '../Icons';

interface ErrorBoundaryProps {
    children: ReactNode;
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ScriptEditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ScriptEditor] React Error Boundary caught error:', error);
        console.error('[ScriptEditor] Component stack:', errorInfo.componentStack);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex-1 flex items-center justify-center bg-background-dark p-8">
                    <div className="max-w-lg bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Icons.AlertCircle className="text-red-400" size={24} />
                            <h2 className="text-lg font-bold text-red-400">Rendering Error</h2>
                        </div>
                        <p className="text-white mb-4">An error occurred while rendering the script editor:</p>
                        <pre className="bg-black/40 rounded-lg p-4 text-xs text-red-300 overflow-auto max-h-48 mb-4">
                            {this.state.error?.message || 'Unknown error'}
                            {this.state.error?.stack && (
                                <>
                                    {'\n\n'}
                                    {this.state.error.stack}
                                </>
                            )}
                        </pre>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null, errorInfo: null });
                                this.props.onReset?.();
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
