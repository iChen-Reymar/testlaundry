import React, { useState, useEffect } from "react";
import { ChevronLeft, Users, Package, ShoppingCart, TrendingUp, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, CreditCard, Calendar, ChevronRight, ChevronLeft as ChevronLeftIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";
import Notifications from "./Notifications";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('user');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingsByDate, setBookingsByDate] = useState({});

  // Check if user is admin
  useEffect(() => {
    checkAuth();
    checkAdmin();
    if (activeTab === "overview") fetchStats();
    if (activeTab === "bookings") {
      fetchBookings();
      setSelectedDate(null); // Reset date filter when switching to bookings tab
    }
    if (activeTab === "users") fetchUsers();
    if (activeTab === "services") fetchServices();
  }, [activeTab]);

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

  const checkAdmin = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (!userProfile) {
      navigate("/dashboard");
      return;
    }
    setCurrentUserRole(userProfile.role || 'user');
    setUserId(userProfile.id || null);
    // Allow both admin and staff to access, but with different permissions
    if (userProfile.role !== 'admin' && userProfile.role !== 'staff') {
      alert("Access denied. Admin or Staff only.");
      navigate("/dashboard");
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total bookings
      const { data: allBookings } = await supabase
        .from('bookings')
        .select('total_price, status');

      // Calculate stats
      const totalRevenue = allBookings?.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0) || 0;
      const pendingOrders = allBookings?.filter(b => b.status === 'pending').length || 0;

      setStats({
        totalUsers: userCount || 0,
        totalBookings: allBookings?.length || 0,
        totalRevenue: totalRevenue.toFixed(2),
        pendingOrders
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      alert("Failed to load statistics. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async (filterDate = null) => {
    setLoading(true);
    try {
      // First, fetch all bookings to populate calendar
      const { data: allBookings, error: allError } = await supabase
        .from('bookings')
        .select('pickup_date')
        .not('pickup_date', 'is', null);
      
      if (allError) throw allError;
      
      // Group all bookings by pickup date for calendar
      const grouped = {};
      (allBookings || []).forEach(booking => {
        if (booking.pickup_date) {
          const dateKey = booking.pickup_date;
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(booking);
        }
      });
      setBookingsByDate(grouped);
      
      // Now fetch detailed bookings (filtered by date if provided)
      let query = supabase
        .from('bookings')
        .select(`
          *,
          profiles:user_id (name, email),
          services:service_id (name, price, unit)
        `);
      
      if (filterDate) {
        query = query.eq('pickup_date', filterDate);
      }
      
      const { data, error } = await query
        .order('pickup_date', { ascending: true })
        .order('pickup_time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      alert("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      alert("Failed to load services. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;
      
      alert(`Booking status updated to ${newStatus}`);
      fetchBookings();
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Failed to update booking status");
    }
  };

  const confirmPayment = async (bookingId) => {
    if (!confirm("Confirm payment for this booking? This will mark the payment as paid and the user will see this update in their history.")) return;
    
    try {
      const paymentId = `PMT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Get current user info for staff confirmation
      const userProfile = JSON.parse(localStorage.getItem('userProfile'));
      const confirmedBy = userProfile?.name || userProfile?.email || 'Staff';
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          payment_status: 'paid',
          payment_id: paymentId,
          payment_method: `Confirmed by ${confirmedBy}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;
      
      alert("Payment confirmed successfully! The user will see this update in their history.");
      fetchBookings();
      
      // Update selected booking if it's the same one
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ 
          ...selectedBooking, 
          payment_status: 'paid',
          payment_id: paymentId,
          payment_method: `Confirmed by ${confirmedBy}`
        });
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      alert("Failed to confirm payment. Please try again.");
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    // Only admins can delete users
    if (currentUserRole !== 'admin') {
      alert("Only admins can delete users");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      alert("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const promoteToStaff = async (userId) => {
    if (!confirm("Promote this user to staff? Staff can manage bookings and view all orders.")) return;
    
    // Only admins can promote users
    if (currentUserRole !== 'admin') {
      alert("Only admins can promote users to staff");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'staff' })
        .eq('id', userId);

      if (error) throw error;
      
      alert("User promoted to staff successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error promoting user:", error);
      alert("Failed to promote user");
    }
  };

  const demoteToUser = async (userId) => {
    if (!confirm("Demote this staff member to regular user?")) return;
    
    // Only admins can demote staff
    if (currentUserRole !== 'admin') {
      alert("Only admins can demote staff");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'user' })
        .eq('id', userId);

      if (error) throw error;
      
      alert("Staff demoted to user successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error demoting staff:", error);
      alert("Failed to demote staff");
    }
  };

  const toggleServiceStatus = async (serviceId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus })
        .eq('id', serviceId);

      if (error) throw error;
      
      alert(`Service ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchServices();
    } catch (error) {
      console.error("Error updating service:", error);
      alert("Failed to update service");
    }
  };

  const generateReceiptText = (b) => {
    const lines = [];
    lines.push('Laundry Connect - Receipt');
    lines.push('---------------------------------');
    lines.push(`Order ID: ${b.order_id}`);
    if (b.payment_id) {
      lines.push(`Payment ID: ${b.payment_id}`);
    }
    lines.push(`Customer: ${b.profiles?.name || 'N/A'}`);
    lines.push(`Email: ${b.profiles?.email || 'N/A'}`);
    lines.push(`Service: ${b.services?.name || 'N/A'}`);
    lines.push(`Quantity: ${b.quantity || 1}`);
    lines.push(`Pickup: ${formatDate(b.pickup_date)} ${formatTime(b.pickup_time)}`);
    lines.push(`Payment Method: ${b.payment_method || 'N/A'}`);
    if (b.payment_status) {
      lines.push(`Payment Status: ${b.payment_status}`);
    }
    lines.push(`Status: ${b.status}`);
    lines.push('');
    lines.push(`Total: ₱${b.total_price}`);
    lines.push('');
    lines.push('Thank you for choosing Laundry Connect.');
    return lines.join('\n');
  };

  const downloadReceipt = (booking) => {
    if (!booking) return;
    const text = generateReceiptText(booking);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${booking.order_id || 'receipt'}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hourStr, min] = timeStr.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-blue-100 text-blue-700",
      in_progress: "bg-purple-100 text-purple-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus) => {
    if (!paymentStatus) return null;
    const colors = {
      paid: "bg-green-100 text-green-700",
      unpaid: "bg-orange-100 text-orange-700",
      refunded: "bg-gray-100 text-gray-700"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[paymentStatus] || "bg-gray-100 text-gray-700"}`}>
        {paymentStatus}
      </span>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col relative">
      {/* Header */}
      <div className="bg-white shadow-sm px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button onClick={() => navigate("/dashboard")} className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer touch-manipulation flex-shrink-0">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
          </button>
          <h1 className="text-base sm:text-xl md:text-2xl font-bold text-blue-500 truncate">
            <span className="hidden sm:inline">
              {currentUserRole === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard'}
            </span>
            <span className="sm:hidden">
              {currentUserRole === 'admin' ? 'Admin' : 'Staff'}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {userId && <Notifications userId={userId} />}
          {currentUserRole === 'staff' && (
            <span className="hidden sm:inline px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Staff Mode
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm px-4 py-3 flex gap-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", roles: ['admin', 'staff'] },
          { id: "bookings", label: "Bookings", roles: ['admin', 'staff'] },
          { id: "users", label: "Users", roles: ['admin'] },
          { id: "services", label: "Services", roles: ['admin', 'staff'] }
        ].filter(tab => tab.roles.includes(currentUserRole)).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full font-medium text-sm transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-blue-500 text-lg">Loading...</div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-blue-500" />
                  <StatCard icon={ShoppingCart} label="Total Bookings" value={stats.totalBookings} color="bg-purple-500" />
                  <StatCard icon={TrendingUp} label="Total Revenue" value={`₱${stats.totalRevenue}`} color="bg-green-500" />
                  <StatCard icon={Clock} label="Pending Orders" value={stats.pendingOrders} color="bg-yellow-500" />
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === "bookings" && (
              <div className="space-y-6">
                {/* Calendar View */}
                <div className="bg-white rounded-2xl p-4 shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      Booking Calendar
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
                      </button>
                      <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
                        {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                      {selectedDate && (
                        <button
                          onClick={() => {
                            setSelectedDate(null);
                            fetchBookings(null);
                          }}
                          className="ml-2 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          Clear Filter
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const year = currentMonth.getFullYear();
                      const month = currentMonth.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const daysInMonth = lastDay.getDate();
                      const startingDayOfWeek = firstDay.getDay();
                      
                      const days = [];
                      
                      // Empty cells for days before the first day of the month
                      for (let i = 0; i < startingDayOfWeek; i++) {
                        days.push(null);
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dateBookings = bookingsByDate[dateStr] || [];
                        const isSelected = selectedDate === dateStr;
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        
                        days.push(
                          <button
                            key={day}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              fetchBookings(dateStr);
                            }}
                            className={`relative p-2 rounded-lg transition text-sm font-medium ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : isToday
                                ? 'bg-blue-100 text-blue-700'
                                : dateBookings.length > 0
                                ? 'bg-green-50 text-gray-700 hover:bg-green-100'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                            {dateBookings.length > 0 && (
                              <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-green-500'
                              }`}></span>
                            )}
                            {dateBookings.length > 0 && (
                              <span className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 text-[8px] ${
                                isSelected ? 'text-white' : 'text-green-600 font-bold'
                              }`}>
                                {dateBookings.length}
                              </span>
                            )}
                          </button>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>
                  
                  {selectedDate && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Showing bookings for: <strong>{new Date(selectedDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</strong>
                      </p>
                    </div>
                  )}
                </div>

                {/* Bookings List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedDate ? `Bookings for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'All Bookings'}
                  </h3>
                  {bookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No bookings {selectedDate ? 'for this date' : 'yet'}</p>
                  ) : (
                    bookings.map(booking => (
                      <div key={booking.id} className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-semibold text-gray-800">{booking.order_id}</p>
                              {getStatusBadge(booking.status)}
                              {getPaymentStatusBadge(booking.payment_status)}
                            </div>
                            <p className="text-sm text-gray-600">Customer: {booking.profiles?.name || "N/A"}</p>
                            <p className="text-sm text-gray-600">Service: {booking.services?.name || "N/A"}</p>
                            <p className="text-sm text-gray-600">
                              Pickup: {formatDate(booking.pickup_date)} at {formatTime(booking.pickup_time)}
                            </p>
                            <p className="text-sm font-medium text-gray-800 mt-1">Total: ₱{booking.total_price}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {/* Staff: Confirm Payment Button */}
                            {(currentUserRole === 'staff' || currentUserRole === 'admin') && booking.payment_status === 'unpaid' && (
                              <button
                                onClick={() => confirmPayment(booking.id)}
                                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition cursor-pointer flex items-center gap-1 text-sm font-medium"
                                title="Confirm Payment"
                              >
                                <CreditCard className="w-4 h-4" />
                                <span>Pay</span>
                              </button>
                            )}
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                                title="Confirm Booking"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'in_progress')}
                                className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition cursor-pointer"
                                title="Start Processing"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'in_progress' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'completed')}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                                title="Mark as Completed"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="space-y-4">
                {currentUserRole === 'admin' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Admin Actions:</strong> You can promote users to staff or demote staff to users. 
                      Only admins can delete users.
                    </p>
                  </div>
                )}
                {users.length === 0 ? (
                  <p className="text-center text-gray-500">No users yet</p>
                ) : (
                  users.map(user => (
                    <div key={user.id} className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{user.name || "No name"}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === 'admin' ? 'bg-red-100 text-red-700' : 
                              user.role === 'staff' ? 'bg-green-100 text-green-700' : 
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role}
                            </span>
                            {user.role === 'staff' && (
                              <span className="text-xs text-gray-500">Can manage bookings</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {currentUserRole === 'admin' && (
                            <>
                              {user.role === 'user' && (
                                <button
                                  onClick={() => promoteToStaff(user.id)}
                                  className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                                  title="Promote to Staff"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              {user.role === 'staff' && (
                                <button
                                  onClick={() => demoteToUser(user.id)}
                                  className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition cursor-pointer"
                                  title="Demote to User"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Services Tab */}
            {activeTab === "services" && (
              <div className="space-y-4">
                {currentUserRole !== 'admin' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Staff View:</strong> You can view services but only admins can manage them.
                    </p>
                  </div>
                )}
                {services.length === 0 ? (
                  <p className="text-center text-gray-500">No services yet</p>
                ) : (
                  services.map(service => (
                    <div key={service.id} className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{service.name}</p>
                          <p className="text-sm text-gray-600">{service.description}</p>
                          <p className="text-sm font-medium text-gray-800 mt-1">₱{service.price} {service.unit}</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                            service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {service.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        {currentUserRole === 'admin' && (
                          <button
                            onClick={() => toggleServiceStatus(service.id, service.is_active)}
                            className={`p-2 rounded-lg transition cursor-pointer ${
                              service.is_active 
                                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                          >
                            {service.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h2 className="text-xl font-bold text-blue-500 mb-4">Booking Details</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <p className="text-gray-500">Order ID:</p>
                <p className="font-semibold">{selectedBooking?.order_id || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Customer:</p>
                <p className="font-semibold">{selectedBooking?.profiles?.name || selectedBooking?.profiles?.email || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Email:</p>
                <p className="font-semibold text-sm">{selectedBooking?.profiles?.email || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Service:</p>
                <p className="font-semibold">{selectedBooking?.services?.name || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Quantity:</p>
                <p className="font-semibold">{selectedBooking?.quantity || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Date:</p>
                <p className="font-semibold">{selectedBooking?.pickup_date ? formatDate(selectedBooking.pickup_date) : "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Time:</p>
                <p className="font-semibold">{selectedBooking?.pickup_time ? formatTime(selectedBooking.pickup_time) : "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Payment Method:</p>
                <p className="font-semibold">{selectedBooking?.payment_method || "N/A"}</p>
              </div>
              {selectedBooking?.payment_id && (
                <div className="flex justify-between">
                  <p className="text-gray-500">Payment ID:</p>
                  <p className="font-semibold">{selectedBooking.payment_id}</p>
                </div>
              )}
              <div className="flex justify-between">
                <p className="text-gray-500">Payment Status:</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedBooking?.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                  selectedBooking?.payment_status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedBooking?.payment_status || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Status:</p>
                {getStatusBadge(selectedBooking?.status)}
              </div>
              <div className="flex justify-between border-t pt-3">
                <p className="text-gray-500 font-medium">Total:</p>
                <p className="font-semibold text-lg">₱{selectedBooking?.total_price || "0.00"}</p>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                {selectedBooking?.payment_status === 'unpaid' && (
                  <button
                    onClick={() => selectedBooking?.id && confirmPayment(selectedBooking.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Confirm Payment
                  </button>
                )}
                <button
                  onClick={() => selectedBooking && downloadReceipt(selectedBooking)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Download Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}