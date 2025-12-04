import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import logo from "../assets/logo.png";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center px-4 md:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      
      <div className="flex flex-col items-center text-center relative z-10 max-w-2xl">
        
        {/* Logo */}
        <div className="mb-8 transform hover:scale-105 transition-transform duration-300">
          <img
            src={logo}
            alt="Logo"
            className="w-48 md:w-64 lg:w-72 h-auto drop-shadow-lg"
          />
        </div>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-700 mb-10 max-w-xl leading-relaxed">
          “Effortlessly manage your laundry service.”
        </p>

        {/* Get Started Button with ArrowRight */}
        <button
          onClick={() => navigate("/signup")}
          className="w-50 max-w-sm px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-lg font-semibold rounded-2xl 
                     shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-blue-700 
                     transform hover:-translate-y-0.5 transition-all duration-200 cursor-pointer
                     focus:outline-none focus:ring-4 focus:ring-blue-300 flex items-center justify-center gap-2"
        >
          Get Started
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>

        {/* Sign In */}
        <div className="mt-8 text-sm">
          <span className="text-gray-600">Already have an account?</span>{" "}
          <button
            onClick={() => navigate("/login")}
            className="font-semibold text-blue-600 hover:text-blue-700 transition-colors duration-200 cursor-pointer
                       border-b-2 border-transparent hover:border-blue-600"
          >
            Sign In
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="mt-12 grid grid-cols-3 gap-6 text-center max-w-lg">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Fast</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Secure</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium">Simple</span>
          </div>
        </div>
      </div>
    </div>
  );
}
