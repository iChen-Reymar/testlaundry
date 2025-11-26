// src/utils/authHelpers.js
import supabase from "../supabaseClient";

// Get current logged in user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Get user profile with role
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

// Check if user is admin
export const isAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    
    const profile = await getUserProfile(user.id);
    return profile?.role === 'admin';
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
};

// Logout user
export const logout = async () => {
  try {
    await supabase.auth.signOut();
    localStorage.removeItem('userProfile');
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

// Check if user is authenticated
export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return user !== null;
};

// Get user from localStorage (for quick access without API call)
export const getStoredUser = () => {
  const userProfile = localStorage.getItem('userProfile');
  return userProfile ? JSON.parse(userProfile) : null;
};