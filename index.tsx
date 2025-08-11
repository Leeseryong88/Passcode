import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminApp from './admin/AdminApp';
import './i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const route = window.location.pathname;
root.render(
  <React.StrictMode>
    {route.startsWith('/admin') ? <AdminApp /> : <App />}
  </React.StrictMode>
);
