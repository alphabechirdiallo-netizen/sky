import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import StoryViewer from './StoryViewer';
import './StoriesBar.css';

const StoriesBar = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null);
  const scrollRef = useRef();

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*, profiles:user_id(id, username, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    // Group by user
    const grouped = {};
    (data || []).forEach(s => {
      const uid = s.user_id;
      if (!grouped[uid]) grouped[uid] = { profile: s.profiles, items: [], id: uid };
      grouped[uid].items.push(s);
    });

    setStories(Object.values(grouped));
  };

  return (
    <>
      <div className="stories-bar" ref={scrollRef}>
        {/* My story */}
        <div className="story-item my-story" onClick={() => navigate('/upload')}>
          <div className="story-avatar-wrap">
            <div className="story-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <div className="story-avatar-placeholder">
                  {profile?.username?.[0]?.toUpperCase() || 'M'}
                </div>
              )}
            </div>
            <div className="story-add-btn">
              <svg viewBox="0 0 24 24" fill="white" width="10" height="10">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
          </div>
          <span className="story-label">Ma story</span>
        </div>

        {/* Others' stories */}
        {stories.map((group, i) => (
          <div
            key={group.id}
            className="story-item"
            onClick={() => setActiveStory(group)}
          >
            <div className="story-avatar-wrap">
              <div className="story-ring">
                <div className="story-avatar">
                  {group.profile?.avatar_url ? (
                    <img src={group.profile.avatar_url} alt="" />
                  ) : (
                    <div className="story-avatar-placeholder">
                      {group.profile?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <span className="story-label">{group.profile?.username}</span>
          </div>
        ))}
      </div>

      {activeStory && (
        <StoryViewer
          storyGroup={activeStory}
          onClose={() => setActiveStory(null)}
        />
      )}
    </>
  );
};

export default StoriesBar;
