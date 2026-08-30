import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary';
import AtualizacaoDisponivel from './components/common/AtualizacaoDisponivel';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* Por FORA do AuthProvider: erro no carregamento do perfil também
        * apagava a tela, e aí não há nem painel pra onde voltar. Dentro do
        * BrowserRouter porque o boundary lê a rota pra se destravar. */}
      {/* FORA do AuthProvider e acima do App: a atualização não depende de
        * quem está logado, e vale igual pro motorista, pro responsável, pro
        * dono e pra quem ainda está na página pública. Montar dentro de um
        * layout deixaria de fora justamente as telas de fora. */}
      <AtualizacaoDisponivel />
      <ErrorBoundary>
        <AuthProvider>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: '12px',
                fontSize: '14px',
                maxWidth: '90vw',
              },
            }}
          />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>
);
