import { Component, ReactNode } from 'react';

/**
 * Ловит ошибки рендера, чтобы вместо БЕЛОГО ЭКРАНА показать понятный текст
 * и саму ошибку — иначе на чужом устройстве невозможно понять, что сломалось.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[MuzBingo] ошибка рендера:', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', background: '#0b0b12', color: '#fff',
        fontFamily: 'system-ui, sans-serif', padding: '24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Что-то пошло не так</h1>
          <p style={{ color: '#aaa', lineHeight: 1.6, marginBottom: 20 }}>
            Скорее всего, устарел браузер. Обнови Safari/Chrome до последней версии
            или открой сайт в другом браузере. Если не помогло — покажи это сообщение разработчику.
          </p>
          <pre style={{
            background: '#16161f', color: '#ff8080', padding: 12, borderRadius: 10,
            fontSize: 12, textAlign: 'left', overflow: 'auto', maxHeight: 200,
          }}>
            {String(error?.message || error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20, background: '#7c3aed', color: '#fff', border: 0,
              borderRadius: 999, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }
}
