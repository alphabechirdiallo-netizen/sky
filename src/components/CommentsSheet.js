import React, { useState, useEffect, useRef } from 'react';
import { supabase, uploadFile } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import './CommentsSheet.css';

const CommentsSheet = ({ post, onClose, onInteraction }) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState([]);
  const [showGifs, setShowGifs] = useState(false);
  const inputRef = useRef();
  const fileRef = useRef();
  const bottomRef = useRef();

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line
  }, []);

  const fetchComments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:user_id(id, username, avatar_url, is_verified)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendComment = async () => {
    if (!text.trim() && !mediaPreview) return;
    if (!onInteraction('comment')) return;
    setSending(true);

    let mediaUrl = null;
    let mediaType = null;

    if (mediaFile) {
      try {
        const ext = mediaFile.name.split('.').pop();
        const path = `comments/${user.id}/${Date.now()}.${ext}`;
        mediaUrl = await uploadFile('posts', mediaFile, path);
        mediaType = mediaFile.type.includes('gif') ? 'gif' : 'image';
      } catch (e) { console.error(e); }
    } else if (mediaPreview?.startsWith('http')) {
      mediaUrl = mediaPreview;
      mediaType = 'gif';
    }

    const { data } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        post_id: post.id,
        content: text.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
      })
      .select('*, profiles:user_id(id, username, avatar_url, is_verified)')
      .single();

    if (data) {
      setComments(c => [...c, data]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    setText('');
    setMediaPreview(null);
    setMediaFile(null);
    setSending(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
    setShowGifs(false);
  };

  const searchGifs = async (q) => {
    if (!q.trim()) { setGifs([]); return; }
    // Using Giphy public beta key
    const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=12`);
    const data = await res.json();
    setGifs(data?.data || []);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet comments-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="comments-header">
          <h3>Commentaires</h3>
          <button className="comments-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="comments-list">
          {loading && (
            <div className="comments-loading">
              {[1,2,3].map(i => (
                <div key={i} className="skeleton-comment">
                  <div className="skeleton" style={{width:32,height:32,borderRadius:'50%',flexShrink:0}} />
                  <div className="skeleton" style={{flex:1,height:48}} />
                </div>
              ))}
            </div>
          )}
          {!loading && comments.length === 0 && (
            <div className="comments-empty">
              <p>Soyez le premier à commenter</p>
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} className="comment-item">
              <div className="comment-avatar">
                {c.profiles?.avatar_url ? (
                  <img src={c.profiles.avatar_url} alt="" />
                ) : (
                  <div className="comment-avatar-placeholder">
                    {c.profiles?.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="comment-body">
                <div className="comment-bubble">
                  <span className="comment-user">{c.profiles?.username}</span>
                  {c.content && <p className="comment-text">{c.content}</p>}
                  {c.media_url && (
                    <img src={c.media_url} alt="" className="comment-media" />
                  )}
                </div>
                <span className="comment-time">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* GIF search */}
        {showGifs && (
          <div className="gif-panel">
            <div className="gif-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Rechercher des GIFs..."
                value={gifSearch}
                onChange={e => { setGifSearch(e.target.value); searchGifs(e.target.value); }}
                autoFocus
              />
            </div>
            <div className="gif-grid">
              {gifs.map(gif => (
                <img
                  key={gif.id}
                  src={gif.images.fixed_height_small.url}
                  alt={gif.title}
                  className="gif-item"
                  onClick={() => {
                    setMediaPreview(gif.images.downsized.url);
                    setMediaFile(null);
                    setShowGifs(false);
                  }}
                />
              ))}
              {gifs.length === 0 && gifSearch && (
                <p className="gif-empty">Aucun résultat</p>
              )}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="comments-input-area safe-bottom">
          {mediaPreview && (
            <div className="comment-preview">
              <img src={mediaPreview} alt="" />
              <button className="preview-remove" onClick={() => { setMediaPreview(null); setMediaFile(null); }}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          )}
          <div className="comment-input-row">
            <div className="comment-avatar-small">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <div className="comment-avatar-placeholder small">
                  {profile?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            <div className="comment-input-wrap">
              <input
                ref={inputRef}
                placeholder="Ajouter un commentaire..."
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendComment()}
              />
              <div className="comment-media-btns">
                <button onClick={() => { setShowGifs(s => !s); }} title="GIF">
                  <span style={{fontWeight:700, fontSize:12, color: showGifs ? 'var(--ig-pink)' : 'var(--text-secondary)'}}>GIF</span>
                </button>
                <button onClick={() => fileRef.current?.click()} title="Photo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21,15 16,10 5,21"/>
                  </svg>
                </button>
              </div>
            </div>
            <button
              className="comment-send"
              onClick={sendComment}
              disabled={sending || (!text.trim() && !mediaPreview)}
            >
              {sending ? (
                <span className="btn-spinner" style={{borderColor:'rgba(225,48,108,0.3)', borderTopColor:'var(--ig-pink)'}} />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2z" fill="var(--ig-pink)"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,image/gif"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
};

export default CommentsSheet;
