import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LobbyScreen } from './pages/LobbyScreen';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LobbyScreen />
  </StrictMode>
);
