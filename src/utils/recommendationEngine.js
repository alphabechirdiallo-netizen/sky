/**
 * SKY RECOMMENDATION ENGINE v2.0
 * ================================
 * Algorithme de recommandation ultra-puissant inspiré de TikTok, YouTube & Instagram.
 *
 * Piliers :
 *  1. Scoring multi-dimensionnel (engagement, fraîcheur, pertinence utilisateur, viralité)
 *  2. Profilage comportemental en temps réel (watch-time, likes, saves, scrolls)
 *  3. Filtrage collaboratif (utilisateurs similaires, contenus similaires)
 *  4. Diversification anti-bulle de filtre
 *  5. Boost de découverte (nouveaux créateurs)
 *  6. Personnalisation par intérêts déclarés + comportementaux
 */

import { supabase } from './supabase';

// ─── Constantes de pondération ────────────────────────────────────────────────

const WEIGHTS = {
  // Signaux d'engagement
  LIKE_RATE: 0.25,         // likes / vues
  COMMENT_RATE: 0.20,      // commentaires / vues
  SAVE_RATE: 0.20,         // sauvegardes / vues (signal fort d'intérêt)
  SHARE_RATE: 0.15,        // partages / vues
  WATCH_COMPLETION: 0.20,  // durée regardée / durée totale (vidéos)

  // Facteurs de contexte
  FRESHNESS: 0.30,         // contenu récent privilégié
  FOLLOWING_BOOST: 0.20,   // contenu de personnes suivies
  INTEREST_MATCH: 0.25,    // correspondance intérêts utilisateur
  DISCOVERY: 0.10,         // chance de découverte (nouveaux créateurs)
  VIRAL_MOMENTUM: 0.15,    // vitesse d'acquisition d'engagement

  // Pénalités
  ALREADY_SEEN: -0.80,     // pénalité si déjà vu
  SAME_CREATOR: -0.30,     // éviter trop de contenu du même créateur consécutif
};

const ALGO_VERSION = '2.0';
const FEED_SIZE = 20;
const DISCOVERY_RATIO = 0.20; // 20% de contenu de découverte
const FOLLOWING_RATIO = 0.35; // 35% de contenu des abonnements

// ─── Gestionnaire de comportement local (session) ─────────────────────────────

class BehaviorTracker {
  constructor() {
    this.session = this._loadSession();
  }

  _loadSession() {
    try {
      const raw = sessionStorage.getItem('sky_behavior');
      return raw ? JSON.parse(raw) : this._emptySession();
    } catch {
      return this._emptySession();
    }
  }

  _emptySession() {
    return {
      watchedPosts: {},      // postId → secondsWatched
      likedCategories: {},   // hashtag → likeCount
      skippedPosts: new Set(),
      seenPosts: new Set(),
      creatorInteractions: {}, // userId → interactionScore
      sessionStart: Date.now(),
    };
  }

  _save() {
    try {
      const toSave = {
        ...this.session,
        skippedPosts: [...this.session.skippedPosts],
        seenPosts: [...this.session.seenPosts],
      };
      sessionStorage.setItem('sky_behavior', JSON.stringify(toSave));
    } catch {}
  }

  recordView(postId, durationSeconds, totalDuration) {
    this.session.watchedPosts[postId] = durationSeconds;
    this.session.seenPosts.add(postId);
    if (totalDuration > 0 && durationSeconds / totalDuration < 0.2) {
      this.session.skippedPosts.add(postId);
    }
    this._save();
  }

  recordInteraction(postId, type, creatorId, hashtags = []) {
    // Boost le créateur
    if (creatorId) {
      this.session.creatorInteractions[creatorId] =
        (this.session.creatorInteractions[creatorId] || 0) + this._interactionWeight(type);
    }
    // Boost les hashtags/catégories
    hashtags.forEach(tag => {
      this.session.likedCategories[tag] =
        (this.session.likedCategories[tag] || 0) + this._interactionWeight(type);
    });
    this._save();
  }

  _interactionWeight(type) {
    const weights = { like: 1, save: 3, comment: 2, share: 2.5, view: 0.1 };
    return weights[type] || 0.5;
  }

  getCreatorScore(creatorId) {
    return this.session.creatorInteractions[creatorId] || 0;
  }

  getTagScore(tag) {
    return this.session.likedCategories[tag] || 0;
  }

  hasSeenPost(postId) {
    return this.session.seenPosts.has(postId);
  }

  hasSkippedPost(postId) {
    return this.session.skippedPosts.has(postId);
  }

  getTopTags(n = 10) {
    return Object.entries(this.session.likedCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([tag]) => tag);
  }

