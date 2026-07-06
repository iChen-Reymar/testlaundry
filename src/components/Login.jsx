import React, { useState, useEffect } from "react";
import { ChevronLeft, Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";
import logo from "../assets/logo.png";

export default function Login() {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await api.auth.getSession();
      if (session) {
        const userProfile = localStorage.getItem('userProfile');
        if (userProfile) {
          navigate("/dashboard", { replace: true });
        }
      }
    } catch (error) {
      console.error("Session check error:", error);
    }
  };

  const handleChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleLogin = async () => {
    setError("");
    if (!loginData.email || !loginData.password) {
      setError("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInError } = await api.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });
      if (signInError) throw signInError;

      const profile = data.user;

      localStorage.setItem(
        "userProfile",
        JSON.stringify({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          profile_image: profile.profile_image,
        })
      );

      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-6 sm:py-8">
      <div className="bg-white w-full max-w-md rounded-xl shadow-sm p-6 sm:p-8 border border-gray-200">
        <button
          onClick={() => navigate("/")}
          className="mb-6 p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex justify-center mb-6">
          <img src={logo} alt="Logo" className="w-24 h-auto" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600 text-sm">
            Sign in to your account
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={loginData.email}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={loginData.password}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="pt-6">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Logging in...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Log In
              </>
            )}
          </button>
        </div>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
