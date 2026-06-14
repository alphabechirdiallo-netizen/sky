import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [phase, setPhase] = useState('logo'); // logo → text → fade

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('text'), 800);
    const t2 = setTimeout(() => setPhase('fade'), 2200);
    const t3 = setTimeout(() => onComplete?.(), 2700);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className={`splash ${phase}`}>
      <div className="splash-content">
        <div className="splash-logo-wrap">
          <img
            src="/logo.png"
            alt="Sky"
            className="splash-logo"
          />
          <div className="splash-rings">
            <div className="ring ring-1" />
            <div className="ring ring-2" />
            <div className="ring ring-3" />
          </div>
        </div>
        <div className="splash-name">
          <span className="splash-letter s">S</span>
          <span className="splash-letter k">k</span>
          <span className="splash-letter y">y</span>
        </div>
        <p className="splash-tagline">Le monde en courtes vidéos</p>
      </div>
    </div>
  );
};

export default SplashScreen;