  getTopCreators(n = 10) {
    return Object.entries(this.session.creatorInteractions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id]) => id);
  }
}

export const behaviorTracker = new BehaviorTracker();

// ─── Calcul du score d'un post ─────────────────────────────────────────────────

/**
 * Score d'engagement normalisé (0→1)
 * Utilise une formule similaire à Wilson Score pour éviter le biais des posts récents
 */
function computeEngagementScore(post) {
  const views = Math.max(post.views_count || 1, 1);
  const likes = post.likes_count || 0;
  const comments = post.comments_count || 0;
  const shares = post.shares_count || 0;
  const saves = post.saves_count || 0;

  const commentRate = comments / views;
  const shareRate = shares / views;
  const saveRate = saves / views;

  // Wilson Score lower bound pour la robustesse
  const wilsonLike = wilsonScore(likes, views);

  return (
    wilsonLike * WEIGHTS.LIKE_RATE +
    Math.min(commentRate * 10, 1) * WEIGHTS.COMMENT_RATE +
    Math.min(saveRate * 20, 1) * WEIGHTS.SAVE_RATE +
    Math.min(shareRate * 15, 1) * WEIGHTS.SHARE_RATE
  );
}

function wilsonScore(positive, total) {
  if (total === 0) return 0;
  const z = 1.96; // 95% confidence
  const phat = positive / total;
  return (phat + (z * z) / (2 * total) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * total)) / total)) /
    (1 + (z * z) / total);
}

/**
 * Score de fraîcheur (décroissance exponentielle)
 * Similaire à Reddit Hot / HackerNews ranking
 */
function computeFreshnessScore(post) {
  const ageHours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
  // Demi-vie de 24h pour le contenu normal, 6h pour les stories
  const halfLife = post.type === 'story' ? 6 : 24;
  return Math.pow(0.5, ageHours / halfLife);
}

/**
 * Score de viralité (vélocité d'engagement)
 * Mesure si un post "prend feu" en ce moment
 */
function computeViralScore(post) {
  const ageHours = Math.max((Date.now() - new Date(post.created_at).getTime()) / 3600000, 0.1);
  const totalEngagement = (post.likes_count || 0) + (post.comments_count || 0) * 2 + (post.shares_count || 0) * 3;
  // Engagement par heure (normalisé)
  const velocity = totalEngagement / ageHours;
  return Math.min(velocity / 100, 1); // Cap à 1
}

/**
 * Score de pertinence personnalisée
 */
function computePersonalizationScore(post, userProfile, followingIds) {
  let score = 0;

  // Boost si l'utilisateur suit le créateur
  if (followingIds.has(post.user_id)) {
    score += WEIGHTS.FOLLOWING_BOOST;
  }

  // Correspondance avec les intérêts déclarés
  const userInterests = userProfile?.interests || [];
  const postTags = post.hashtags || [];
  if (userInterests.length > 0 && postTags.length > 0) {
    const matches = postTags.filter(tag =>
      userInterests.some(interest =>
        tag.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(tag.toLowerCase())
      )
    ).length;
    score += (matches / Math.max(postTags.length, 1)) * WEIGHTS.INTEREST_MATCH;
  }

  // Correspondance avec comportement de session
  postTags.forEach(tag => {
    const tagScore = behaviorTracker.getTagScore(tag);
    score += Math.min(tagScore * 0.05, 0.15);
  });

  // Boost créateur avec qui l'utilisateur a interagi
  const creatorScore = behaviorTracker.getCreatorScore(post.user_id);
  score += Math.min(creatorScore * 0.03, 0.20);

  return Math.min(score, 1);
}

/**
 * Score de pénalité (déjà vu, même créateur répétitif)
 */
function computePenaltyScore(post, recentCreators) {
  let penalty = 0;

  if (behaviorTracker.hasSeenPost(post.id)) {
    penalty += Math.abs(WEIGHTS.ALREADY_SEEN);
  }

  if (behaviorTracker.hasSkippedPost(post.id)) {
    penalty += 0.5; // Pénalité supplémentaire si skippé
  }

  // Pénalité si le créateur a déjà 2+ posts dans les 10 derniers
  const creatorCount = recentCreators.filter(id => id === post.user_id).length;
  if (creatorCount >= 2) {
    penalty += Math.abs(WEIGHTS.SAME_CREATOR) * creatorCount;
  }

  return penalty;
}

/**
 * Score final composite
 */
