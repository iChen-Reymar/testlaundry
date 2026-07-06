import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./components/Landing";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import History from "./components/History";
import AdminDashboard from "./components/AdminDashboard";
import Messages from "./components/Messages";
import Receipt from "./components/Receipt";
import ProtectedRoute from "./components/ProtectedRoute";
import SupabaseConfigGuard from "./components/SupabaseConfigGuard";

export default function App() {
  return (
    <SupabaseConfigGuard>
    <Router>
      <Routes>
        {/* Public Screens */}
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* Protected Routes - Require Authentication */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/history" 
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/messages" 
          element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/receipt" 
          element={
            <ProtectedRoute>
              <Receipt />
            </ProtectedRoute>
          } 
        />
        
        {/* Admin Screen - Protected */}
        <Route 
          path="/admindashboard" 
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch-all route - redirect to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </SupabaseConfigGuard>
  );
}
