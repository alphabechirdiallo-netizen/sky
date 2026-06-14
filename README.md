# 🌌 Sky Social

Application sociale mobile-first (React + Supabase).

---

## 🚀 Démarrage rapide

```bash
npm install
cp .env.example .env  # remplis REACT_APP_SUPABASE_URL et REACT_APP_SUPABASE_ANON_KEY
npm start
```

---

## 🧠 Algorithme de Recommandation Sky v2.0

Sky intègre un moteur de recommandation ultra-puissant inspiré de TikTok, YouTube et Instagram.

### Architecture

```
src/utils/recommendationEngine.js   ← Moteur principal
src/hooks/useRecommendedFeed.js     ← Hook React
supabase-algorithm.sql              ← Tables & fonctions SQL
```

### Piliers de l'algorithme

| Pilier | Description |
|--------|-------------|
| **Score d'engagement** | Wilson Score (likes, comments, saves, shares) — statistiquement robuste |
| **Fraîcheur** | Décroissance exponentielle (demi-vie 24h) — favorise le contenu récent |
| **Viralité** | Vélocité d'engagement (interactions/heure) — détecte ce qui "prend feu" |
| **Personnalisation** | Intérêts déclarés + comportement de session (hashtags, créateurs) |
| **Diversification MMR** | Maximal Marginal Relevance — évite la bulle de filtre |
| **Boost découverte** | 20% du feed = nouveaux créateurs (< 1000 abonnés) |
| **Multi-source** | 3 buckets : Abonnements (35%) + Trending (45%) + Découverte (20%) |

### Formule de scoring

```
Score = Engagement×0.30 + Fraîcheur×0.20 + Viralité×0.15 + Personnalisation×0.30 + Découverte×0.10 + Aléatoire×0.05
Score -= PénalitéDéjàVu + PénalitéMêmeCréateur
```

### Comportement temps réel

L'algorithme apprend à chaque session :
- **Watch-time** → vidéos regardées en entier = intérêt fort
- **Likes/Saves/Comments/Shares** → pondérés différemment (save = 3×, share = 2.5×)
- **Skip rapide** → pénalité pour ce type de contenu
- **Profil créateur** → boost les créateurs avec qui tu interagis

### Déploiement SQL

1. Exécute `supabase-schema.sql` (base)
2. Exécute `supabase-algorithm.sql` (moteur algo)

Les triggers SQL recalculent automatiquement les scores à chaque like/comment/save.

---

## 📁 Structure

```
sky/
├── src/
│   ├── components/    # PostCard, ReelViewer, StoriesBar…
│   ├── pages/         # HomePage, ExplorePage, ProfilePage…
│   ├── hooks/
│   │   └── useRecommendedFeed.js   ← Hook algo
│   ├── utils/
│   │   ├── supabase.js
│   │   └── recommendationEngine.js ← Moteur algo
│   └── context/
│       └── AuthContext.js
├── supabase-schema.sql       ← Schema de base
├── supabase-algorithm.sql    ← Extension algo (NOUVEAU)
└── public/
```

---

## 🌐 Déploiement

Hébergé sur Netlify. Voir `netlify.toml`.
