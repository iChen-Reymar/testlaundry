import React, { useState } from "react";
<<<<<<< HEAD
import { ChevronLeft, Mail, Lock, User, UserPlus, Sparkles } from "lucide-react";
=======
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";
import logo from "../assets/logo.png";
import facebook from "../assets/facebook.png";
import gmail from "../assets/gmail.png";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { name: formData.name } },
      });
      if (signUpError) throw signUpError;

      // Store user info in localStorage
      localStorage.setItem(
        "userProfile",
        JSON.stringify({
          id: data.user.id,
          email: formData.email,
          name: formData.name,
          role: "user",
          profile_image: null,
        })
      );

      alert("Account created successfully! Please check your email for verification.");
      navigate("/login");
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600 text-sm">
            Sign up to get started
          </p>
        </div>
=======
        <h1 className="text-3xl font-bold text-center text-black mb-1">Sign Up</h1>
        <p className="text-center text-gray-500 mb-6">Create an account to continue</p>
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
<<<<<<< HEAD
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
=======
          {["name", "email"].map((field) => (
            <input
              key={field}
              type={field === "email" ? "email" : "text"}
              name={field}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={formData[field]}
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
<<<<<<< HEAD
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
=======
          ))}

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
<<<<<<< HEAD
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
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
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
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
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
          </div>
        </div>

        <div className="pt-6">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating Account...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Sign Up
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
        <p className="text-center text-gray-500 text-sm my-4">Or sign up with</p>
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
          Already have an account?{" "}
<<<<<<< HEAD
          <button
            onClick={() => navigate("/login")}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
=======
          <button onClick={() => navigate("/login")} className="font-semibold text-blue-500 hover:underline">
>>>>>>> 6e9187bc5daa1cfff2d86c99b9f37f74d5e60857
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
