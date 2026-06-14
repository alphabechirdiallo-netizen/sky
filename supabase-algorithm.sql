-- ============================================================
-- SKY RECOMMENDATION ENGINE v2.0 — SQL Supabase
-- À exécuter dans Supabase SQL Editor APRÈS supabase-schema.sql
-- ============================================================

-- ── 1. Table : scores de recommandation pré-calculés (cache) ──────────────────
-- Permet des recommandations quasi-instantanées en stockant les scores
CREATE TABLE IF NOT EXISTS recommendation_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  engagement_score FLOAT DEFAULT 0,
  freshness_score FLOAT DEFAULT 0,
  viral_score FLOAT DEFAULT 0,
  composite_score FLOAT DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id)
);

CREATE INDEX IF NOT EXISTS idx_rec_scores_composite ON recommendation_scores(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_rec_scores_post ON recommendation_scores(post_id);

-- RLS
ALTER TABLE recommendation_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scores are public" ON recommendation_scores FOR SELECT USING (true);
CREATE POLICY "System can manage scores" ON recommendation_scores FOR ALL USING (true);

-- ── 2. Table : profil comportemental utilisateur (persistant) ─────────────────
-- Stocke les préférences apprises de chaque utilisateur
CREATE TABLE IF NOT EXISTS user_behavior_profiles (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  top_hashtags TEXT[] DEFAULT '{}',        -- hashtags les plus appréciés
  top_creator_ids UUID[] DEFAULT '{}',     -- créateurs préférés
  avg_watch_completion FLOAT DEFAULT 0,    -- completion moyenne des vidéos
  preferred_content_types TEXT[] DEFAULT '{}', -- video, photo, reel
  total_interactions INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_behavior_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own behavior profile" ON user_behavior_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage behavior profiles" ON user_behavior_profiles FOR ALL USING (true);

-- ── 3. Table : saves_count dénormalisé sur posts ─────────────────────────────
-- Ajoute saves_count à posts pour éviter les JOINs coûteux dans l'algo
ALTER TABLE posts ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0;

-- Trigger pour maintenir saves_count
CREATE OR REPLACE FUNCTION update_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET saves_count = saves_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_save_change ON saved_posts;
CREATE TRIGGER on_save_change
  AFTER INSERT OR DELETE ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION update_saves_count();

-- ── 4. Fonction Supabase : calcul du score d'engagement en temps réel ─────────
-- Calcule le Wilson Score et met à jour recommendation_scores
CREATE OR REPLACE FUNCTION compute_post_engagement_score(p_post_id UUID)
RETURNS FLOAT AS $$
DECLARE
  v_views INTEGER;
  v_likes INTEGER;
  v_comments INTEGER;
  v_shares INTEGER;
  v_saves INTEGER;
  v_age_hours FLOAT;
  v_engagement FLOAT;
  v_freshness FLOAT;
  v_viral FLOAT;
  v_composite FLOAT;
  z FLOAT := 1.96;
  phat FLOAT;
  wilson FLOAT;
BEGIN
  SELECT
    GREATEST(views_count, 1),
    likes_count,
    comments_count,
    shares_count,
    saves_count,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0
  INTO v_views, v_likes, v_comments, v_shares, v_saves, v_age_hours
  FROM posts WHERE id = p_post_id;

  IF NOT FOUND THEN RETURN 0; END IF;

  -- Wilson Score pour les likes
  phat := v_likes::FLOAT / v_views;
  wilson := (phat + (z*z)/(2*v_views) - z * SQRT((phat*(1-phat) + (z*z)/(4*v_views)) / v_views))
            / (1 + (z*z)/v_views);

  -- Score d'engagement composite
  v_engagement := wilson * 0.25
    + LEAST((v_comments::FLOAT / v_views) * 10, 1) * 0.20
    + LEAST((v_saves::FLOAT / v_views) * 20, 1) * 0.20
    + LEAST((v_shares::FLOAT / v_views) * 15, 1) * 0.15;

  -- Score de fraîcheur (demi-vie 24h)
  v_freshness := POWER(0.5, v_age_hours / 24.0);

  -- Score de viralité (engagement / heure)
  v_viral := LEAST(
    (v_likes + v_comments * 2 + v_shares * 3)::FLOAT / GREATEST(v_age_hours, 0.1) / 100.0,
    1.0
  );

  -- Score composite
  v_composite := v_engagement * 0.40 + v_freshness * 0.30 + v_viral * 0.30;

  -- Upsert dans recommendation_scores
  INSERT INTO recommendation_scores (post_id, engagement_score, freshness_score, viral_score, composite_score, computed_at)
  VALUES (p_post_id, v_engagement, v_freshness, v_viral, v_composite, NOW())
  ON CONFLICT (post_id) DO UPDATE SET
    engagement_score = EXCLUDED.engagement_score,
    freshness_score = EXCLUDED.freshness_score,
    viral_score = EXCLUDED.viral_score,
    composite_score = EXCLUDED.composite_score,
    computed_at = NOW();

  RETURN v_composite;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Trigger : recalcule le score à chaque like/comment/save/share ──────────
CREATE OR REPLACE FUNCTION trigger_recompute_score()
RETURNS TRIGGER AS $$
DECLARE v_post_id UUID;
BEGIN
  v_post_id := COALESCE(NEW.post_id, OLD.post_id);
  IF v_post_id IS NOT NULL THEN
    PERFORM compute_post_engagement_score(v_post_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS recompute_on_like ON likes;
CREATE TRIGGER recompute_on_like
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION trigger_recompute_score();

DROP TRIGGER IF EXISTS recompute_on_comment ON comments;
CREATE TRIGGER recompute_on_comment
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION trigger_recompute_score();

DROP TRIGGER IF EXISTS recompute_on_save ON saved_posts;
CREATE TRIGGER recompute_on_save
  AFTER INSERT OR DELETE ON saved_posts
  FOR EACH ROW EXECUTE FUNCTION trigger_recompute_score();

-- ── 6. Vue : feed recommandé optimisé (utilisable en query directe) ───────────
CREATE OR REPLACE VIEW v_recommended_posts AS
SELECT
  p.*,
  rs.composite_score,
  rs.engagement_score,
  rs.freshness_score,
  rs.viral_score,
  pr.username,
  pr.full_name,
  pr.avatar_url,
  pr.is_verified,
  pr.followers_count
FROM posts p
LEFT JOIN recommendation_scores rs ON rs.post_id = p.id
LEFT JOIN profiles pr ON pr.id = p.user_id
ORDER BY COALESCE(rs.composite_score, 0) DESC;

-- ── 7. Index supplémentaires pour les performances de l'algo ─────────────────
CREATE INDEX IF NOT EXISTS idx_posts_likes_count ON posts(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_posts_views_count ON posts(views_count);
CREATE INDEX IF NOT EXISTS idx_posts_hashtags ON posts USING GIN(hashtags);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_duration ON post_views(watch_duration DESC);

-- ── 8. Initialise les scores pour les posts existants ─────────────────────────
-- À exécuter une fois après déploiement pour pré-calculer les scores existants
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM posts LOOP
    PERFORM compute_post_engagement_score(r.id);
  END LOOP;
END $$;

-- ── 9. Policy pour la vue ─────────────────────────────────────────────────────
-- Note: les vues héritent des RLS des tables sous-jacentes dans Supabase
GRANT SELECT ON v_recommended_posts TO anon, authenticated;
