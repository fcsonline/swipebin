import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { InstallPrompt } from './components/InstallPrompt.js';
import { registerServiceWorker } from './pwa.js';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <InstallPrompt />
  </React.StrictMode>,
);

registerServiceWorker();
