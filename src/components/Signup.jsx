import React, { useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";
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
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white w-full max-w-md md:max-w-lg rounded-3xl shadow-xl p-8">
        <button
          onClick={() => navigate("/")}
          className="mb-6 p-2 hover:bg-gray-100 rounded-full transition-all duration-150 cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>

        <div className="flex justify-center mb-4">
          <img src={logo} alt="Logo" className="w-28 md:w-32 h-auto" />
        </div>

        <h1 className="text-3xl font-bold text-center text-black mb-1">Sign Up</h1>
        <p className="text-center text-gray-500 mb-6">Create an account to continue</p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {["name", "email"].map((field) => (
            <input
              key={field}
              type={field === "email" ? "email" : "text"}
              name={field}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={formData[field]}
              onChange={handleChange}
              className="w-full px-5 py-3 border-2 border-gray-300 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              disabled={loading}
            />
          ))}

          {/* Password */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
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
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
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
          </div>
        </div>

        <div className="flex justify-center pt-6">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-50 py-3 bg-gray-400 text-black text-lg rounded-full font-semibold hover:bg-blue-500 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </div>

        <p className="text-center text-gray-500 text-sm my-4">Or sign up with</p>
        <div className="flex justify-center gap-8 mb-4">
          <a href="https://www.facebook.com/login.php" target="_blank" rel="noopener noreferrer">
            <img src={facebook} alt="Facebook" className="w-8 h-8" />
          </a>
          <a href="https://accounts.google.com/signin" target="_blank" rel="noopener noreferrer">
            <img src={gmail} alt="Gmail" className="w-8 h-8" />
          </a>
        </div>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <button onClick={() => navigate("/login")} className="font-semibold text-blue-500 hover:underline">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
