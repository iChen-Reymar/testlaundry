import React from "react";
import { User, Mail, Phone, MapPin, X, Shield, Sparkles } from "lucide-react";

function roleBadge(role) {
  if (role === "admin") return "bg-red-100 text-red-700";
  if (role === "staff") return "bg-green-100 text-green-700";
  return "bg-blue-100 text-blue-700";
}

export default function UserProfilePanel({ profile, loading, onClose, compact = false, viewOnly = false }) {
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center ${compact ? "p-4" : "p-8"}`}>
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`text-center text-gray-500 text-sm ${compact ? "p-4" : "p-8"}`}>
        Profile not available
      </div>
    );
  }

  const isCustomer = profile.role === "customer" || profile.role === "user";

  return (
    <div className={`flex flex-col h-full ${compact ? "" : "bg-white"}`}>
      {onClose && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">User Profile</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${compact ? "p-4" : "p-5 sm:p-6"}`}>
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-blue-100 border-4 border-blue-50 flex items-center justify-center shadow-sm">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt={profile.name || "Profile"}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-10 h-10 sm:w-12 sm:h-12 text-blue-500" />
            )}
          </div>
          <h4 className="mt-3 text-lg font-bold text-gray-900 break-words max-w-full">
            {profile.name || "No name"}
          </h4>
          <span className={`mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadge(profile.role)}`}>
            {profile.role === "user" ? "customer" : profile.role}
          </span>
          {profile.role === "staff" && profile.employee_id && (
            <span className="mt-1 text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
              {profile.employee_id}
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="min-w-0 text-left">
              <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Email</p>
              <p className="text-sm text-gray-800 break-all">{profile.email || "Not set"}</p>
            </div>
          </div>

          {(isCustomer || profile.phone) && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <Phone className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Phone</p>
                <p className="text-sm text-gray-800">{profile.phone || "Not set"}</p>
              </div>
            </div>
          )}

          {!viewOnly && (isCustomer || profile.address) && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Address</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {profile.address || "Not set"}
                </p>
              </div>
            </div>
          )}

          {!viewOnly && profile.role === "staff" && (
            <>
              {profile.department && (
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <Sparkles className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">Department</p>
                    <p className="text-sm text-gray-800 capitalize">{profile.department}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {profile.can_manage_bookings && (
                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">Manage Bookings</span>
                )}
                {profile.can_confirm_payments && (
                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg">Confirm Payments</span>
                )}
              </div>
            </>
          )}

          {!viewOnly && profile.role === "admin" && (
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
              <Shield className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="min-w-0 text-left">
                <p className="text-[10px] uppercase tracking-wide text-red-400 font-medium">Role</p>
                <p className="text-sm text-red-800">System Administrator</p>
              </div>
            </div>
          )}

          {!viewOnly && isCustomer && profile.total_bookings != null && (
            <p className="text-xs text-gray-500 text-center pt-1">
              Total bookings: {profile.total_bookings}
            </p>
          )}

          {viewOnly && (
            <p className="text-xs text-gray-400 text-center mt-2">View only — contact admin to make changes</p>
          )}
        </div>
      </div>
    </div>
  );
}
