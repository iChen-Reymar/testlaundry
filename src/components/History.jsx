import React, { useState, useEffect } from "react";
import { ChevronLeft, Trash2, Eye, Clock, Calendar, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    checkAuth();
    getUserProfile();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchBookings();
    }
  }, [userId]);

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

  const getUserProfile = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (userProfile && userProfile.id) {
      setUserId(userProfile.id);
      setUserRole(userProfile.role || 'user');
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      // Build query - admins see all bookings, users see only their own
      let query = supabase
        .from('bookings')
        .select(`
          *,
          services:service_id (name, price, unit),
          profiles:user_id (name, email)
        `);

      // If user is not admin, filter by their user_id
      if (userRole !== 'admin') {
        query = query.eq('user_id', userId);
      }

      const { data: allBookings, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // For regular users, filter out hidden bookings
      let filteredBookings = allBookings || [];
      if (userRole !== 'admin' && userId) {
        // Get list of hidden booking IDs for this user
        const { data: hiddenBookings } = await supabase
          .from('user_hidden_bookings')
          .select('booking_id')
          .eq('user_id', userId);
        
        const hiddenIds = new Set((hiddenBookings || []).map(h => h.booking_id));
        
        // Filter out hidden bookings
        filteredBookings = (allBookings || []).filter(booking => !hiddenIds.has(booking.id));
      }

      // Transform bookings to match the expected format
      const transformedHistory = filteredBookings.map(booking => ({
        id: booking.id,
        orderId: booking.order_id,
        paymentId: booking.payment_id || `PMT-${booking.id}`,
        date: new Date(booking.created_at).toLocaleDateString("en-US"),
        services: [{
          name: booking.services?.name || "Unknown Service",
          price: parseFloat(booking.total_price),
          quantity: booking.quantity,
          unit: booking.services?.unit || "per item"
        }],
        status: booking.status,
        payment_status: booking.payment_status,
        user_id: booking.user_id,
        customerName: booking.profiles?.name || "Unknown Customer",
        customerEmail: booking.profiles?.email || "",
        booking: booking
      }));

      setHistory(transformedHistory);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      alert("Failed to load booking history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bookingId, bookingUserId) => {
    // Check if user has permission
    if (userRole !== 'admin' && bookingUserId !== userId) {
      alert("You can only delete your own bookings.");
      return;
    }

    if (userRole === 'admin') {
      // Admins can permanently delete bookings
      const confirmMessage = "Are you sure you want to permanently delete this booking? This action cannot be undone and will remove it for all users.";
      if (!confirm(confirmMessage)) return;

      try {
        const { error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);

        if (error) {
          if (error.code === '42501' || error.message.includes('permission')) {
            alert("You don't have permission to delete this booking.");
            return;
          }
          throw error;
        }
        
        alert("Booking permanently deleted!");
        fetchBookings();
      } catch (error) {
        console.error("Error deleting booking:", error);
        alert("Failed to delete booking. Please try again.");
      }
    } else {
      // Regular users: Hide booking from their view (soft delete)
      const confirmMessage = "Are you sure you want to remove this booking from your history? Admins will still be able to see it.";
      if (!confirm(confirmMessage)) return;

      try {
        // Check if already hidden
        const { data: existing } = await supabase
          .from('user_hidden_bookings')
          .select('id')
          .eq('user_id', userId)
          .eq('booking_id', bookingId)
          .single();

        if (existing) {
          alert("This booking is already hidden from your view.");
          return;
        }

        // Hide the booking for this user
        const { error } = await supabase
          .from('user_hidden_bookings')
          .insert({
            user_id: userId,
            booking_id: bookingId
          });

        if (error) {
          if (error.code === '23505') {
            // Already hidden (unique constraint)
            alert("This booking is already hidden.");
            return;
          }
          throw error;
        }
        
        alert("Booking removed from your history!");
        // Refresh the list
        fetchBookings();
      } catch (error) {
        console.error("Error hiding booking:", error);
        alert("Failed to remove booking. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col px-3 sm:px-4 py-4 sm:py-6">
      {/* Simple Header */}
      <div className="max-w-2xl mx-auto w-full mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">Booking History</h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">View all your past orders</p>
          </div>
          {userRole === 'admin' && (
            <span className="px-2 sm:px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] sm:text-xs font-medium flex-shrink-0">
              Admin
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full space-y-2 sm:space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center border border-gray-100">
            <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-blue-500 border-t-transparent"></div>
            <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm">Loading...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center border border-gray-100">
            <Package className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium text-sm sm:text-base">No orders yet</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Start booking to see your history</p>
          </div>
        ) : (
          history.map((order) => (
            <div 
              key={order.id} 
              className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-all p-3 sm:p-4 border border-gray-100"
            >
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{order.orderId}</p>
                    <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">{order.date}</p>
                  </div>
                  <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate("/receipt", { state: order })}
                      className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="View Receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(order.id, order.user_id)}
                      className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title={userRole === 'admin' ? 'Delete (Admin)' : 'Remove from history'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {userRole === 'admin' && (
                  <p className="text-gray-600 text-[10px] sm:text-xs truncate">
                    {order.customerName} • {order.customerEmail}
                  </p>
                )}

                <p className="text-gray-700 text-xs sm:text-sm line-clamp-2">
                  {order.services
                    .map(
                      (s) =>
                        `${s.name} ${
                          s.unit === "per kg" && s.quantity ? `${s.quantity} kg` : ""
                        }`
                    )
                    .join(", ")}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">
                    ₱{order.services.reduce((sum, s) => sum + parseFloat(s.price), 0).toFixed(2)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    {order.payment_status && (
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.payment_status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
