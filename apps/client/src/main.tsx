import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Temporary placeholder - will be replaced with proper App component
function App() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          American Mahjong
        </h1>
        <p className="text-muted-foreground">
          Fresh start with shadcn/ui + Tailwind CSS
        </p>
        <p className="text-sm text-muted-foreground">
          Ready to implement Phase 1 MVP components 🎯
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
