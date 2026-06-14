import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRecommendedFeed } from '../hooks/useRecommendedFeed';
import { supabase } from '../utils/supabase';
import StoriesBar from '../components/StoriesBar';
import PostCard from '../components/PostCard';
import ReelViewer from '../components/ReelViewer';
import { GuestBanner, OfflineBanner } from '../components/GuestBanner';
import './HomePage.css';

const HomePage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('foryou'); // foryou | following
  const [viewerPost, setViewerPost] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [showGuestBanner, setShowGuestBanner] = useState(false);
  const observer = useRef();
  const guestPostCount = useRef(0);

  // ── Algorithme de recommandation Sky ────────────────────────────────────────
  const {
    posts: algoPosts,
    loading: algoLoading,
    error: algoError,
    hasMore,
    fetchMore,
    refresh,
    updatePost: algoUpdatePost,
    trackInteraction,
  } = useRecommendedFeed({
    user,
    profile,
    enabled: tab === 'foryou' && online,
  });

  // ── Feed "Abonnements" (chronologique simple) ────────────────────────────────
  const [followPosts, setFollowPosts] = useState([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [followPage, setFollowPage] = useState(0);
  const [followHasMore, setFollowHasMore] = useState(true);

  const fetchFollowingPosts = useCallback(async (reset = false) => {
    if (!user || !online) return;
    const currentPage = reset ? 0 : followPage;
    setFollowLoading(true);
    try {
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const ids = (followData || []).map(f => f.following_id);
      if (ids.length === 0) { setFollowPosts([]); setFollowLoading(false); return; }

      const { data, error: fetchError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, username, full_name, avatar_url, is_verified),
          likes (user_id),
          saved_posts (user_id)
        `)
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .range(currentPage * 10, currentPage * 10 + 9);

      if (fetchError) throw fetchError;
      const enriched = (data || []).map(p => ({
        ...p,
        is_liked: p.likes?.some(l => l.user_id === user?.id) || false,
        is_saved: p.saved_posts?.some(s => s.user_id === user?.id) || false,
      }));

      if (reset) setFollowPosts(enriched);
      else setFollowPosts(prev => [...prev, ...enriched]);
      setFollowHasMore((data || []).length === 10);
      if (reset) setFollowPage(1); else setFollowPage(p => p + 1);
    } catch (err) {
      console.error(err);
    }
    setFollowLoading(false);
  }, [followPage, user, online]);

  // ── Sync en ligne/hors ligne ─────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Changement d'onglet ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'foryou') {
      refresh();
    } else {
      fetchFollowingPosts(true);
    }
    // eslint-disable-next-line
  }, [tab]);

  // ── IntersectionObserver pour pagination infinie ─────────────────────────────
  const activePosts = tab === 'foryou' ? algoPosts : followPosts;
  const loading = tab === 'foryou' ? algoLoading : followLoading;
  const error = tab === 'foryou' ? algoError : null;

  const lastPostRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (tab === 'foryou' && hasMore) fetchMore();
        else if (tab === 'following' && followHasMore) fetchFollowingPosts();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, followHasMore, tab, fetchMore, fetchFollowingPosts]);

  // ── Gestion invité ────────────────────────────────────────────────────────────
  const handleInteraction = (action) => {
    if (!user) {
      guestPostCount.current++;
      if (guestPostCount.current >= 2) setShowGuestBanner(true);
      return false;
    }
    return true;
  };

  const updatePost = (postId, updates) => {
    algoUpdatePost(postId, updates);
    setFollowPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  };

  // ── Wrapper PostCard avec tracking algo ──────────────────────────────────────
  const handlePostInteraction = (post, action) => {
    if (!handleInteraction(action)) return false;
    trackInteraction(post, action);
    return true;
  };

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <img src="/logo.png" alt="Sky" className="home-logo" onClick={() => navigate('/')} />
        <h1 className="home-brand">sky</h1>
        <div className="home-tabs">
          <button
            className={`home-tab ${tab === 'foryou' ? 'active' : ''}`}
            onClick={() => setTab('foryou')}
          >
            Pour vous
          </button>
          <button
            className={`home-tab ${tab === 'following' ? 'active' : ''}`}
            onClick={() => setTab('following')}
          >
            Abonnements
          </button>
        </div>
        <button className="home-action" onClick={() => navigate('/messages')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="24" height="24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>
      </header>

      {!online && <OfflineBanner onRetry={() => tab === 'foryou' ? refresh() : fetchFollowingPosts(true)} />}

      {/* Stories */}
      <StoriesBar />

      {/* Feed */}
      <div className="home-feed">
        {error && !loading && (
          <div className="feed-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>{error}</p>
            <button className="btn-primary" onClick={() => tab === 'foryou' ? refresh() : fetchFollowingPosts(true)}>Réessayer</button>
          </div>
        )}

        {!error && activePosts.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            ref={i === activePosts.length - 1 ? lastPostRef : null}
            onInteraction={(action) => handlePostInteraction(post, action)}
            onUpdate={updatePost}
            onOpenReel={() => setViewerPost(post)}
          />
        ))}

        {loading && (
          <div className="feed-skeleton">
            {[1,2,3].map(i => (
              <div key={i} className="skeleton-post">
                <div className="skeleton skeleton-header" />
                <div className="skeleton skeleton-media" />
                <div className="skeleton skeleton-actions" />
              </div>
            ))}
          </div>
        )}

        {!loading && activePosts.length === 0 && !error && (
          <div className="feed-empty">
            <div className="feed-empty-logo">
              <img src="/logo.png" alt="" />
            </div>
            <h3>Bienvenue sur Sky</h3>
            <p>
              {tab === 'following'
                ? "Abonnez-vous à des créateurs pour voir leur contenu ici"
                : "Aucun contenu disponible pour l'instant"}
            </p>
            <button className="btn-primary" onClick={() => navigate('/explore')}>
              Explorer
            </button>
          </div>
        )}

        <div style={{ height: 80 }} />
      </div>

      {/* Reel/Video full screen viewer */}
      {viewerPost && (
        <ReelViewer
          post={viewerPost}
          onClose={() => setViewerPost(null)}
        />
      )}

      {/* Guest banner */}
      {showGuestBanner && !user && (
        <GuestBanner onDismiss={() => setShowGuestBanner(false)} />
      )}
    </div>
  );
};

export default HomePage;
