import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Camera,
  X,
  Trash2,
  User,
  Mail,
  Edit3,
  LogOut,
  Phone,
  MapPin,
  Info,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient.js";

function MenuRow({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 sm:px-6 md:px-8 py-4 md:py-5 text-left border-b border-gray-100 hover:bg-blue-50/60 active:bg-blue-50 transition touch-manipulation ${
        danger ? "text-red-600 hover:bg-red-50/60" : "text-gray-800"
      }`}
    >
      <Icon className={`w-5 h-5 md:w-6 md:h-6 shrink-0 ${danger ? "text-red-500" : "text-blue-600"}`} />
      <span className="flex-1 text-[15px] md:text-base font-medium">{label}</span>
      <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-300 shrink-0" />
    </button>
  );
}

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    id: null,
    name: "",
    email: "",
    image: "",
    role: "user",
    phone: "",
    address: "",
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [editFocus, setEditFocus] = useState("all");
  const [tempProfile, setTempProfile] = useState(profile);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAuth();
    let isMounted = true;

    const loadProfile = async () => {
      if (!isMounted) return;
      await fetchProfile();
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await api.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const userProfile = localStorage.getItem("userProfile");
      if (!userProfile) {
        navigate("/login");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/login");
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await api.auth.getUser();

      if (!user) {
        localStorage.removeItem("userProfile");
        navigate("/login");
        return;
      }

      const data = await api.profiles.get(user.id);

      if (!data) {
        alert("Profile not found. Please login again.");
        navigate("/login");
        return;
      }

      let customerData = { phone: "", address: "" };
      if (data.role === "customer" || data.role === "user") {
        const customer = await api.customers.get(data.id);
        if (customer) {
          customerData = customer;
        }
      }

      localStorage.setItem(
        "userProfile",
        JSON.stringify({
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          profile_image: data.profile_image,
          phone: customerData.phone,
          address: customerData.address,
        })
      );

      const nextProfile = {
        id: data.id,
        name: data.name || "",
        email: data.email || "",
        image: data.profile_image || "",
        role: data.role || "user",
        phone: customerData.phone || "",
        address: customerData.address || "",
      };

      setProfile(nextProfile);
      setTempProfile(nextProfile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      alert("Failed to load profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (focus = "all") => {
    setEditFocus(focus);
    setTempProfile(profile);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    setTempProfile({ ...tempProfile, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB");
        return;
      }

      setSelectedFile(file);
      setTempProfile({ ...tempProfile, image: URL.createObjectURL(file) });
    }
  };

  const uploadProfileImage = async (file) => {
    try {
      setUploading(true);
      const { url } = await api.uploads.profile(file);
      return url;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deleteProfileImage = async () => {
    if (!profile.image) {
      alert("No image to delete");
      return;
    }

    if (!confirm("Are you sure you want to delete your profile image?")) return;

    try {
      setUploading(true);
      await api.uploads.deleteProfile();

      setProfile({ ...profile, image: "" });
      setTempProfile({ ...tempProfile, image: "" });

      const userProfile = JSON.parse(localStorage.getItem("userProfile"));
      localStorage.setItem(
        "userProfile",
        JSON.stringify({
          ...userProfile,
          profile_image: null,
        })
      );

      alert("Profile image deleted successfully!");
    } catch (error) {
      console.error("Error deleting image:", error);
      alert("Failed to delete image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!tempProfile.id) {
      alert("Profile not found. Please login again.");
      navigate("/login");
      return;
    }

    setSaving(true);
    try {
      let imageUrl = tempProfile.image;

      if (selectedFile) {
        imageUrl = await uploadProfileImage(selectedFile);
      }

      await api.profiles.update(tempProfile.id, {
        name: tempProfile.name,
        email: tempProfile.email,
        profile_image: imageUrl || null,
      });

      if (tempProfile.role === "customer" || tempProfile.role === "user") {
        try {
          await api.customers.upsert(tempProfile.id, {
            name: tempProfile.name,
            email: tempProfile.email,
            phone: tempProfile.phone || null,
            address: tempProfile.address || null,
          });
        } catch (customerError) {
          console.error("Error updating customer data:", customerError);
        }
      }

      const userProfile = JSON.parse(localStorage.getItem("userProfile"));
      localStorage.setItem(
        "userProfile",
        JSON.stringify({
          ...userProfile,
          name: tempProfile.name,
          email: tempProfile.email,
          profile_image: imageUrl,
          phone: tempProfile.phone,
          address: tempProfile.address,
        })
      );

      setProfile({
        ...tempProfile,
        image: imageUrl,
      });

      setSelectedFile(null);
      setIsModalOpen(false);
      alert("Profile updated successfully!");
      await fetchProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.auth.signOut();
      localStorage.removeItem("userProfile");
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem("userProfile");
      navigate("/login");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? All your data will be permanently removed.")) {
      return;
    }
    if (!confirm("This cannot be undone. Delete your account now?")) {
      return;
    }

    try {
      await api.profiles.delete(profile.id);
      await api.auth.signOut();
      localStorage.removeItem("userProfile");
      navigate("/login");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account. Please try again.");
    }
  };

  const handleManageAddress = () => {
    if (profile.role === "customer" || profile.role === "user") {
      openEditModal("address");
      return;
    }
    openEditModal("all");
  };

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col overflow-x-hidden">
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      ) : (
        <div className="w-full max-w-lg md:max-w-xl lg:max-w-2xl mx-auto flex-1 flex flex-col md:my-4 lg:my-8 md:rounded-2xl md:overflow-hidden md:shadow-xl md:border md:border-gray-100">
          {/* Header */}
          <div className="bg-blue-600 text-white relative pb-20 sm:pb-24 md:pb-28 pt-safe">
            <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 pt-3 sm:pt-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 -ml-2 rounded-full hover:bg-white/15 active:bg-white/25 transition touch-manipulation"
                aria-label="Back"
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
              <button
                onClick={() => openEditModal("all")}
                className="flex items-center gap-1.5 text-sm sm:text-base font-medium px-2 py-1 rounded-lg hover:bg-white/15 active:bg-white/25 transition touch-manipulation"
              >
                <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                Edit
              </button>
            </div>

            <div className="flex flex-col items-center px-4 sm:px-6 md:px-8 pt-2 pb-6 sm:pb-8">
              <div className="relative">
                <div className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden bg-white/20 border-4 border-white shadow-lg flex items-center justify-center">
                  {profile.image ? (
                    <img src={profile.image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-14 h-14 sm:w-16 sm:h-16 text-white/80" />
                  )}
                </div>
              </div>
              <h1 className="mt-4 sm:mt-5 text-xl sm:text-2xl md:text-3xl font-bold text-center">
                {profile.name || "User"}
              </h1>
              {profile.email && (
                <p className="mt-1 sm:mt-2 text-sm sm:text-base text-blue-100 text-center break-all px-2">
                  {profile.email}
                </p>
              )}
              {(profile.role === "admin" || profile.role === "staff") && (
                <span className="mt-2 px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white capitalize">
                  {profile.role}
                </span>
              )}
            </div>
          </div>

          {/* Menu list */}
          <div className="flex-1 bg-white -mt-10 sm:-mt-12 md:-mt-14 rounded-t-[28px] sm:rounded-t-[32px] relative z-10 overflow-hidden">
            <div className="pt-1 sm:pt-2 pb-8 sm:pb-10 md:pb-12">
              <MenuRow icon={MapPin} label="Manage Address" onClick={handleManageAddress} />
              <MenuRow icon={MessageCircle} label="Contact us" onClick={() => navigate("/messages")} />
              <MenuRow icon={Info} label="About Us" onClick={() => setShowAboutModal(true)} />
              <MenuRow icon={LogOut} label="Log Out" onClick={handleLogout} />
              <MenuRow icon={Trash2} label="Delete Account" onClick={handleDeleteAccount} danger />
            </div>
          </div>
        </div>
      )}

      {showAboutModal && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel sm:max-w-md p-6 relative border border-gray-200 animate-slideUp">
            <button
              onClick={() => setShowAboutModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-4">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <Info className="w-7 h-7 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">About Us</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed text-center">
              Laundry Connect makes booking laundry services easy. Schedule pickups, track orders,
              and message our team — all in one place.
            </p>
            <button
              onClick={() => setShowAboutModal(false)}
              className="w-full mt-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel sm:max-w-md p-4 sm:p-6 relative border border-gray-200 animate-slideUp max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {editFocus === "address" ? "Manage Address" : "Edit Profile"}
              </h2>
              <p className="text-gray-600 text-sm">
                {editFocus === "address" ? "Update your delivery address" : "Update your information"}
              </p>
            </div>

            {editFocus !== "address" && (
              <>
                <div className="flex justify-center mb-6 relative">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                      {tempProfile.image ? (
                        <img src={tempProfile.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-gray-400" />
                      )}
                    </div>
                    <label
                      htmlFor="imageUpload"
                      className="absolute -bottom-0.5 -right-0.5 w-7 h-7 flex items-center justify-center bg-blue-600 rounded-full cursor-pointer hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
                    >
                      <Camera className="text-white w-3.5 h-3.5" />
                      <input
                        type="file"
                        id="imageUpload"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploading || saving}
                      />
                    </label>
                    {profile.image && (
                      <button
                        type="button"
                        onClick={deleteProfileImage}
                        disabled={uploading}
                        className="absolute -top-0.5 -right-0.5 !min-w-7 !min-h-7 w-7 h-7 flex items-center justify-center p-0 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {selectedFile && (
                  <p className="text-xs text-gray-500 text-center mb-2">
                    Selected: {selectedFile.name}
                  </p>
                )}

                <div className="space-y-4 mb-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={tempProfile.name}
                      onChange={handleChange}
                      placeholder="Name"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving || uploading}
                    />
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={tempProfile.email}
                      onChange={handleChange}
                      placeholder="Email"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving || uploading}
                    />
                  </div>
                </div>
              </>
            )}

            {(tempProfile.role === "customer" || tempProfile.role === "user") && (
              <div className={`space-y-4 ${editFocus === "address" ? "" : "mb-4"}`}>
                {editFocus !== "address" && (
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      value={tempProfile.phone || ""}
                      onChange={handleChange}
                      placeholder="Phone Number (e.g., 09123456789)"
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={saving || uploading}
                    />
                  </div>
                )}

                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <textarea
                    name="address"
                    value={tempProfile.address || ""}
                    onChange={handleChange}
                    placeholder="Address"
                    rows={3}
                    autoFocus={editFocus === "address"}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={saving || uploading}
                  />
                </div>
              </div>
            )}

            {editFocus === "address" && tempProfile.role !== "customer" && tempProfile.role !== "user" && (
              <p className="text-sm text-gray-500 text-center py-4">
                Address is managed for customer accounts only.
              </p>
            )}

            <div className="mt-6">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving || uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {uploading ? "Uploading..." : "Saving..."}
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
