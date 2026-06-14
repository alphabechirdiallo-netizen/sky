import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './StoryViewer.css';

const StoryViewer = ({ storyGroup, onClose }) => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef();
  const startRef = useRef();
  const duration = 5000;

  const story = storyGroup.items[current];
  const profile = storyGroup.profile;

  useEffect(() => {
    startProgress();
    return () => clearInterval(timerRef.current);
  }, [current]);

  const startProgress = () => {
    clearInterval(timerRef.current);
    setProgress(0);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min((elapsed / duration) * 100, 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(timerRef.current);
        goNext();
      }
    }, 50);
  };

  const goNext = () => {
    if (current < storyGroup.items.length - 1) {
      setCurrent(c => c + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (current > 0) setCurrent(c => c - 1);
    else onClose();
  };

  const handleTap = (e) => {
    const x = e.clientX / window.innerWidth;
    if (x < 0.35) goPrev();
    else goNext();
  };

  return (
    <div className="story-viewer" onClick={handleTap}>
      {/* Progress bars */}
      <div className="story-progress-row">
        {storyGroup.items.map((_, i) => (
          <div key={i} className="story-progress-track">
            <div
              className="story-progress-fill"
              style={{
                width: i < current ? '100%' : i === current ? `${progress}%` : '0%',
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="story-header" onClick={e => e.stopPropagation()}>
        <div
          className="story-author"
          onClick={() => { onClose(); navigate(`/user/${profile?.username}`); }}
        >
          <div className="story-avatar-sm">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <div className="story-avatar-placeholder-sm">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <span className="story-username">{profile?.username}</span>
            <span className="story-time">il y a quelques instants</span>
          </div>
        </div>
        <button className="story-close" onClick={e => { e.stopPropagation(); onClose(); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="22" height="22">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Media */}
      <div className="story-media">
        {story?.media_type === 'video' ? (
          <video
            src={story.media_url}
            autoPlay
            muted
            playsInline
            loop={false}
          />
        ) : (
          <img src={story?.media_url} alt="" />
        )}
      </div>

      {/* Tap zones */}
      <div className="story-tap-left" onClick={goPrev} />
      <div className="story-tap-right" onClick={goNext} />
    </div>
  );
};

export default StoryViewer;
