import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onNavigateToDashboard?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class TransactionsErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('TransactionsErrorBoundary caught error:', error);
    console.error('Component stack:', errorInfo.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleNavigateToDashboard = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onNavigateToDashboard) {
      this.props.onNavigateToDashboard();
    } else {
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">
              Ocorreu um erro ao carregar os lançamentos
            </h2>
            <p className="text-muted-foreground max-w-md">
              Algo deu errado ao exibir esta página. Tente recarregar ou voltar ao dashboard.
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleNavigateToDashboard}>
              <Home className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <Button onClick={this.handleReload}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Recarregar
            </Button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 p-4 bg-muted rounded-lg max-w-lg text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Detalhes do erro (dev)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-destructive">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
