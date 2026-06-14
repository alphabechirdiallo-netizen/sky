import React, { useState, useRef, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import ShareSheet from './ShareSheet';
import CommentsSheet from './CommentsSheet';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import './PostCard.css';

const PostCard = forwardRef(({ post, onInteraction, onUpdate, onOpenReel }, ref) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(post.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [saved, setSaved] = useState(post.is_saved);
  const [showShare, setShowShare] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const touchStart = useRef(null);
  const doubleTapRef = useRef(null);

  const profile = post.profiles;
  const isVideo = post.type === 'video' || post.type === 'reel';
  const isLongPhoto = post.is_long_photo;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr });

  const handleLike = async () => {
    if (!onInteraction('like')) return;
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
    onUpdate?.(post.id, { likes_count: likesCount + (newLiked ? 1 : -1), is_liked: newLiked });
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
      }, 300);
    }
  };

  const handleSave = async () => {
    if (!onInteraction('save')) return;
    const newSaved = !saved;
    setSaved(newSaved);
    if (newSaved) {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
    } else {
      await supabase.from('saved_posts').delete().match({ user_id: user.id, post_id: post.id });
    }
  };

  const handleFollow = async () => {
    if (!onInteraction('follow')) return;
    await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id });
  };

  return (
    <article className="post-card animate-fade-in" ref={ref}>
      {/* Header */}
      <div className="post-header">
        <div
          className="post-author"
          onClick={() => navigate(`/user/${profile?.username}`)}
        >
          <div className="post-avatar avatar-gradient">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} />
            ) : (
              <div className="avatar-placeholder">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="post-author-info">
            <div className="post-username-row">
              <span className="post-username">{profile?.username}</span>
              {profile?.is_verified && (
                <span className="verified-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                  </svg>
                </span>
              )}
            </div>
            <span className="post-time">{timeAgo}</span>
          </div>
        </div>
        <button className="post-more" onClick={() => setShowShare(true)}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <circle cx="12" cy="5" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>

      {/* Media */}
      <div
        className={`post-media ${isLongPhoto ? 'long-photo' : ''}`}
        onClick={isVideo ? onOpenReel : handleDoubleTap}
      >
        {isVideo ? (
          <div className="post-video-thumb">
            {post.thumbnail_url ? (
              <img src={post.thumbnail_url} alt="" />
            ) : (
              <div className="video-placeholder" />
            )}
            <div className="play-overlay">
              <div className="play-btn">
                <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              </div>
            </div>
            {post.duration && (
              <span className="video-duration">
                {Math.floor(post.duration / 60)}:{String(post.duration % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        ) : isLongPhoto ? (
          <div className="long-photo-wrap">
            <img src={post.media_url} alt="" loading="lazy" />
            <div className="long-photo-gradient" />
          </div>
        ) : (
          <img src={post.media_url} alt="" loading="lazy" />
        )}

        {/* Double tap like animation */}
        {likeAnim && (
          <div className="like-anim">
            <svg viewBox="0 0 24 24" fill="#fff" width="80" height="80">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="post-actions">
        <div className="post-actions-left">
          <button
            className={`action-btn like-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <svg viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" width="26" height="26">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </button>
          <button className="action-btn" onClick={() => setShowComments(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </button>
          <button className="action-btn" onClick={() => setShowShare(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22,2 15,22 11,13 2,9"/>
            </svg>
          </button>
        </div>
        <button
          className={`action-btn save-btn ${saved ? 'saved' : ''}`}
          onClick={handleSave}
        >
          <svg viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" width="26" height="26">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>

      {/* Likes */}
      <div className="post-meta">
        {likesCount > 0 && (
          <span className="post-likes">{likesCount.toLocaleString()} j'aime{likesCount > 1 ? '' : ''}</span>
        )}
        {post.caption && (
          <p className="post-caption">
            <span
              className="post-caption-user"
              onClick={() => navigate(`/user/${profile?.username}`)}
            >
              {profile?.username}
            </span>{' '}
            {post.caption}
          </p>
        )}
        {post.comments_count > 0 && (
          <button className="post-comments-count" onClick={() => setShowComments(true)}>
            Voir les {post.comments_count} commentaire{post.comments_count > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Share sheet */}
      {showShare && (
        <ShareSheet post={post} onClose={() => setShowShare(false)} />
      )}

      {/* Comments */}
      {showComments && (
        <CommentsSheet
          post={post}
          onClose={() => setShowComments(false)}
          onInteraction={onInteraction}
        />
      )}
    </article>
  );
});

export default PostCard;
