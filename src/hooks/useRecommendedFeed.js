/**
 * useRecommendedFeed
 * Hook React pour consommer l'algorithme de recommandation Sky.
 * Gère la pagination, le chargement, le cache de session et les interactions.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getRecommendedFeed,
  recordPostInteraction,
  recordPostView,
} from '../utils/recommendationEngine';

export function useRecommendedFeed({ user, profile, enabled = true }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const recentCreatorsRef = useRef([]);
  const isFetchingRef = useRef(false);

  const fetchPage = useCallback(async (reset = false) => {
    if (!enabled || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    if (reset) {
      pageRef.current = 0;
      recentCreatorsRef.current = [];
    }

    try {
      const newPosts = await getRecommendedFeed({
        userId: user?.id || null,
        userProfile: profile || null,
        page: pageRef.current,
        pageSize: 15,
        recentCreators: recentCreatorsRef.current,
      });

      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        // Mettre à jour les créateurs récents pour la diversification
        recentCreatorsRef.current = [
          ...recentCreatorsRef.current,
          ...newPosts.map(p => p.user_id),
        ].slice(-20); // Fenêtre glissante de 20

        pageRef.current += 1;
        setHasMore(newPosts.length >= 10);

        if (reset) {
          setPosts(newPosts);
        } else {
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const unique = newPosts.filter(p => !existingIds.has(p.id));
            return [...prev, ...unique];
          });
        }
      }
    } catch (err) {
      setError('Impossible de charger le fil. Réessayez.');
      console.error('[useRecommendedFeed]', err);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, profile, enabled]);

  // Charge initial
  useEffect(() => {
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, enabled]);

  // Mise à jour locale d'un post (like, save…) sans refetch
  const updatePost = useCallback((postId, updates) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  }, []);

  // Enregistre une interaction et notifie l'algo
  const trackInteraction = useCallback((post, type) => {
    if (!post) return;
    recordPostInteraction(post.id, type, post.user_id, post.hashtags || []);
  }, []);

  // Enregistre une vue (avec durée pour les vidéos)
  const trackView = useCallback((postId, durationSeconds = 0, totalDuration = 0) => {
    recordPostView(postId, durationSeconds, totalDuration);
  }, []);

  return {
    posts,
    loading,
    error,
    hasMore,
    fetchMore: () => fetchPage(false),
    refresh: () => fetchPage(true),
    updatePost,
    trackInteraction,
    trackView,
  };
}
