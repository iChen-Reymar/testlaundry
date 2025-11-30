<<<<<<< HEAD
import React, { useState, useEffect } from "react";
import { ChevronLeft, Mail, Lock, LogIn, Sparkles } from "lucide-react";
=======
import React, { useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import logo from "../assets/logo.png";
import facebook from "../assets/facebook.png";
import gmail from "../assets/gmail.png";

export default function Login() {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Check if already logged in
  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userProfile = localStorage.getItem('userProfile');
        if (userProfile) {
          // User is already logged in, redirect to dashboard
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
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });
      if (signInError) throw signInError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileError) throw profileError;

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white w-full max-w-md rounded-xl shadow-sm p-8 border border-gray-200">
        <button
          onClick={() => navigate("/")}
          className="mb-6 p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex justify-center mb-6">
          <img src={logo} alt="Logo" className="w-24 h-auto" />
        </div>

<<<<<<< HEAD
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600 text-sm">
            Sign in to your account
          </p>
        </div>
=======
        <h1 className="text-3xl font-bold text-center text-black mb-1">Log In</h1>
        <p className="text-center text-gray-500 mb-6">Enter your details to continue</p>
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
<<<<<<< HEAD
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
              type="password"
=======
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={loginData.email}
            onChange={handleChange}
            onKeyPress={handleKeyPress}
            className="w-full px-5 py-3 border-2 border-gray-300 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            disabled={loading}
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
              name="password"
              placeholder="Password"
              value={loginData.password}
              onChange={handleChange}
              onKeyPress={handleKeyPress}
<<<<<<< HEAD
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
=======
              className="w-full px-5 py-3 border-2 border-gray-300 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 cursor-pointer"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
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

<<<<<<< HEAD
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <div className="flex justify-center gap-3 mb-6">
          <a
            href="https://www.facebook.com/login.php"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <img src={facebook} alt="Facebook" className="w-5 h-5" />
          </a>
          <a
            href="https://accounts.google.com/signin"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <img src={gmail} alt="Gmail" className="w-5 h-5" />
=======
        <p className="text-center text-gray-500 text-sm my-4">Or log in with</p>
        <div className="flex justify-center gap-8 mb-4">
          <a href="https://www.facebook.com/login.php" target="_blank" rel="noopener noreferrer">
            <img src={facebook} alt="Facebook" className="w-8 h-8" />
          </a>
          <a href="https://accounts.google.com/signin" target="_blank" rel="noopener noreferrer">
            <img src={gmail} alt="Gmail" className="w-8 h-8" />
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
          </a>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
<<<<<<< HEAD
          <button
            onClick={() => navigate("/signup")}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
=======
          <button onClick={() => navigate("/signup")} className="font-semibold text-blue-500 hover:underline">
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
