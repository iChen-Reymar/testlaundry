import React, { useState, useEffect } from "react";
import { ChevronLeft, Camera, X, Trash2 } from "lucide-react";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 px-4 relative">
      <button
        onClick={() => navigate("/dashboard")}
        className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-300 transition cursor-pointer"
      >
        <ChevronLeft className="w-6 h-6 text-gray-700 hover:text-gray-900" />
      </button>

      <div className="w-full max-w-sm sm:max-w-md bg-white/70 backdrop-blur-sm shadow-md rounded-2xl p-6 flex flex-col items-center space-y-6">
        {loading ? (
          <p className="text-gray-500">Loading profile...</p>
        ) : (
          <>
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-blue-100 flex items-center justify-center">
              {profile.image ? (
                <>
                  <img src={profile.image} alt="Profile" className="w-full h-full object-cover" />
                  {profile.image.includes('supabase') && (
                    <button
                      onClick={deleteProfileImage}
                      disabled={uploading}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </>
              ) : (
                <p className="text-blue-500 font-medium text-sm">No Image</p>
              )}
            </div>

            <h1 className="text-lg sm:text-xl font-semibold text-blue-600">
              Personal Details
            </h1>

            <button
              onClick={() => {
                setTempProfile(profile);
                setSelectedFile(null);
                setIsModalOpen(true);
              }}
              className="w-75 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-full text-sm sm:text-base font-medium transition"
            >
              Edit Profile
            </button>

            <div className="w-full text-gray-800 space-y-3 text-center sm:text-left">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium text-base break-words">
                  {profile.name || "No name set"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium text-base break-words">
                  {profile.email || "No email set"}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-25 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-full text-sm sm:text-base font-medium transition mt-4"
            >
              Logout
            </button>

            {profile.role === 'admin' && (
              <button
                onClick={() => navigate("/AdminDashboard")}
                className="w-40 bg-green-500 hover:bg-green-600 text-white py-2 rounded-full text-sm sm:text-base font-medium transition mt-2"
              >
                Admin Panel
              </button>
            )}
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-11/12 max-w-sm relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-semibold text-blue-600 mb-4 text-center">
              Edit Profile
            </h2>

            <div className="flex justify-center mb-4 relative">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white flex items-center justify-center border-2 border-blue-200">
                {tempProfile.image ? (
                  <img src={tempProfile.image} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-blue-400 font-medium text-sm">No Image</p>
                )}
              </div>
              <label
                htmlFor="imageUpload"
                className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full cursor-pointer hover:bg-blue-600 transition disabled:opacity-50"
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

            {selectedFile && (
              <p className="text-xs text-gray-500 text-center mb-2">
                Selected: {selectedFile.name}
              </p>
            )}

            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <input
                  type="text"
                  name="name"
                  value={tempProfile.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-400 outline-none"
                  disabled={saving || uploading}
                />
              </div>

              <div>
                <p className="text-sm text-gray-500">Email</p>
                <input
                  type="email"
                  name="email"
                  value={tempProfile.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-gray-700 focus:ring-2 focus:ring-blue-400 outline-none"
                  disabled={saving || uploading}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="bg-blue-500 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading..." : saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}