function computeFinalScore(post, userProfile, followingIds, recentCreators, isDiscovery = false) {
  const engagement = computeEngagementScore(post);
  const freshness = computeFreshnessScore(post);
  const viral = computeViralScore(post);
  const personalization = computePersonalizationScore(post, userProfile, followingIds);
  const penalty = computePenaltyScore(post, recentCreators);
  const discoveryBonus = isDiscovery ? WEIGHTS.DISCOVERY : 0;

  // Formule finale pondérée
  const raw =
    engagement * 0.30 +
    freshness * 0.20 +
    viral * 0.15 +
    personalization * 0.30 +
    discoveryBonus +
    Math.random() * 0.05; // légère randomisation pour éviter la stagnation

  return Math.max(raw - penalty, 0);
}

// ─── Récupération des données ─────────────────────────────────────────────────

async function fetchFollowingIds(userId) {
  if (!userId) return new Set();
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  return new Set((data || []).map(f => f.following_id));
}

async function fetchUserInteractionHistory(userId, limit = 50) {
  if (!userId) return { likedPostIds: new Set(), savedPostIds: new Set() };
  const [likesRes, savedRes] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    supabase.from('saved_posts').select('post_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
  ]);
  return {
    likedPostIds: new Set((likesRes.data || []).map(l => l.post_id)),
    savedPostIds: new Set((savedRes.data || []).map(s => s.post_id)),
  };
}

/**
 * Récupère le pool de posts candidats
 * Stratégie multi-source comme TikTok :
 *  - Bucket 1: Posts des abonnements (fraîcheur prioritaire)
 *  - Bucket 2: Posts viraux / trending
 *  - Bucket 3: Posts découverte (algorithme pur)
 */
async function fetchCandidatePosts(userId, followingIds, page = 0, pageSize = 60) {
  const offset = page * pageSize;
  const promises = [];

  // Bucket 1: Abonnements (si connecté)
  if (followingIds.size > 0) {
    const followingArr = [...followingIds].slice(0, 50);
    promises.push(
      supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, username, full_name, avatar_url, is_verified, followers_count),
          likes (user_id),
          saved_posts (user_id)
        `)
        .in('user_id', followingArr)
        .order('created_at', { ascending: false })
        .limit(Math.floor(pageSize * FOLLOWING_RATIO))
    );
  }

  // Bucket 2: Trending / Viral
  promises.push(
    supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_verified, followers_count),
        likes (user_id),
        saved_posts (user_id)
      `)
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + Math.floor(pageSize * 0.40) - 1)
  );

  // Bucket 3: Découverte (récents, peu de vues = nouveaux créateurs)
  promises.push(
    supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_verified, followers_count),
        likes (user_id),
        saved_posts (user_id)
      `)
      .lt('views_count', 500) // Contenu sous-exposé
      .order('created_at', { ascending: false })
      .limit(Math.floor(pageSize * DISCOVERY_RATIO))
  );

  const results = await Promise.all(promises);

  // Fusion et déduplication
  const seen = new Set();
  const allPosts = [];
  results.forEach(res => {
    (res.data || []).forEach(post => {
      if (!seen.has(post.id)) {
        seen.add(post.id);
        allPosts.push(post);
      }
    });
  });

  return allPosts;
}

// ─── Diversification du feed ───────────────────────────────────────────────────

/**
 * Algorithme de diversification "MMR" (Maximal Marginal Relevance)
 * Équilibre pertinence ET diversité pour éviter la bulle de filtre
 */
function diversifyFeed(scoredPosts, targetSize) {
  if (scoredPosts.length <= targetSize) return scoredPosts;

  const selected = [];
  const remaining = [...scoredPosts];
  const creatorCounts = {};
  const tagCounts = {};

  while (selected.length < targetSize && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    remaining.forEach((post, idx) => {
      const creatorPenalty = (creatorCounts[post.user_id] || 0) * 0.15;
      const tagPenalty = (post.hashtags || []).reduce((sum, tag) =>
        sum + (tagCounts[tag] || 0) * 0.05, 0);
      const diversifiedScore = post._score - creatorPenalty - tagPenalty;
      if (diversifiedScore > bestScore) {
        bestScore = diversifiedScore;
        bestIdx = idx;
      }
    });

    const chosen = remaining.splice(bestIdx, 1)[0];
    selected.push(chosen);

    // Mise à jour des compteurs
    creatorCounts[chosen.user_id] = (creatorCounts[chosen.user_id] || 0) + 1;
    (chosen.hashtags || []).forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  }

  return selected;
}

// ─── API principale ───────────────────────────────────────────────────────────

/**
 * getRecommendedFeed - Point d'entrée principal
 *
 * @param {Object} options
 * @param {string|null} options.userId      - ID de l'utilisateur connecté
 * @param {Object|null} options.userProfile - Profil complet (intérêts, etc.)
 * @param {number}      options.page        - Page de pagination
 * @param {number}      options.pageSize    - Nombre de posts par page
 * @param {string[]}    options.recentCreators - IDs des créateurs déjà dans le feed affiché
 * @returns {Promise<Array>} - Posts triés par score de recommandation
 */
export async function getRecommendedFeed({
  userId = null,
  userProfile = null,
  page = 0,
  pageSize = FEED_SIZE,
  recentCreators = [],
} = {}) {
  try {
    // 1. Récupérer les abonnements
    const followingIds = await fetchFollowingIds(userId);

    // 2. Récupérer l'historique d'interactions
    const { likedPostIds, savedPostIds } = await fetchUserInteractionHistory(userId);

    // 3. Pool de candidats multi-source
    const candidates = await fetchCandidatePosts(userId, followingIds, page, pageSize * 3);

    // 4. Marquer les interactions connues
    const discoveryCreators = candidates
      .filter(p => (p.profiles?.followers_count || 0) < 1000)
      .map(p => p.user_id);
    const discoverySet = new Set(discoveryCreators);

    // 5. Scorer chaque post
    const scored = candidates.map(post => {
      const isLiked = likedPostIds.has(post.id) || post.likes?.some(l => l.user_id === userId);
      const isSaved = savedPostIds.has(post.id) || post.saved_posts?.some(s => s.user_id === userId);
      const isDiscovery = discoverySet.has(post.user_id);

      const score = computeFinalScore(post, userProfile, followingIds, recentCreators, isDiscovery);

      return {
        ...post,
        is_liked: isLiked,
        is_saved: isSaved,
        _score: score,
        _algo_version: ALGO_VERSION,
        _is_discovery: isDiscovery,
      };
    });

    // 6. Tri par score décroissant
    scored.sort((a, b) => b._score - a._score);

    // 7. Diversification MMR
    const diversified = diversifyFeed(scored, pageSize);

    return diversified;
  } catch (err) {
    console.error('[SkyAlgo] Error:', err);
    // Fallback: retour chronologique simple
    const { data } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (id, username, full_name, avatar_url, is_verified),
        likes (user_id),
        saved_posts (user_id)
      `)
      .order('created_at', { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    return (data || []).map(p => ({
      ...p,
      is_liked: p.likes?.some(l => l.user_id === userId) || false,
      is_saved: p.saved_posts?.some(s => s.user_id === userId) || false,
    }));
  }
}

