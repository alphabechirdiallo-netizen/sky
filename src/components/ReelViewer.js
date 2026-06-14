import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import ShareSheet from './ShareSheet';
import CommentsSheet from './CommentsSheet';
import './ReelViewer.css';

const ReelViewer = ({ post, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef();
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [saved, setSaved] = useState(post.is_saved);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const doubleTapRef = useRef(null);

  useEffect(() => {
    // Track view
    supabase.from('post_views').insert({ user_id: user?.id, post_id: post.id });
    supabase.from('posts').update({ views_count: (post.views_count || 0) + 1 }).eq('id', post.id);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) videoRef.current.pause();
      else videoRef.current.play();
      setPlaying(p => !p);
    }
  };

  const handleDoubleTap = () => {
    if (doubleTapRef.current) {
      clearTimeout(doubleTapRef.current);
      doubleTapRef.current = null;
      if (!liked) handleLike();
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 600);
    } else {
      doubleTapRef.current = setTimeout(() => {
        doubleTapRef.current = null;
        togglePlay();
      }, 280);
    }
  };

  const handleLike = async () => {
    if (!user) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(c => newLiked ? c + 1 : c - 1);
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 600);
    if (newLiked) {
      await supabase.from('likes').insert({ user_id: user.id, post_id: post.id });
    } else {
      await supabase.from('likes').delete().match({ user_id: user.id, post_id: post.id });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaved(s => !s);
    if (!saved) {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
    } else {
      await supabase.from('saved_posts').delete().match({ user_id: user.id, post_id: post.id });
    }
  };

  const profile = post.profiles;

  return (
    <div className="reel-viewer">
      {/* Video */}
      <div className="reel-media" onClick={handleDoubleTap}>
        {post.media_url?.match(/\.(mp4|mov|avi|webm)$/i) ? (
          <video
            ref={videoRef}
            src={post.media_url}
            autoPlay
            loop
            playsInline
            muted={muted}
          />
        ) : (
          <img src={post.media_url} alt="" />
        )}

        {/* Double tap like anim */}
        {likeAnim && (
          <div className="reel-like-anim">
            <svg viewBox="0 0 24 24" fill="white" width="90" height="90">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
        )}

        {/* Pause indicator */}
        {!playing && (
          <div className="reel-pause-icon">
            <svg viewBox="0 0 24 24" fill="white" width="50" height="50" opacity="0.8">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          </div>
        )}
      </div>

      {/* Top bar */}
      <div className="reel-top">
        <button className="reel-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="22" height="22">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12,19 5,12 12,5"/>
          </svg>
        </button>
        <span className="reel-title">Reel</span>
        <button className="reel-mute" onClick={() => setMuted(m => !m)}>
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="22" height="22">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="22" height="22">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <path d="M15.54 8.46a5 5 0 010 7.07"/>
              <path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
          )}
        </button>
      </div>

      {/* Right sidebar actions */}
      <div className="reel-sidebar">
        <button
          className="reel-action"
          onClick={() => navigate(`/user/${profile?.username}`)}
        >
          <div className="reel-avatar">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <div className="reel-avatar-placeholder">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="reel-follow-dot">
            <svg viewBox="0 0 24 24" fill="white" width="10" height="10"><path d="M12 5v14M5 12h14"/></svg>
          </div>
        </button>

        <button className={`reel-action ${liked ? 'liked' : ''}`} onClick={handleLike}>
          <svg viewBox="0 0 24 24" fill={liked ? '#ed4956' : 'none'} stroke={liked ? '#ed4956' : 'white'} strokeWidth="2" width="28" height="28">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
          <span>{likesCount > 0 ? likesCount.toLocaleString() : ''}</span>
        </button>

        <button className="reel-action" onClick={() => setShowComments(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="28" height="28">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>{post.comments_count > 0 ? post.comments_count : ''}</span>
        </button>

        <button className="reel-action" onClick={() => setShowShare(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="28" height="28">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22,2 15,22 11,13 2,9"/>
          </svg>
          <span>{post.shares_count > 0 ? post.shares_count : ''}</span>
        </button>

        <button className={`reel-action ${saved ? 'saved' : ''}`} onClick={handleSave}>
          <svg viewBox="0 0 24 24" fill={saved ? 'white' : 'none'} stroke="white" strokeWidth="2" width="28" height="28">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>

        <button className="reel-action" onClick={() => setShowShare(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="24" height="24">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>

      {/* Bottom info */}
      <div className="reel-bottom">
        <div
          className="reel-author"
          onClick={() => navigate(`/user/${profile?.username}`)}
        >
          <span className="reel-username">@{profile?.username}</span>
          {profile?.is_verified && (
            <svg viewBox="0 0 24 24" fill="white" width="14" height="14">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
          )}
        </div>
        {post.caption && (
          <p className="reel-caption">{post.caption}</p>
        )}
        {post.music_title && (
          <div className="reel-music">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="14" height="14">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            <span>{post.music_title} — {post.music_artist}</span>
          </div>
        )}
      </div>

      {showShare && <ShareSheet post={post} onClose={() => setShowShare(false)} />}
      {showComments && (
        <CommentsSheet
          post={post}
          onClose={() => setShowComments(false)}
          onInteraction={() => !!user}
        />
      )}
    </div>
  );
};

export default ReelViewer;
