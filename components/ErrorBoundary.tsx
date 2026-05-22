import React from 'react';

interface State { hasError: boolean; error: string; errorInfo: string; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '', errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message, errorInfo: '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('IIDZII POS Error:', error, info);
    this.setState({ errorInfo: info.componentStack?.slice(0, 200) || '' });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh',
        background: '#0a0f1a', color: '#fff',
        padding: '2rem', textAlign: 'center',
        fontFamily: 'Cairo, system-ui, sans-serif',
        direction: 'rtl',
      }}>
        <div style={{ fontSize: '56px', marginBottom: '1.2rem' }}>⚠️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '0.5rem', color: '#f1f5f9' }}>
          حدث خطأ في التطبيق
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '0.5rem', maxWidth: '320px', lineHeight: 1.6 }}>
          {this.state.error || 'خطأ غير متوقع'}
        </p>
        {this.state.errorInfo && (
          <details style={{ marginBottom: '1.5rem', maxWidth: '320px' }}>
            <summary style={{ fontSize: '11px', color: '#475569', cursor: 'pointer' }}>تفاصيل تقنية</summary>
            <pre style={{ fontSize: '9px', color: '#475569', textAlign: 'left', whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
              {this.state.errorInfo}
            </pre>
          </details>
        )}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => this.setState({ hasError: false, error: '', errorInfo: '' })}
            style={{
              background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
              borderRadius: '14px', padding: '12px 24px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif',
            }}>
            ← رجوع
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none',
              borderRadius: '14px', padding: '12px 28px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Cairo, sans-serif',
              boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
            }}>
            🔄 إنعاش التطبيق
          </button>
        </div>
      </div>
    );
  }
}
