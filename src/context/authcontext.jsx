// src/context/authcontext.jsx
import supabase, { resolveClient } from "../lib/supabaseClient.js";

// Get current logged in user
export const getCurrentUser = async (client) => {
  const sb = resolveClient(client || supabase);
  const { data: { user } } = await sb.auth.getUser();
  return user;
};

// Get user profile with role
export const getUserProfile = async (userId, client) => {
  const sb = resolveClient(client || supabase);
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

// Check if user is admin
export const isAdmin = async (client) => {
  try {
    const user = await getCurrentUser(client);
    if (!user) return false;
    
    const profile = await getUserProfile(user.id, client);
    return profile?.role === 'admin';
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// Logout user
export const logout = async (client) => {
  const sb = resolveClient(client || supabase);
  try {
    await sb.auth.signOut();
    localStorage.removeItem('userProfile');
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

// Check if user is authenticated
export const isAuthenticated = async (client) => {
  const user = await getCurrentUser(client);
  return user !== null;
};

// Get user from localStorage (for quick access without API call)
export const getStoredUser = () => {
  const userProfile = localStorage.getItem('userProfile');
  return userProfile ? JSON.parse(userProfile) : null;
};