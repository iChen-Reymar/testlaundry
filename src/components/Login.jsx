import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import facebook from "../assets/facebook.png";
import gmail from "../assets/gmail.png";

export default function Login() {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleLogin = () => {
    console.log("Login:", loginData);
    navigate("/dashboard"); // ⬅️ Redirect to dashboard
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

        <h1 className="text-3xl font-bold text-center text-black mb-1">
          Log In
        </h1>
        <p className="text-center text-gray-500 mb-6">
          Enter your details to continue
        </p>

        <div className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={loginData.email}
            onChange={handleChange}
            className="w-full px-5 py-3 border-2 border-gray-300 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={loginData.password}
            onChange={handleChange}
            className="w-full px-5 py-3 border-2 border-gray-300 rounded-full text-base focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
          />
        </div>

        <div className="flex justify-center pt-6">
          <button
            onClick={handleLogin}
            className="w-50 py-3 bg-gray-400 text-black text-lg rounded-full font-semibold hover:bg-blue-500 hover:text-white transition-colors cursor-pointer"
          >
            Log In
          </button>
        </div>

        <p className="text-center text-gray-500 text-sm my-4">
          Or log in with
        </p>
        <div className="flex justify-center gap-8 mb-4">
          <a
            href="https://www.facebook.com/login.php"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center hover:scale-105 transition-transform"
          >
            <img src={facebook} alt="Facebook" className="w-8 h-8" />
          </a>
          <a
            href="https://accounts.google.com/signin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center hover:scale-105 transition-transform"
          >
            <img src={gmail} alt="Gmail" className="w-8 h-8" />
          </a>
        </div>

        <p className="text-center text-sm text-gray-600">
          Don’t have an account?{" "}
          <button
            onClick={() => navigate("/signup")}
            className="font-semibold text-blue-500 hover:underline"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
