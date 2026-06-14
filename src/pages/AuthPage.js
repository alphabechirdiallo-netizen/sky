import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthPage.css';

const INTERESTS = [
  'Musique', 'Danse', 'Comédie', 'Cuisine', 'Voyage',
  'Sport', 'Mode', 'Beauté', 'Technologie', 'Art',
  'Gaming', 'Fitness', 'Nature', 'Éducation', 'Cinéma',
  'Animaux', 'Business', 'Lifestyle', 'Auto', 'Photo',
];

const AuthPage = () => {
  const { signIn, signUp, authError, setAuthError } = useAuth();
  const [mode, setMode] = useState('login'); // login | signup | interests | verify
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', username: '', fullName: '', interests: [],
  });
  const [error, setError] = useState('');

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setError('');
    setAuthError(null);
  };

  const toggleInterest = (i) => {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(i)
        ? f.interests.filter(x => x !== i)
        : [...f.interests, i],
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Tous les champs sont requis.');
      return;
    }
    setLoading(true);
    const { error: err } = await signIn({ email: form.email, password: form.password });
    if (err) setError(err);
    setLoading(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.username) {
      setError('Tous les champs sont requis.');
      return;
    }
    if (form.username.length < 3) {
      setError("Le nom d'utilisateur doit avoir au moins 3 caractères.");
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (form.interests.length === 0) {
      setError('Sélectionnez au moins un centre d\'intérêt.');
      return;
    }
    setLoading(true);
    const { error: err } = await signUp({
      email: form.email,
      password: form.password,
      username: form.username.toLowerCase().replace(/\s+/g, '_'),
      fullName: form.fullName || form.username,
      interests: form.interests,
    });
    if (!err) {
      setMode('verify');
    } else {
      setError(err);
    }
    setLoading(false);
  };

  const displayError = error || authError;

  if (mode === 'verify') {
    return (
      <div className="auth-page">
        <div className="auth-verify">
          <div className="verify-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h2>Vérifiez votre email</h2>
          <p>Nous avons envoyé un lien de confirmation à <strong>{form.email}</strong></p>
          <p className="verify-sub">Cliquez sur le lien pour activer votre compte Sky</p>
          <button className="btn-primary w-full" onClick={() => setMode('login')}>
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'interests') {
    return (
      <div className="auth-page">
        <div className="auth-box animate-fade-in">
          <div className="auth-logo-small">
            <img src="/logo.png" alt="Sky" />
            <span>sky</span>
          </div>
          <h2>Vos centres d'intérêt</h2>
          <p className="auth-sub">Personnalisez votre expérience Sky</p>
          <div className="interests-grid">
            {INTERESTS.map(i => (
              <button
                key={i}
                className={`interest-chip ${form.interests.includes(i) ? 'selected' : ''}`}
                onClick={() => toggleInterest(i)}
                type="button"
              >
                {i}
              </button>
            ))}
          </div>
          <p className="interests-count">
            {form.interests.length} sélectionné{form.interests.length > 1 ? 's' : ''}
          </p>
          {displayError && <div className="auth-error">{displayError}</div>}
          <button
            className="btn-primary w-full"
            onClick={handleSignup}
            disabled={loading || form.interests.length === 0}
          >
            {loading ? <span className="btn-spinner" /> : 'Créer mon compte'}
          </button>
          <button className="auth-back" onClick={() => setMode('signup')}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-box animate-fade-in">
        <div className="auth-logo">
          <img src="/logo.png" alt="Sky" className="auth-logo-img" />
          <h1 className="auth-brand">sky</h1>
        </div>

        {mode === 'login' ? (
          <>
            <p className="auth-sub">Connectez-vous pour continuer</p>
            <form onSubmit={handleLogin} className="auth-form">
              <div className="auth-field">
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {displayError && (
                <div className="auth-error">
                  {displayError.toLowerCase().includes('réseau') || displayError.toLowerCase().includes('connexion') ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <line x1="1" y1="1" x2="23" y2="23"/>
                        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
                      </svg>
                      {displayError}
                    </>
                  ) : displayError}
                </div>
              )}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : 'Se connecter'}
              </button>
            </form>
            <div className="auth-divider"><span>ou</span></div>
            <button className="auth-switch" onClick={() => { setMode('signup'); setError(''); }}>
              Pas encore de compte ? <strong>Créer un compte</strong>
            </button>
          </>
        ) : (
          <>
            <p className="auth-sub">Rejoignez la communauté Sky</p>
            <form onSubmit={(e) => { e.preventDefault(); setMode('interests'); }} className="auth-form">
              <div className="auth-field">
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={form.fullName}
                  onChange={e => setField('fullName', e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="auth-field">
                <input
                  type="text"
                  placeholder="Nom d'utilisateur"
                  value={form.username}
                  onChange={e => setField('username', e.target.value.toLowerCase().replace(/\s+/g,''))}
                  autoComplete="username"
                />
              </div>
              <div className="auth-field">
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="auth-field">
                <input
                  type="password"
                  placeholder="Mot de passe (min. 6 caractères)"
                  value={form.password}
                  onChange={e => setField('password', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {displayError && <div className="auth-error">{displayError}</div>}
              <button type="submit" className="btn-primary w-full">
                Continuer
              </button>
            </form>
            <button className="auth-switch" onClick={() => { setMode('login'); setError(''); }}>
              Déjà un compte ? <strong>Se connecter</strong>
            </button>
          </>
        )}

        <p className="auth-terms">
          En continuant, vous acceptez nos <a href="#terms">Conditions</a> et notre <a href="#privacy">Politique de confidentialité</a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
