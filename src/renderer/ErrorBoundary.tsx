import React from 'react';

type Props = { children: React.ReactNode };
type State = { error: Error | null; info?: React.ErrorInfo | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to the console so it shows up in DevTools (and any wrapping logger)
    console.error('[DéliNote] React render crash:', error, info);
    this.setState({ error, info });
  }

  reset = () => this.setState({ error: null, info: null });

  copyToClipboard = () => {
    const txt = `DéliNote crash report\n\n${this.state.error?.stack ?? this.state.error?.message ?? ''}\n\nComponent stack:\n${this.state.info?.componentStack ?? ''}`;
    try { void navigator.clipboard.writeText(txt); } catch { /* ignore */ }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        padding: 32,
        fontFamily: 'system-ui, sans-serif',
        color: '#1B2330',
        background: '#fbf6e9',
        minHeight: '100vh',
        overflow: 'auto',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontSize: 24, color: '#b91c1c' }}>DéliNote — quelque chose a planté</h1>
          <p style={{ marginTop: 8, color: '#6b7280' }}>
            L'application a rencontré une erreur au lancement. Tes notes sont en sécurité dans <code>%APPDATA%/delinote/DeliNoteData/</code>.
          </p>
          <pre style={{
            marginTop: 16,
            padding: 14,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {this.state.error.stack ?? this.state.error.message}
          </pre>
          {this.state.info && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Stack composant</summary>
              <pre style={{
                marginTop: 8,
                padding: 10,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 11,
                whiteSpace: 'pre-wrap',
              }}>{this.state.info.componentStack}</pre>
            </details>
          )}
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <button onClick={this.reset} style={{
              padding: '8px 16px', borderRadius: 8, background: '#F37223', color: '#fff', border: 0, cursor: 'pointer', fontWeight: 600,
            }}>Réessayer</button>
            <button onClick={this.copyToClipboard} style={{
              padding: '8px 16px', borderRadius: 8, background: '#fff', color: '#1B2330', border: '1px solid #e5e7eb', cursor: 'pointer',
            }}>Copier l'erreur</button>
            <button onClick={() => location.reload()} style={{
              padding: '8px 16px', borderRadius: 8, background: '#fff', color: '#1B2330', border: '1px solid #e5e7eb', cursor: 'pointer',
            }}>Recharger</button>
          </div>
        </div>
      </div>
    );
  }
}
