import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Loading from "./components/Loading";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import History from "./components/History";
import AdminDashboard from "./components/AdminDashboard";
import Receipt from "./components/Receipt";

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Auth Screens */}
        <Route path="/" element={<Loading />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />

        {/* Main App Screens */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/history" element={<History />} />
        <Route path="/receipt" element={<Receipt />} />
        
        {/* Admin Screen */}
        <Route path="/admindashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}