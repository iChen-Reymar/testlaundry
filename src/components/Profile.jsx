import React, { useState, useEffect } from "react";
import { ChevronLeft, Camera, X, Trash2, User, Mail, Edit3, LogOut, Shield, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    id: null,
    name: "",
    email: "",
    image: "",
    role: "user",
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      
      const userProfile = localStorage.getItem('userProfile');
      if (!userProfile) {
        navigate("/login");
        return;
      }
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/login");
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("Auth error:", authError);
        localStorage.removeItem('userProfile');
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("Profile fetch error:", error);
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              name: '',
              role: 'user'
            })
            .select()
            .single();

          if (createError) throw createError;

          localStorage.setItem('userProfile', JSON.stringify({
            id: newProfile.id,
            email: newProfile.email,
            name: newProfile.name,
            role: newProfile.role,
            profile_image: newProfile.profile_image
          }));

          setProfile({
            id: newProfile.id,
            name: newProfile.name || "",
            email: newProfile.email || "",
            image: newProfile.profile_image || "",
            role: newProfile.role || "user",
          });

          setTempProfile({
            id: newProfile.id,
            name: newProfile.name || "",
            email: newProfile.email || "",
            image: newProfile.profile_image || "",
            role: newProfile.role || "user",
          });
          return;
        }
        throw error;
      }

      if (!data) {
        alert("Profile not found. Please login again.");
        navigate("/login");
        return;
      }

      localStorage.setItem('userProfile', JSON.stringify({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        profile_image: data.profile_image
      }));

      setProfile({
        id: data.id,
        name: data.name || "",
        email: data.email || "",
        image: data.profile_image || "",
        role: data.role || "user",
      });

      setTempProfile({
        id: data.id,
        name: data.name || "",
        email: data.email || "",
        image: data.profile_image || "",
        role: data.role || "user",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      alert("Failed to load profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setTempProfile({ ...tempProfile, [e.target.name]: e.target.value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert("Please select an image file");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB");
        return;
      }

      setSelectedFile(file);
      // Show preview
      setTempProfile({ ...tempProfile, image: URL.createObjectURL(file) });
    }
  };

  const uploadImageToSupabase = async (file, userId) => {
    try {
      setUploading(true);
      
      // Delete old image if exists
      if (profile.image && profile.image.includes('supabase')) {
        const oldImagePath = profile.image.split('/').pop();
        await supabase.storage
          .from('profile_image')
          .remove([`${userId}/${oldImagePath}`]);
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('profile_image')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile_image')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deleteProfileImage = async () => {
    if (!profile.image || !profile.image.includes('supabase')) {
      alert("No image to delete");
      return;
    }

    if (!confirm("Are you sure you want to delete your profile image?")) return;

    try {
      setUploading(true);
      
      // Extract file path from URL
      const urlParts = profile.image.split('/');
      const fileName = urlParts.pop();
      const userId = urlParts.pop();
      const filePath = `${userId}/${fileName}`;

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('profile_image')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Update database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image: null })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update local state
      setProfile({ ...profile, image: "" });
      setTempProfile({ ...tempProfile, image: "" });
      
      // Update localStorage
      const userProfile = JSON.parse(localStorage.getItem('userProfile'));
      localStorage.setItem('userProfile', JSON.stringify({
        ...userProfile,
        profile_image: null
      }));

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

      // Upload new image if file is selected
      if (selectedFile) {
        imageUrl = await uploadImageToSupabase(selectedFile, tempProfile.id);
      }

      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({
          name: tempProfile.name,
          email: tempProfile.email,
          profile_image: imageUrl || null
        })
        .eq('id', tempProfile.id);

      if (error) throw error;

      // Update localStorage
      const userProfile = JSON.parse(localStorage.getItem('userProfile'));
      localStorage.setItem('userProfile', JSON.stringify({
        ...userProfile,
        name: tempProfile.name,
        email: tempProfile.email,
        profile_image: imageUrl
      }));

      setProfile({
        ...tempProfile,
        image: imageUrl
      });
      
      setSelectedFile(null);
      setIsModalOpen(false);
      alert("Profile updated successfully!");
      
      // Refresh profile data
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
      await supabase.auth.signOut();
      localStorage.removeItem('userProfile');
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem('userProfile');
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-4 py-6">
      {/* Simple Header */}
      <div className="max-w-md mx-auto w-full mb-6">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <div className="max-w-md mx-auto w-full bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        {loading ? (
          <div className="flex flex-col items-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        ) : (
          <>
            {/* Profile Image */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                  {profile.image ? (
                    <>
                      <img src={profile.image} alt="Profile" className="w-full h-full object-cover" />
                      {profile.image.includes('supabase') && (
                        <button
                          onClick={deleteProfileImage}
                          disabled={uploading}
                          className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition text-xs"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
              </div>
              
              <div className="text-center">
                <h1 className="text-xl font-semibold text-gray-900 mb-1">
                  {profile.name || "User"}
                </h1>
                {profile.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
            </div>

            {/* Profile Details */}
            <div className="space-y-3 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-gray-900 font-medium">
                  {profile.name || "No name set"}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-gray-900 font-medium break-words">
                  {profile.email || "No email set"}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setTempProfile(profile);
                  setSelectedFile(null);
                  setIsModalOpen(true);
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>

              {profile.role === 'admin' && (
                <button
                  onClick={() => navigate("/admindashboard")}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Admin Dashboard
                </button>
              )}

              <button
                onClick={handleLogout}
                className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative border border-gray-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Edit Profile</h2>
              <p className="text-gray-600 text-sm">Update your information</p>
            </div>

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
                  className="absolute -bottom-1 -right-1 bg-blue-600 p-2 rounded-full cursor-pointer hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <Camera className="text-white w-4 h-4" />
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading || saving}
                  />
                </label>
              </div>
            </div>

            {selectedFile && (
              <p className="text-xs text-gray-500 text-center mb-2">
                Selected: {selectedFile.name}
              </p>
            )}

            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
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

            <div className="mt-6">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving || uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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