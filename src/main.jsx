import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { prepareDiscord } from './utils/discord';
import './styles/index.css';

// Dentro do Discord o patch de URLs precisa estar ativo antes de qualquer fetch do app
prepareDiscord().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
});
