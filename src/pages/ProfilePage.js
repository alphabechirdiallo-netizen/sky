import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase, uploadFile } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import './ProfilePage.css';

const ProfilePage = ({ isOwn }) => {
  const { username } = useParams();
  const { user, profile: myProfile, updateProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tab, setTab] = useState('posts'); // posts | reels | saved
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const avatarRef = React.useRef();
  const coverRef = React.useRef();

  const isSelf = isOwn || (user && profile?.id === user?.id);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line
  }, [username, myProfile]);

  const fetchProfile = async () => {
    setLoading(true);
    let profileData;
    if (isOwn) {
      profileData = myProfile;
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
      profileData = data;
    }
    setProfile(profileData);

    if (profileData) {
      fetchPosts(profileData.id);
      if (user && !isSelf) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileData.id)
          .single();
        setIsFollowing(!!followData);
      }
    }
    setLoading(false);
  };

  const fetchPosts = async (userId) => {
    const { data } = await supabase
      .from('posts')
      .select('id, media_url, thumbnail_url, type, likes_count, views_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };

  const handleFollow = async () => {
    if (!user) { navigate('/auth'); return; }
    if (isFollowing) {
      await supabase.from('follows').delete()
        .match({ follower_id: user.id, following_id: profile.id });
      setIsFollowing(false);
      setProfile(p => ({ ...p, followers_count: p.followers_count - 1 }));
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profile.id });
      setIsFollowing(true);
      setProfile(p => ({ ...p, followers_count: p.followers_count + 1 }));
    }
  };

  const startEdit = () => {
    setEditForm({
      full_name: profile.full_name || '',
      username: profile.username || '',
      bio: profile.bio || '',
      website: profile.website || '',
      location: profile.location || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { data, error } = await updateProfile(editForm);
    if (!error) {
      setProfile(p => ({ ...p, ...editForm }));
      setEditing(false);
    }
    setSaving(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `avatars/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const url = await uploadFile('avatars', file, path);
    await updateProfile({ avatar_url: url });
    setProfile(p => ({ ...p, avatar_url: url }));
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `covers/${user.id}/${Date.now()}.${file.name.split('.').pop()}`;
    const url = await uploadFile('covers', file, path);
    await updateProfile({ cover_url: url });
    setProfile(p => ({ ...p, cover_url: url }));
  };

  const filteredPosts = posts.filter(p => {
    if (tab === 'reels') return p.type === 'reel' || p.type === 'video';
    return p.type === 'photo' || p.type === 'reel' || p.type === 'video';
  });

  if (loading) return (
    <div className="profile-page">
      <div className="profile-skeleton">
        <div className="skeleton" style={{ height: 180 }} />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%', marginTop: -40 }} />
          <div className="skeleton" style={{ height: 20, width: 140 }} />
          <div className="skeleton" style={{ height: 16, width: 200 }} />
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="profile-page">
      <div className="profile-not-found">
        <h2>Utilisateur introuvable</h2>
        <p>Ce profil n'existe pas ou a été supprimé.</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Accueil</button>
      </div>
    </div>
  );

  return (
    <div className="profile-page">
      {/* Cover */}
      <div className="profile-cover">
        {profile.cover_url ? (
          <img src={profile.cover_url} alt="cover" />
        ) : (
          <div className="profile-cover-placeholder" />
        )}
        {isSelf && (
          <>
            <button className="cover-edit-btn" onClick={() => coverRef.current?.click()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="16" height="16">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverChange} />
          </>
        )}
        <button className="profile-back-btn" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" width="20" height="20">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12,19 5,12 12,5"/>
          </svg>
        </button>
        {isSelf && (
          <button className="profile-menu-btn" onClick={() => setShowMenu(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" width="20" height="20">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Profile info */}
      <div className="profile-info">
        <div className="profile-avatar-row">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar avatar-gradient">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} />
              ) : (
                <div className="avatar-placeholder large">
                  {profile.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            {isSelf && (
              <>
                <button className="avatar-edit-btn" onClick={() => avatarRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="white" width="12" height="12">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>
                <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </>
            )}
          </div>

          {/* Stats */}
          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-num">{posts.length}</span>
              <span className="stat-label">Posts</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{(profile.followers_count || 0).toLocaleString()}</span>
              <span className="stat-label">Abonnés</span>
            </div>
            <div className="stat-item">
              <span className="stat-num">{(profile.following_count || 0).toLocaleString()}</span>
              <span className="stat-label">Abonnements</span>
            </div>
          </div>
        </div>

        {/* Name & bio */}
        <div className="profile-bio-section">
          <div className="profile-name-row">
            <h1 className="profile-name">{profile.full_name || profile.username}</h1>
            {profile.is_verified && (
              <span className="verified-badge">
                <svg viewBox="0 0 24 24" fill="var(--ig-blue)" width="16" height="16">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
                </svg>
              </span>
            )}
          </div>
          <p className="profile-handle">@{profile.username}</p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          {profile.location && (
            <div className="profile-meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{profile.location}</span>
            </div>
          )}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noreferrer" className="profile-website">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
              <span>{profile.website.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
          {profile.interests?.length > 0 && (
            <div className="profile-interests">
              {profile.interests.slice(0, 5).map(i => (
                <span key={i} className="interest-tag">{i}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="profile-actions">
          {isSelf ? (
            <>
              <button className="btn-secondary profile-action-btn" onClick={startEdit}>
                Modifier le profil
              </button>
              <button className="btn-secondary profile-action-btn" onClick={() => navigate('/upload')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                className={`profile-action-btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}`}
                onClick={handleFollow}
              >
                {isFollowing ? 'Abonné' : 'S\'abonner'}
              </button>
              <button className="btn-secondary profile-action-btn" onClick={() => navigate(`/messages/${profile.id}`)}>
                Message
              </button>
              <button className="btn-secondary profile-icon-btn" onClick={() => {}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        {['posts', 'reels'].map(t => (
          <button
            key={t}
            className={`profile-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'posts' ? (
              <svg viewBox="0 0 24 24" fill={tab === t ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" width="20" height="20">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill={tab === t ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" width="20" height="20">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            )}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="profile-grid">
        {filteredPosts.length === 0 && (
          <div className="grid-empty">
            <p>Aucun contenu</p>
          </div>
        )}
        {filteredPosts.map(p => (
          <div
            key={p.id}
            className="grid-item"
            onClick={() => navigate(`/post/${p.id}`)}
          >
            <img
              src={p.thumbnail_url || p.media_url}
              alt=""
              loading="lazy"
            />
            {(p.type === 'video' || p.type === 'reel') && (
              <div className="grid-video-badge">
                <svg viewBox="0 0 24 24" fill="white" width="12" height="12">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay center" onClick={() => setEditing(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <button onClick={() => setEditing(false)}>Annuler</button>
              <h3>Modifier le profil</h3>
              <button className="edit-save-btn" onClick={saveEdit} disabled={saving}>
                {saving ? <span className="btn-spinner" style={{width:16,height:16}} /> : 'Enregistrer'}
              </button>
            </div>
            <div className="edit-fields">
              {[
                { key: 'full_name', label: 'Nom', placeholder: 'Votre nom' },
                { key: 'username', label: 'Pseudo', placeholder: 'nom_utilisateur' },
                { key: 'bio', label: 'Bio', placeholder: 'Parlez de vous...', multiline: true },
                { key: 'website', label: 'Site web', placeholder: 'https://...' },
                { key: 'location', label: 'Lieu', placeholder: 'Votre ville' },
              ].map(f => (
                <div key={f.key} className="edit-field">
                  <label>{f.label}</label>
                  {f.multiline ? (
                    <textarea
                      value={editForm[f.key] || ''}
                      onChange={e => setEditForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={3}
                    />
                  ) : (
                    <input
                      type="text"
                      value={editForm[f.key] || ''}
                      onChange={e => setEditForm(ef => ({ ...ef, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings menu */}
      {showMenu && (
        <div className="modal-overlay" onClick={() => setShowMenu(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            {[
              { label: 'Paramètres', action: () => {} },
              { label: 'Activité', action: () => navigate('/activity') },
              { label: 'Contenu enregistré', action: () => setTab('saved') },
              { label: 'Code QR', action: () => {} },
              { label: 'Se déconnecter', action: signOut, danger: true },
            ].map(item => (
              <button
                key={item.label}
                className={`menu-item ${item.danger ? 'danger' : ''}`}
                onClick={() => { item.action(); setShowMenu(false); }}
              >
                {item.label}
              </button>
            ))}
            <button className="sheet-cancel" onClick={() => setShowMenu(false)}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
};

export default ProfilePage;
