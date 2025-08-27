import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const route = window.location.pathname;

const SelectedApp = React.lazy(() => {
  if (route.startsWith('/admin')) {
    return import('./admin/AdminApp');
  }
  if (route === '/') {
    return import('./src/pages/Landing');
  }
  if (route.startsWith('/about')) {
    return import('./src/pages/About');
  }
  if (route.startsWith('/board')) {
    return import('./src/pages/Board');
  }
  if (route.startsWith('/play') || route.startsWith('/app')) {
    return import('./App');
  }
  return import('./App');
});

root.render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <SelectedApp />
    </Suspense>
  </React.StrictMode>
);
