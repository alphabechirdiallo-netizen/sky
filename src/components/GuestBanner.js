import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Banners.css';

export const GuestBanner = ({ onDismiss }) => {
  const navigate = useNavigate();
  return (
    <div className="guest-banner-overlay">
      <div className="guest-banner animate-fade-up">
        <button className="guest-banner-close" onClick={onDismiss}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div className="guest-banner-logo">
          <img src="/logo.png" alt="Sky" />
        </div>
        <h3>Rejoignez Sky</h3>
        <p>Créez un compte gratuit pour interagir, partager et découvrir encore plus de contenu.</p>
        <button
          className="btn-primary guest-banner-cta"
          onClick={() => navigate('/auth')}
        >
          Créer mon compte
        </button>
        <button className="guest-banner-login" onClick={() => navigate('/auth')}>
          Déjà un compte ? <strong>Se connecter</strong>
        </button>
      </div>
    </div>
  );
};

export const OfflineBanner = ({ onRetry }) => (
  <div className="offline-banner">
    <div className="offline-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
      </svg>
    </div>
    <span>Pas de connexion</span>
    <button onClick={onRetry}>Réessayer</button>
  </div>
);

export const Toast = ({ message, onHide }) => {
  React.useEffect(() => {
    const t = setTimeout(onHide, 2500);
    return () => clearTimeout(t);
  }, [onHide]);

  return <div className="toast">{message}</div>;
};

export default GuestBanner;
