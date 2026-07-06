// src/context/authcontext.jsx
import api from "../lib/apiClient.js";

export const getCurrentUser = async () => {
  const { data: { user } } = await api.auth.getUser();
  return user;
};

export const getUserProfile = async (userId) => {
  const data = await api.profiles.get(userId);
  return data;
};

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

export const isStaff = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    const profile = await getUserProfile(user.id);
    return profile?.role === 'admin' || profile?.role === 'staff';
  } catch (error) {
    console.error("Error checking staff status:", error);
    return false;
  }
};

export const getUserRole = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) return 'user';
    const profile = await getUserProfile(user.id);
    return profile?.role || 'user';
  } catch (error) {
    console.error("Error getting user role:", error);
    return 'user';
  }
};

export const logout = async () => {
  try {
    await api.auth.signOut();
    localStorage.removeItem('userProfile');
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
};

export const isAuthenticated = async () => {
  const user = await getCurrentUser();
  return user !== null;
};

export const getStoredUser = () => {
  const userProfile = localStorage.getItem('userProfile');
  return userProfile ? JSON.parse(userProfile) : null;
};
