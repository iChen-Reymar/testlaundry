import React, { useState, useEffect } from "react";
import { ChevronLeft, Trash2, Eye, Package, X, Calendar, Clock, XCircle, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient.js";

function StarDisplay({ rating, size = "sm" }) {
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${iconClass} ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
        />
      ))}
    </div>
  );
}

export default function History() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [ratingsMap, setRatingsMap] = useState({});
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
    getUserProfile();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchBookings();
    }
  }, [userId]);

  useEffect(() => {
    const rateOrderId = sessionStorage.getItem('rateOrderId');
    if (rateOrderId && history.length > 0) {
      const order = history.find((o) => o.baseOrderId === rateOrderId);
      if (order) {
        setSelectedOrder(order);
        setRatingScore(0);
        setRatingComment("");
      }
      sessionStorage.removeItem('rateOrderId');
    }
  }, [history]);

  useEffect(() => {
    if (selectedOrder) {
      const existing = ratingsMap[selectedOrder.baseOrderId];
      setRatingScore(existing?.rating || 0);
      setRatingComment(existing?.comment || "");
    }
  }, [selectedOrder, ratingsMap]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await api.auth.getSession();
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

  // Get base order ID (remove -1, -2, etc. suffix)
  const getBaseOrderId = (orderId) => {
    if (!orderId) return orderId;
    // Match pattern like ORD-xxx-1, ORD-xxx-2 and extract base
    const match = orderId.match(/^(ORD-[^-]+-[^-]+)-\d+$/);
    return match ? match[1] : orderId;
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const allBookings = await api.bookings.list();

      let filteredBookings = allBookings || [];
      if (userRole !== 'admin' && userId) {
        const hiddenBookings = await api.hiddenBookings.list();
        const hiddenIds = new Set((hiddenBookings || []).map(h => h.booking_id));
        filteredBookings = (allBookings || []).filter(booking => !hiddenIds.has(booking.id));
      }

      // Group bookings by base order ID
      const groupedOrders = {};
      filteredBookings.forEach(booking => {
        const baseOrderId = getBaseOrderId(booking.order_id);
        
        if (!groupedOrders[baseOrderId]) {
          groupedOrders[baseOrderId] = {
            baseOrderId,
            date: new Date(booking.created_at).toLocaleDateString("en-US"),
            pickupDate: booking.pickup_date,
            pickupTime: booking.pickup_time,
            status: booking.status,
            payment_status: booking.payment_status,
            user_id: booking.user_id,
            customerName: booking.profiles?.name || "Unknown Customer",
            customerEmail: booking.profiles?.email || "",
            services: [],
            bookingIds: [],
            totalPrice: 0,
            created_at: booking.created_at
          };
        }
        
        groupedOrders[baseOrderId].services.push({
          id: booking.id,
          name: booking.services?.name || "Unknown Service",
          price: parseFloat(booking.total_price) || 0,
          quantity: booking.quantity || 1,
          actual_weight: booking.actual_weight,
          pricePerUnit: parseFloat(booking.services?.price) || 0,
          unit: booking.services?.unit || "per item"
        });
        
        groupedOrders[baseOrderId].bookingIds.push(booking.id);
        groupedOrders[baseOrderId].totalPrice += parseFloat(booking.total_price) || 0;
        
        // Use the most recent status
        if (new Date(booking.created_at) > new Date(groupedOrders[baseOrderId].created_at)) {
          groupedOrders[baseOrderId].status = booking.status;
          groupedOrders[baseOrderId].payment_status = booking.payment_status;
        }
      });

      // Convert to array and sort by date
      const ordersArray = Object.values(groupedOrders).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );

      const ratings = await api.ratings.list().catch(() => []);
      const map = {};
      (ratings || []).forEach((r) => {
        map[r.order_id] = r;
      });
      setRatingsMap(map);

      setHistory(ordersArray);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      alert("Failed to load booking history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (order) => {
    if (userRole !== 'admin' && order.user_id !== userId) {
      alert("You can only delete your own bookings.");
      return;
    }

    const serviceCount = order.services.length;
    const confirmMessage = userRole === 'admin'
      ? `Are you sure you want to permanently delete this order with ${serviceCount} service(s)? This action cannot be undone.`
      : `Are you sure you want to remove this order with ${serviceCount} service(s) from your history?`;
    
    if (!confirm(confirmMessage)) return;

    try {
      if (userRole === 'admin') {
        // Delete all bookings in this order
        for (const bookingId of order.bookingIds) {
          await api.bookings.delete(bookingId);
        }
        alert("Order permanently deleted!");
      } else {
        // Hide all bookings in this order for the user
        for (const bookingId of order.bookingIds) {
          await api.hiddenBookings.hide(bookingId);
        }
        alert("Order removed from your history!");
      }
      
      setSelectedOrder(null);
      fetchBookings();
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("Failed to delete order. Please try again.");
    }
  };

  const handleCancelBooking = async (order) => {
    if (order.status === 'completed' || order.status === 'cancelled') {
      alert("This booking cannot be cancelled.");
      return;
    }

    if (order.payment_status === 'paid') {
      alert("This booking has been paid. Please contact support to cancel.");
      return;
    }

    const serviceCount = order.services.length;
    if (!confirm(`Are you sure you want to cancel this booking with ${serviceCount} service(s)? This will notify the staff.`)) return;

    try {
      // Update all bookings in this order to cancelled
      for (const bookingId of order.bookingIds) {
        await api.bookings.cancel(bookingId);
      }

      const staffAndAdmins = await api.profiles.byRole(['admin', 'staff']);

      if (staffAndAdmins && staffAndAdmins.length > 0) {
        const notifications = staffAndAdmins.map(user => ({
          user_id: user.id,
          title: 'Booking Cancelled by Customer',
          message: `${order.customerName || 'Customer'} cancelled order ${order.baseOrderId}. Services: ${order.services.map(s => s.name).join(', ')}. Total: ₱${order.totalPrice.toFixed(2)}`,
          type: 'warning'
        }));
        await api.notifications.create(notifications);
      }

      alert("Booking cancelled successfully. Staff has been notified.");
      setSelectedOrder(null);
      fetchBookings();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Failed to cancel booking. Please try again.");
    }
  };

  const handleSubmitRating = async () => {
    if (!selectedOrder || ratingScore < 1) {
      alert("Please select a star rating (1–5).");
      return;
    }

    setRatingSubmitting(true);
    try {
      const rating = await api.ratings.submit({
        order_id: selectedOrder.baseOrderId,
        rating: ratingScore,
        comment: ratingComment.trim() || undefined,
      });
      setRatingsMap((prev) => ({ ...prev, [selectedOrder.baseOrderId]: rating }));
      alert("Thank you for your rating!");
    } catch (error) {
      console.error("Rating error:", error);
      alert(error.message || "Failed to submit rating.");
    } finally {
      setRatingSubmitting(false);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hourStr, min] = timeStr.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-x-hidden">
      <div className="page-container py-4 sm:py-6 flex-1 w-full max-w-3xl mx-auto">
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

      {/* Order List */}
      <div className="space-y-2 sm:space-y-3 pb-6 safe-area-bottom">
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
              key={order.baseOrderId} 
              onClick={() => setSelectedOrder(order)}
              className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-all p-3 sm:p-4 border border-gray-100 cursor-pointer"
            >
              <div className="flex flex-col gap-2 sm:gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{order.baseOrderId}</p>
                    <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">{order.date}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {order.services.length > 1 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs font-medium">
                        {order.services.length} services
                      </span>
                    )}
                  </div>
                </div>

                {userRole === 'admin' && (
                  <p className="text-gray-600 text-[10px] sm:text-xs truncate">
                    {order.customerName} • {order.customerEmail}
                  </p>
                )}

                <p className="text-gray-700 text-xs sm:text-sm line-clamp-1">
                  {order.services.map(s => s.name).join(", ")}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">
                    ₱{order.totalPrice.toFixed(2)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    {ratingsMap[order.baseOrderId] && (
                      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-50 rounded">
                        <StarDisplay rating={ratingsMap[order.baseOrderId].rating} />
                        <span className="text-[10px] sm:text-xs text-yellow-700 font-medium">
                          {ratingsMap[order.baseOrderId].rating}/5
                        </span>
                      </div>
                    )}
                    {order.status === 'completed' && !ratingsMap[order.baseOrderId] && userRole !== 'admin' && userRole !== 'staff' && (
                      <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-amber-100 text-amber-700 rounded text-[10px] sm:text-xs font-medium">
                        Rate me
                      </span>
                    )}
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-700' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status?.replace('_', ' ') || 'pending'}
                    </span>
                    <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium ${
                      order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.payment_status || 'unpaid'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel sm:max-w-md animate-slideUp overflow-hidden">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white p-4 sm:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Order Details</h2>
                  <p className="text-blue-100 text-xs sm:text-sm mt-1 font-mono">{selectedOrder.baseOrderId}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 overflow-y-auto max-h-[60vh]">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-[10px] text-gray-400">Pickup Date</p>
                    <p className="text-xs sm:text-sm font-medium">{formatDate(selectedOrder.pickupDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-[10px] text-gray-400">Pickup Time</p>
                    <p className="text-xs sm:text-sm font-medium">{formatTime(selectedOrder.pickupTime)}</p>
                  </div>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedOrder.status === 'completed' ? 'bg-green-100 text-green-700' :
                  selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  selectedOrder.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedOrder.status?.replace('_', ' ') || 'pending'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {selectedOrder.payment_status || 'unpaid'}
                </span>
              </div>

              {userRole === 'admin' && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{selectedOrder.customerName}</p>
                  <p className="text-xs text-gray-600">{selectedOrder.customerEmail}</p>
                </div>
              )}

              {/* Services List */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Services ({selectedOrder.services.length})
                </h3>
                <div className="space-y-2">
                  {selectedOrder.services.map((service, index) => {
                    const weight = service.actual_weight || service.quantity || 1;
                    const unit = service.unit || 'per kg';
                    const pricePerUnit = service.pricePerUnit || 0;
                    const hasWeighed = !!service.actual_weight;
                    
                    return (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{service.name}</p>
                        <p className="text-xs text-gray-500">
                          {hasWeighed ? (
                            <span className="flex items-center gap-1">
                              <span className="text-amber-600 font-medium">{weight} {unit.replace('per ', '')}</span>
                              <span>× ₱{pricePerUnit.toFixed(2)}</span>
                            </span>
                          ) : (
                            <span>{service.quantity} {unit}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">₱{service.price.toFixed(2)}</p>
                        {hasWeighed && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">weighed</span>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 mt-4 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-gray-600 font-medium">Total Amount</p>
                  <p className="text-xl font-bold text-blue-600">₱{selectedOrder.totalPrice.toFixed(2)}</p>
                </div>
              </div>

              {/* Rating Section */}
              {selectedOrder.status === 'completed' && (
                <div className="border-t border-gray-200 mt-4 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Service Rating</h3>
                  {ratingsMap[selectedOrder.baseOrderId] ? (
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
                      <div className="flex items-center gap-2 mb-1">
                        <StarDisplay rating={ratingsMap[selectedOrder.baseOrderId].rating} size="md" />
                        <span className="text-sm font-semibold text-yellow-800">
                          {ratingsMap[selectedOrder.baseOrderId].rating} out of 5
                        </span>
                      </div>
                      {ratingsMap[selectedOrder.baseOrderId].comment && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          "{ratingsMap[selectedOrder.baseOrderId].comment}"
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2">
                        Rated on {new Date(ratingsMap[selectedOrder.baseOrderId].created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ) : userRole !== 'admin' && userRole !== 'staff' ? (
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="text-sm text-gray-700 mb-3">How was your experience? Tap a star to rate.</p>
                      <div className="flex items-center gap-1 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingScore(star)}
                            disabled={ratingSubmitting}
                            className="p-1 hover:scale-110 transition disabled:opacity-50"
                          >
                            <Star
                              className={`w-8 h-8 ${
                                star <= ratingScore
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300 hover:text-yellow-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Optional comment..."
                        rows={2}
                        disabled={ratingSubmitting}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none mb-3"
                      />
                      <button
                        onClick={handleSubmitRating}
                        disabled={ratingSubmitting || ratingScore < 1}
                        className="w-full py-2.5 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {ratingSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Star className="w-4 h-4" />
                            Submit Rating
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No rating submitted yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 p-4 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigate("/receipt", { 
                      state: {
                        orderId: selectedOrder.baseOrderId,
                        services: selectedOrder.services,
                        date: selectedOrder.date,
                        status: selectedOrder.status,
                        payment_status: selectedOrder.payment_status,
                        booking: {
                          pickup_date: selectedOrder.pickupDate,
                          pickup_time: selectedOrder.pickupTime
                        }
                      }
                    });
                  }}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Receipt
                </button>
                <button
                  onClick={() => handleDelete(selectedOrder)}
                  className="py-2.5 px-4 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition"
                  title="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {/* Cancel Booking Button - Only for pending/confirmed and unpaid */}
              {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && selectedOrder.payment_status !== 'paid' && (
                <button
                  onClick={() => handleCancelBooking(selectedOrder)}
                  className="w-full py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel Booking
                </button>
              )}
              
              {selectedOrder.status === 'cancelled' && (
                <p className="text-center text-sm text-red-600 font-medium">This booking has been cancelled</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