/**
 * getExploreRecommendations - Pour la page Explore
 * Sélectionne du contenu trending et personnalisé
 */
export async function getExploreRecommendations({ userId = null, userProfile = null, limit = 30 } = {}) {
  try {
    const followingIds = await fetchFollowingIds(userId);
    const topTags = behaviorTracker.getTopTags(5);

    let query = supabase
      .from('posts')
      .select('id, media_url, thumbnail_url, type, likes_count, views_count, hashtags, created_at, shares_count, comments_count, user_id')
      .order('likes_count', { ascending: false })
      .limit(limit * 3);

    if (topTags.length > 0) {
      // Filtre "overlapping" sur les tags de l'utilisateur
      query = query.overlaps('hashtags', topTags);
    }

    const { data } = await query;

    const scored = (data || []).map(post => ({
      ...post,
      _score: computeFinalScore(post, userProfile, followingIds, [], false),
    })).sort((a, b) => b._score - a._score);

    return scored.slice(0, limit);
  } catch {
    const { data } = await supabase
      .from('posts')
      .select('id, media_url, thumbnail_url, type, likes_count, views_count')
      .order('likes_count', { ascending: false })
      .limit(limit);
    return data || [];
  }
}

/**
 * recordPostInteraction - À appeler depuis les composants lors d'une interaction
 */
export function recordPostInteraction(postId, type, creatorId, hashtags = []) {
  behaviorTracker.recordInteraction(postId, type, creatorId, hashtags);
}

/**
 * recordPostView - À appeler quand un post est affiché (avec durée pour les vidéos)
 */
export function recordPostView(postId, durationSeconds = 0, totalDuration = 0) {
  behaviorTracker.recordView(postId, durationSeconds, totalDuration);

  // Persistance asynchrone en DB (ne bloque pas l'UI)
  if (postId) {
    supabase.from('post_views').insert({
      post_id: postId,
      watch_duration: Math.floor(durationSeconds),
    }).then(() => {}).catch(() => {});
  }
}
