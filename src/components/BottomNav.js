import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './BottomNav.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const path = location.pathname;

  const items = [
    {
      key: '/',
      icon: (
        <svg viewBox="0 0 24 24" fill={path === '/' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
      label: 'Accueil',
    },
    {
      key: '/explore',
      icon: (
        <svg viewBox="0 0 24 24" fill={path === '/explore' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
      label: 'Explorer',
    },
    {
      key: '/upload',
      icon: null,
      label: 'Publier',
      special: true,
    },
    {
      key: '/activity',
      icon: (
        <svg viewBox="0 0 24 24" fill={path === '/activity' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      ),
      label: 'Activité',
    },
    {
      key: '/profile',
      icon: (
        <div className={`nav-avatar ${path === '/profile' ? 'active' : ''}`}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" />
          ) : (
            <div className="nav-avatar-placeholder">
              {profile?.username?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>
      ),
      label: 'Profil',
    },
  ];

  return (
    <nav className="bottom-nav safe-bottom">
      {items.map(item => (
        <button
          key={item.key}
          className={`nav-item ${path === item.key ? 'active' : ''} ${item.special ? 'nav-upload' : ''}`}
          onClick={() => navigate(item.key)}
        >
          {item.special ? (
            <div className="nav-upload-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
          ) : (
            <>
              <div className="nav-icon">{item.icon}</div>
              <span className="nav-label">{item.label}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
