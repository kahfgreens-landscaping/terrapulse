import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { seedAdminAccount } from './lib/seedAdmin';

seedAdminAccount();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
