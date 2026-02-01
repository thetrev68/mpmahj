import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import './AuthForm.css';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const { signIn, signUp, loading, error, clearError } = useAuthStore();

  useEffect(() => {
    // Clear error when switching between sign in/up
    clearError();
  }, [isSignUp, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      return;
    }

    if (isSignUp) {
      await signUp(email, password);
    } else {
      await signIn(email, password);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isSignUp ? 'Sign Up' : 'Login'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>
              Email:
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Password:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </label>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-buttons">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Login'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              {isSignUp ? 'Switch to Login' : 'Switch to Sign Up'}
            </button>
          </div>
        </form>

        <div className="auth-divider">or</div>

        <button
          type="button"
          className="btn btn-guest"
          onClick={() => window.location.reload()}
          disabled={loading}
        >
          Continue as Guest
        </button>
      </div>
    </div>
  );
}
