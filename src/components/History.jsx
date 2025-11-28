import React, { useState, useEffect } from "react";
import { ChevronLeft, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    getUserProfile();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchBookings();
    }
  }, [userId]);

  const getUserProfile = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (userProfile && userProfile.id) {
      setUserId(userProfile.id);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          services:service_id (name, price, unit)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform bookings to match the expected format
      const transformedHistory = (data || []).map(booking => ({
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

  const handleDelete = async (bookingId) => {
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;
      
      // Refresh the list
      fetchBookings();
    } catch (error) {
      console.error("Error deleting booking:", error);
      alert("Failed to delete booking. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-blue-50 px-4 py-8 relative">
      <button
        onClick={() => navigate("/dashboard")}
        className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-300 transition cursor-pointer"
      >
        <ChevronLeft className="w-6 h-6 text-gray-700 hover:text-gray-900 transition" />
      </button>
      
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-500 mb-8 text-center">History</h1>

      <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 sm:p-6 space-y-4">
        {loading ? (
          <p className="text-gray-400 text-sm italic text-center">Loading...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center">No orders yet.</p>
        ) : (
          history.map((order) => (
            <div key={order.id} className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div>
                <p className="text-black font-medium text-sm sm:text-base">{order.orderId}</p>
                <p className="text-gray-500 text-xs sm:text-sm">
                  {order.services
                    .map(
                      (s) =>
                        `${s.name} ${
                          s.unit === "per kg" && s.quantity ? `${s.quantity} kg` : ""
                        } ₱${parseFloat(s.price).toFixed(2)}`
                    )
                    .join(", ")}
                </p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  order.status === 'completed' ? 'bg-green-100 text-green-700' :
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => navigate("/receipt", { state: order })}
                  className="text-blue-500 hover:text-blue-600 transition cursor-pointer"
                >
                  <Eye className="w-5 h-5" />
                </button>

                <button
                  onClick={() => handleDelete(order.id)}
                  className="text-red-500 hover:text-red-600 transition cursor-pointer"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
