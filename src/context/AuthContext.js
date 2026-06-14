import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const signUp = async ({ email, password, username, fullName, interests }) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (data?.user) {
        // Update profile with interests
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username,
          full_name: fullName,
          interests: interests || [],
        });
      }
      return { data, error: null };
    } catch (err) {
      const msg = getFriendlyError(err.message);
      setAuthError(msg);
      return { data: null, error: msg };
    }
  };

  const signIn = async ({ email, password }) => {
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      const msg = getFriendlyError(err.message);
      setAuthError(msg);
      return { data: null, error: msg };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();
    if (!error && data) setProfile(data);
    return { data, error };
  };

  const getFriendlyError = (message) => {
    if (message?.includes('Invalid login')) return 'Email ou mot de passe incorrect.';
    if (message?.includes('Email not confirmed')) return 'Veuillez confirmer votre email.';
    if (message?.includes('User already registered')) return 'Cet email est déjà utilisé.';
    if (message?.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (message?.includes('rate limit')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    if (message?.includes('network') || message?.includes('fetch')) return 'Connexion impossible. Vérifiez votre réseau.';
    return message || 'Une erreur est survenue. Veuillez réessayer.';
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authError,
      setAuthError,
      signUp,
      signIn,
      signOut,
      updateProfile,
      fetchProfile: () => user && fetchProfile(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
};
