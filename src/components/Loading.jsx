Loading.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Loading() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center px-4 md:px-8">
      <div className="flex flex-col items-center text-center">
        <img
          src={logo}
          alt="Logo"
          className="w-50 md:w-64 lg:w-72 h-auto mb-50"
        />

        <button
          onClick={() => navigate("/signup")}
          className="px-16 py-3 bg-gray-400 text-black text-lg font-semibold rounded-full hover:bg-blue-500 hover:text-white transition-colors duration-200 cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}