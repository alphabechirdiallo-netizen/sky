import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, uploadFile } from '../utils/supabase';
import { useAuth } from '../context/AuthContext';
import './UploadPage.css';

const UPLOAD_TYPES = [
  { key: 'reel', label: 'Reel', icon: '▶' },
  { key: 'photo', label: 'Photo', icon: '◻' },
  { key: 'story', label: 'Story', icon: '◎' },
  { key: 'video', label: 'Vidéo', icon: '⬛' },
];

const UploadPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState('reel');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [isLongPhoto, setIsLongPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    setError('');
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    if (selectedFile.type.includes('image')) {
      const img = new Image();
      img.onload = () => {
        if (img.height / img.width > 2) setIsLongPhoto(true);
      };
      img.src = url;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const handlePublish = async () => {
    if (!file) { setError('Sélectionnez un fichier.'); return; }
    setLoading(true);
    setProgress(10);

    try {
      const ext = file.name.split('.').pop();
      const bucket = 'posts';
      const path = `${user.id}/${Date.now()}.${ext}`;

      setProgress(30);
      const mediaUrl = await uploadFile(bucket, file, path);
      setProgress(70);

      const postData = {
        user_id: user.id,
        type,
        media_url: mediaUrl,
        caption: caption.trim() || null,
        is_long_photo: isLongPhoto,
        hashtags: (caption.match(/#\w+/g) || []).map(h => h.slice(1)),
      };

      if (type === 'story') {
        await supabase.from('stories').insert({
          user_id: user.id,
          media_url: mediaUrl,
          media_type: file.type.includes('video') ? 'video' : 'image',
        });
      } else {
        const { error: insertError } = await supabase.from('posts').insert(postData);
        if (insertError) throw insertError;
      }

      setProgress(100);
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err) {
      setError('Erreur lors de la publication. Réessayez.');
      setLoading(false);
      setProgress(0);
    }
  };

  const isVideo = file?.type?.includes('video');

  return (
    <div className="upload-page">
      <header className="upload-header">
        <button className="upload-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12,19 5,12 12,5"/>
          </svg>
        </button>
        <h1>Nouveau post</h1>
        <button
          className="upload-publish-btn"
          onClick={handlePublish}
          disabled={loading || !file}
        >
          {loading ? <span className="btn-spinner" /> : 'Publier'}
        </button>
      </header>

      {/* Type selector */}
      <div className="upload-types">
        {UPLOAD_TYPES.map(t => (
          <button
            key={t.key}
            className={`upload-type-btn ${type === t.key ? 'active' : ''}`}
            onClick={() => setType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Drop zone */}
      {!preview ? (
        <div
          className={`upload-dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="dropzone-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17,8 12,3 7,8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p className="dropzone-title">
            {type === 'story' ? 'Ajouter à votre story' :
             type === 'reel' ? 'Importer une vidéo courte' :
             type === 'photo' ? 'Sélectionner une photo' :
             'Importer une vidéo'}
          </p>
          <p className="dropzone-sub">
            {isVideo ? 'MP4, MOV, AVI' : 'JPG, PNG, GIF, WebP'}
            {' · '}Max 200 Mo
          </p>
          <button className="btn-primary" style={{ marginTop: 8 }}>
            Parcourir
          </button>
        </div>
      ) : (
        <div className="upload-preview-section">
          <div className={`upload-preview ${isLongPhoto ? 'long-preview' : ''}`}>
            {isVideo ? (
              <video src={preview} controls playsInline className="preview-video" />
            ) : (
              <img src={preview} alt="preview" className={isLongPhoto ? 'long-photo-preview' : ''} />
            )}
            <button className="preview-change" onClick={() => { setFile(null); setPreview(null); }}>
              Changer
            </button>
          </div>

          {/* Long photo toggle */}
          {!isVideo && (
            <div className="upload-option">
              <div className="upload-option-info">
                <span className="upload-option-label">Mode longue photo</span>
                <span className="upload-option-sub">Affiche l'image progressivement</span>
              </div>
              <div
                className={`toggle ${isLongPhoto ? 'on' : ''}`}
                onClick={() => setIsLongPhoto(v => !v)}
              >
                <div className="toggle-thumb" />
              </div>
            </div>
          )}

          {/* Caption */}
          <div className="upload-caption">
            <div className="upload-caption-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <div className="comment-avatar-placeholder" style={{width:36,height:36,fontSize:14}}>
                  {profile?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <textarea
              placeholder="Écrivez une légende, ajoutez des #hashtags..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              maxLength={2200}
            />
          </div>
          <div className="caption-count">{caption.length}/2200</div>

          {error && <div className="auth-error" style={{margin:'0 16px'}}>{error}</div>}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={type === 'photo' || type === 'story' ? 'image/*' : type === 'reel' || type === 'video' ? 'video/*' : '*/*'}
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
      />
    </div>
  );
};

export default UploadPage;
