import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { getExploreRecommendations } from '../utils/recommendationEngine';
import './ExplorePage.css';

const ExplorePage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('top'); // top | users | videos | photos

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      // Utilise l'algorithme de recommandation pour la page explore
      const recommended = await getExploreRecommendations({
        userId: user?.id || null,
        userProfile: profile || null,
        limit: 30,
      });
      setPosts(recommended);
    } catch {
      // Fallback
      const { data } = await supabase
        .from('posts')
        .select('id, media_url, thumbnail_url, type, likes_count, views_count')
        .order('likes_count', { ascending: false })
        .limit(30);
      setPosts(data || []);
    }
    setLoading(false);
  }, [user, profile]);

  const search = useCallback(async (q) => {
    setLoading(true);
    if (tab === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, followers_count, is_verified')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(20);
      setUsers(data || []);
    } else {
      let query_b = supabase
        .from('posts')
        .select(`
          id, media_url, thumbnail_url, type, likes_count, caption,
          profiles:user_id(username, avatar_url)
        `)
        .order('likes_count', { ascending: false })
        .limit(30);

      if (tab === 'videos') {
        query_b = query_b.in('type', ['video', 'reel']);
      } else if (tab === 'photos') {
        query_b = query_b.in('type', ['photo']);
      }

      if (q) {
        query_b = query_b.ilike('caption', `%${q}%`);
      }

      const { data } = await query_b;
      setPosts(data || []);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    if (query.trim()) {
      search(query);
    } else {
      fetchTrending();
    }
  }, [query, tab, fetchTrending, search]);

  return (
    <div className="explore-page">
      {/* Header */}
      <header className="explore-header">
        <div className="explore-search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Rechercher..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      {query ? (
        <div className="explore-tabs">
          {['top', 'users', 'videos', 'photos'].map(t => (
            <button
              key={t}
              className={`explore-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'top' ? 'Top' : t === 'users' ? 'Comptes' : t === 'videos' ? 'Vidéos' : 'Photos'}
            </button>
          ))}
        </div>
      ) : (
        <div className="explore-hero">
          <span className="explore-hero-label">Pour vous ✨</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="explore-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton explore-grid-item" />
          ))}
        </div>
      ) : tab === 'users' && query ? (
        <div className="users-list">
          {users.length === 0 && <p className="no-results">Aucun résultat pour "{query}"</p>}
          {users.map(u => (
            <div
              key={u.id}
              className="user-result"
              onClick={() => navigate(`/user/${u.username}`)}
            >
              <div className="user-result-avatar">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" />
                ) : (
                  <div className="user-result-placeholder">
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="user-result-info">
                <div className="user-result-name-row">
                  <span className="user-result-username">{u.username}</span>
                  {u.is_verified && (
                    <svg viewBox="0 0 24 24" fill="var(--ig-blue)" width="14" height="14">
                      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                    </svg>
                  )}
                </div>
                <span className="user-result-sub">{u.full_name}</span>
                <span className="user-result-followers">{u.followers_count?.toLocaleString()} abonnés</span>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" width="18" height="18">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </div>
          ))}
        </div>
      ) : (
        <div className="explore-grid">
          {posts.length === 0 && query && (
            <p className="no-results" style={{ gridColumn: '1/-1' }}>Aucun résultat pour "{query}"</p>
          )}
          {posts.map((p, i) => (
            <div
              key={p.id}
              className={`explore-grid-item ${i % 7 === 0 ? 'large' : ''}`}
              onClick={() => navigate(`/post/${p.id}`)}
            >
              <img src={p.thumbnail_url || p.media_url} alt="" loading="lazy" />
              {(p.type === 'video' || p.type === 'reel') && (
                <div className="grid-video-badge">
                  <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
};

export default ExplorePage;
