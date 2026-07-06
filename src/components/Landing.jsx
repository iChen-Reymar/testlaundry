import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Shield, CheckCircle } from "lucide-react";
import logo from "../assets/logo.png";

export default function Landing() {
  const navigate = useNavigate();

  const features = [
    { icon: Zap, label: "Fast" },
    { icon: Shield, label: "Secure" },
    { icon: CheckCircle, label: "Simple" },
  ];

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-12">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-10 sm:px-8 sm:py-12">
            <img
              src={logo}
              alt="Laundry Connect"
              className="w-40 sm:w-48 h-auto mx-auto mb-6"
            />

            <p className="text-gray-600 text-sm sm:text-base mb-8 leading-relaxed">
              Book laundry pickup, track orders, and message our team — all in one place.
            </p>

            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition flex items-center justify-center gap-2 touch-manipulation"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </button>

            <p className="mt-6 text-sm text-gray-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-blue-600 font-semibold hover:text-blue-700 transition"
              >
                Sign In
              </button>
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 sm:gap-10 mt-8">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-white border border-blue-100 flex items-center justify-center shadow-sm">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
