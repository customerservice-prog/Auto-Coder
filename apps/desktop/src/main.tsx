import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';
import 'xterm/css/xterm.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
