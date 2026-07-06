import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import api from "../lib/apiClient";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await api.auth.getSession();

      if (error || !session?.user) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const userProfile = localStorage.getItem('userProfile');
      if (userProfile) {
        setIsAuthenticated(true);
      } else {
        const profile = await api.profiles.get(session.user.id);

        if (profile) {
          localStorage.setItem('userProfile', JSON.stringify({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
            profile_image: profile.profile_image
          }));
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsAuthenticated(false);
      localStorage.removeItem('userProfile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
