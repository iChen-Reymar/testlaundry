import React, { useState, useEffect } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";

export default function Notifications({ userId, variant = 'light' }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const fetchNotifications = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      // Confirm deletion
      if (!window.confirm('Are you sure you want to delete this notification?')) {
        return;
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error("Delete error:", error);
        alert('Failed to delete notification. Please try again.');
        throw error;
      }
      
      fetchNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      success: 'bg-green-100 text-green-700 border-green-200',
      warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      error: 'bg-red-100 text-red-700 border-red-200',
      info: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    return colors[type] || colors.info;
  };

  if (!userId) return null;

  return (
    <div className="relative">
      {/* Notification Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-1.5 sm:p-2 rounded-lg transition touch-manipulation ${
          variant === 'dark' 
            ? 'hover:bg-white/20 active:bg-white/30' 
            : 'hover:bg-gray-100 active:bg-gray-200'
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className={`w-5 h-5 sm:w-6 sm:h-6 ${
          variant === 'dark' 
            ? 'text-white' 
            : 'text-gray-700'
        }`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent" 
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed sm:absolute right-0 left-0 sm:left-auto top-16 sm:top-auto bottom-auto sm:bottom-auto sm:mt-2 sm:mr-0 w-full sm:w-80 sm:max-w-[320px] bg-white rounded-b-2xl sm:rounded-lg shadow-xl border border-gray-200 z-50 max-h-[85vh] sm:max-h-96 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-800 text-base sm:text-lg">Notifications</h3>
              <div className="flex items-center gap-2 sm:gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded hover:bg-blue-50 transition touch-manipulation"
                  >
                    <span className="hidden sm:inline">Mark all read</span>
                    <span className="sm:hidden">Mark all</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition touch-manipulation"
                  aria-label="Close notifications"
                >
                  <X className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {notifications.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-gray-500">
                  <Bell className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm sm:text-base">No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 sm:p-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer ${
                      !notification.is_read ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => {
                      if (!notification.is_read) {
                        markAsRead(notification.id);
                      }
                      
                      // Navigate to bookings tab if it's a "New Booking Received!" notification
                      if (notification.title === 'New Booking Received!' || notification.title === 'New Booking Received') {
                        // Check if user is admin or staff
                        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                        if (userProfile?.role === 'admin' || userProfile?.role === 'staff') {
                          // Set active tab to bookings
                          sessionStorage.setItem('openTab', 'bookings');
                          // Navigate to admin dashboard
                          navigate('/admindashboard');
                          // Close notification panel
                          setIsOpen(false);
                        }
                      } else if (notification.related_booking_id) {
                        // For other booking-related notifications, navigate based on user role
                        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
                        if (userProfile?.role === 'admin' || userProfile?.role === 'staff') {
                          sessionStorage.setItem('openTab', 'bookings');
                          navigate('/admindashboard');
                          setIsOpen(false);
                        } else {
                          // For customers, go to history
                          navigate('/history');
                          setIsOpen(false);
                        }
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 sm:mb-2 flex-wrap">
                          <span className={`px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-medium whitespace-nowrap ${getTypeColor(notification.type)}`}>
                            {notification.type}
                          </span>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0"></span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-800 text-sm sm:text-base mb-1.5">
                          {notification.title}
                        </h4>
                        <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                          {(() => {
                            // Format message better - extract order ID and total if present
                            let message = notification.message;
                            
                            // Extract order ID
                            const orderMatch = message.match(/Order:\s*([A-Z0-9-]+)/i);
                            const orderId = orderMatch ? orderMatch[1] : null;
                            
                            // Extract total price
                            const totalMatch = message.match(/Total:\s*₱?([\d,]+\.?\d*)/i);
                            const total = totalMatch ? totalMatch[1] : null;
                            
                            // Clean up message - remove order ID and total from main message
                            if (orderId) {
                              message = message.replace(/\(Order:\s*[A-Z0-9-]+\)/gi, '').trim();
                            }
                            if (total) {
                              message = message.replace(/Total:\s*₱?[\d,]+\.?\d*/gi, '').trim();
                            }
                            
                            // Clean up extra spaces and punctuation
                            message = message.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim();
                            
                            return (
                              <>
                                <p className="mb-2">{message}</p>
                                {(orderId || total) && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {orderId && (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] sm:text-xs font-mono font-medium">
                                        {orderId}
                                      </span>
                                    )}
                                    {total && (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded text-[10px] sm:text-xs font-medium">
                                        ₱{total}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2">
                          {new Date(notification.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 sm:p-1.5 hover:bg-blue-100 active:bg-blue-200 rounded-lg transition touch-manipulation"
                            title="Mark as read"
                            aria-label="Mark as read"
                          >
                            <Check className="w-4 h-4 sm:w-4 sm:h-4 text-blue-600" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 sm:p-1.5 hover:bg-red-100 active:bg-red-200 rounded-lg transition touch-manipulation"
                          title="Delete"
                          aria-label="Delete notification"
                        >
                          <X className="w-4 h-4 sm:w-4 sm:h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

