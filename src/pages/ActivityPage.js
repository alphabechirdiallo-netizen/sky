import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import './ActivityPage.css';

const ActivityPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    markAllRead();
  }, [user]);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:actor_id(id, username, avatar_url, is_verified),
        post:post_id(id, media_url, thumbnail_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  };

  const getNotifText = (n) => {
    switch (n.type) {
      case 'like': return 'a aimé votre publication.';
      case 'comment': return 'a commenté votre publication.';
      case 'follow': return 'a commencé à vous suivre.';
      case 'mention': return 'vous a mentionné dans un commentaire.';
      case 'share': return 'a partagé votre publication.';
      case 'live': return 'est en direct.';
      default: return 'a interagi avec vous.';
    }
  };

  if (!user) return (
    <div className="activity-page">
      <div className="activity-empty">
        <h3>Connectez-vous pour voir votre activité</h3>
        <button className="btn-primary" onClick={() => navigate('/auth')}>Se connecter</button>
      </div>
    </div>
  );

  return (
    <div className="activity-page">
      <header className="activity-header">
        <h1>Activité</h1>
      </header>

      {loading ? (
        <div className="activity-list">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="notif-skeleton">
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
              <div className="skeleton" style={{ flex: 1, height: 44 }} />
              <div className="skeleton" style={{ width: 44, height: 44 }} />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="activity-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.2" width="48" height="48">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <p>Pas encore de notifications</p>
          <span>Vos interactions apparaîtront ici</span>
        </div>
      ) : (
        <div className="activity-list">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.is_read ? 'unread' : ''}`}
              onClick={() => n.post_id ? navigate(`/post/${n.post_id}`) : navigate(`/user/${n.actor?.username}`)}
            >
              <div className="notif-avatar">
                {n.actor?.avatar_url ? (
                  <img src={n.actor.avatar_url} alt="" />
                ) : (
                  <div className="notif-avatar-placeholder">
                    {n.actor?.username?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className={`notif-type-icon type-${n.type}`}>
                  {n.type === 'like' && (
                    <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                    </svg>
                  )}
                  {n.type === 'comment' && (
                    <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                  )}
                  {n.type === 'follow' && (
                    <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                  {n.type === 'share' && (
                    <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22,2 15,22 11,13 2,9"/>
                    </svg>
                  )}
                </div>
              </div>
              <div className="notif-content">
                <p>
                  <span className="notif-username">{n.actor?.username}</span>{' '}
                  {getNotifText(n)}
                </p>
                <span className="notif-time">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
              {n.post?.media_url && (
                <div className="notif-post-thumb">
                  <img src={n.post.thumbnail_url || n.post.media_url} alt="" />
                </div>
              )}
              {n.type === 'follow' && (
                <button className="notif-follow-btn">S'abonner</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  );
};

export default ActivityPage;
