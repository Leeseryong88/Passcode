import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const route = window.location.pathname;

const SelectedApp = React.lazy(() =>
  route.startsWith('/admin')
    ? import('./admin/AdminApp')
    : import('./App')
);

root.render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <SelectedApp />
    </Suspense>
  </React.StrictMode>
);
