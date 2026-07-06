import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, MessageSquare, Send, Search, User, Info } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/apiClient.js";
import UserProfilePanel from "./UserProfilePanel";

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "staff") return "Staff";
  return "Customer";
}

function roleBadgeClass(role) {
  if (role === "admin") return "bg-red-100 text-red-700";
  if (role === "staff") return "bg-green-100 text-green-700";
  return "bg-blue-100 text-blue-700";
}

function getSenderDisplay(msg) {
  const name = (msg.sender_name || "").trim();
  const email = (msg.sender_email || "").trim();
  const role = msg.sender_role;
  const genericNames = ["admin", "staff", "user", "customer"];

  let title = name;
  if (!title || genericNames.includes(title.toLowerCase())) {
    if (msg.sender_employee_id) {
      title = msg.sender_employee_id;
    } else if (email) {
      title = email.split("@")[0];
    } else if (role === "admin") {
      title = "Admin";
    } else if (role === "staff") {
      title = "Staff";
    } else {
      title = name || "User";
    }
  }

  let subtitle = null;
  if (role === "admin") subtitle = "Admin";
  else if (role === "staff") subtitle = "Staff";

  return { title, subtitle };
}

export default function Messages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const withUserId = searchParams.get("with");

  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [loadingPartnerProfile, setLoadingPartnerProfile] = useState(false);
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const [thread, setThread] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(Boolean(withUserId));
  const threadEndRef = useRef(null);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (withUserId && contacts.length > 0 && !selectedContact) {
      const match = contacts.find((c) => c.id === withUserId);
      if (match) openChat(match);
    }
  }, [withUserId, contacts, selectedContact]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  const init = async () => {
    try {
      const { data: { session } } = await api.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      setUserId(session.user.id);
      setUserRole(session.user.role);
      await loadContacts(session.user.role);
    } catch {
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async (role) => {
    const [recipients, conversations] = await Promise.all([
      api.messages.recipients(),
      api.messages.conversations(),
    ]);

    const isCustomer = role === "customer" || role === "user";
    let merged;

    if (isCustomer) {
      // Customers always see staff and admin so they can start a chat
      const convMap = new Map((conversations || []).map((c) => [c.id, c]));
      merged = (recipients || []).map((r) => {
        const conv = convMap.get(r.id);
        return {
          ...r,
          last_message: conv?.last_message || null,
          last_message_at: conv?.last_message_at || null,
          unread_count: conv?.unread_count || 0,
        };
      });
    } else {
      // Admin/staff only see users who have already messaged (existing conversations)
      merged = (conversations || []).map((c) => ({
        ...c,
        unread_count: c.unread_count || 0,
      }));
    }

    merged.sort((a, b) => {
      if (a.unread_count !== b.unread_count) return b.unread_count - a.unread_count;
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });

    setContacts(merged);
  };

  const canViewProfile = userRole === "admin" || userRole === "staff";
  const isStaffViewOnly = userRole === "staff";

  const loadPartnerProfile = async (contactId) => {
    if (!canViewProfile) return;
    setLoadingPartnerProfile(true);
    try {
      const details = await api.users.getProfile(contactId);
      setPartnerProfile(details);
    } catch (error) {
      console.error("Failed to load partner profile:", error);
      setPartnerProfile(null);
    } finally {
      setLoadingPartnerProfile(false);
    }
  };

  const openChat = async (contact) => {
    setSelectedContact(contact);
    setMobileShowChat(true);
    setShowMobileProfile(false);
    setLoadingThread(true);
    try {
      const messages = await api.messages.thread(contact.id);
      setThread(messages || []);
      setContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, unread_count: 0 } : c))
      );
      if (canViewProfile) {
        await loadPartnerProfile(contact.id);
      }
    } catch (error) {
      alert(error.message || "Failed to load messages");
    } finally {
      setLoadingThread(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedContact || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const sent = await api.messages.send(selectedContact.id, newMessage.trim());
      const profile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      setThread((prev) => [
        ...prev,
        {
          ...sent,
          sender_id: userId,
          sender_name: profile.name || sent.sender_name,
          sender_email: profile.email || sent.sender_email,
          sender_role: profile.role || sent.sender_role,
          sender_employee_id: sent.sender_employee_id,
        },
      ]);
      setNewMessage("");
      setContacts((prev) =>
        prev.map((c) =>
          c.id === selectedContact.id
            ? {
                ...c,
                last_message: sent.message,
                last_message_at: sent.created_at,
              }
            : c
        )
      );
    } catch (error) {
      alert(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <p className="text-gray-500">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col">
      <div className="bg-blue-600 text-white px-3 sm:px-4 py-3 shadow-md">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button
            onClick={() => {
              if (mobileShowChat && selectedContact) {
                setMobileShowChat(false);
              } else {
                navigate("/dashboard");
              }
            }}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-white/20 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <h1 className="text-base sm:text-lg font-bold">Messages</h1>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)] flex">
          {/* Contact list */}
          <div
            className={`w-full sm:w-80 md:w-80 lg:w-96 border-r border-gray-100 flex flex-col shrink-0 ${
              mobileShowChat ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={canViewProfile ? "Search users..." : "Search staff or admin..."}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 text-center">
                  {canViewProfile
                    ? "No conversations yet. Users appear here after someone messages you."
                    : "No staff or admin contacts found."}
                </p>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => openChat(contact)}
                    className={`w-full text-left px-3 py-3 border-b border-gray-50 hover:bg-blue-50 transition flex gap-3 ${
                      selectedContact?.id === contact.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                      {(contact.profile_image || (partnerProfile?.id === contact.id && partnerProfile?.profile_image)) ? (
                        <img
                          src={contact.profile_image || partnerProfile?.profile_image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {contact.name || contact.email}
                        </span>
                        {contact.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {contact.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleBadgeClass(contact.role)}`}>
                          {roleLabel(contact.role)}
                        </span>
                        {contact.last_message_at && (
                          <span className="text-[10px] text-gray-400 truncate">
                            {formatTime(contact.last_message_at)}
                          </span>
                        )}
                      </div>
                      {contact.last_message && (
                        <p className="text-xs text-gray-500 truncate mt-1">{contact.last_message}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat panel */}
          <div
            className={`flex-1 flex flex-col min-w-0 ${
              mobileShowChat ? "flex" : "hidden md:flex"
            }`}
          >
            {!selectedContact ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
                <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm text-center">Select someone to start chatting</p>
              </div>
            ) : (
              <>
                <div className="px-3 sm:px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {partnerProfile?.profile_image ? (
                      <img src={partnerProfile.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm sm:text-base truncate">
                      {selectedContact.name || selectedContact.email}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleBadgeClass(selectedContact.role)}`}>
                      {roleLabel(selectedContact.role)}
                    </span>
                  </div>
                  {canViewProfile && (
                    <button
                      type="button"
                      onClick={() => setShowMobileProfile((v) => !v)}
                      className="xl:hidden p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 transition shrink-0"
                      aria-label="Toggle profile"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {canViewProfile && showMobileProfile && (
                  <div className="xl:hidden border-b border-gray-100 max-h-[45vh] overflow-y-auto shrink-0 bg-gray-50">
                    <UserProfilePanel
                      profile={partnerProfile}
                      loading={loadingPartnerProfile}
                      onClose={() => setShowMobileProfile(false)}
                      viewOnly={isStaffViewOnly}
                      compact
                    />
                  </div>
                )}

                {canViewProfile && (
                  <div className="hidden lg:flex xl:hidden border-b border-gray-100 max-h-[220px] overflow-y-auto shrink-0 bg-gray-50">
                    <UserProfilePanel
                      profile={partnerProfile}
                      loading={loadingPartnerProfile}
                      viewOnly={isStaffViewOnly}
                      compact
                    />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {loadingThread ? (
                    <p className="text-sm text-gray-500 text-center">Loading...</p>
                  ) : thread.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center">No messages yet. Say hello!</p>
                  ) : (
                    thread.map((msg) => {
                      const isMine = msg.sender_id === userId;
                      const sender = getSenderDisplay(msg);
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 ${
                              isMine
                                ? "bg-blue-600 text-white rounded-br-md"
                                : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                            }`}
                          >
                            {!isMine && (
                              <div className="mb-0.5">
                                <p className="text-[10px] font-semibold opacity-80">
                                  {sender.title}
                                </p>
                                {sender.subtitle && (
                                  <p className="text-[10px] opacity-60">{sender.subtitle}</p>
                                )}
                              </div>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                            <p
                              className={`text-[10px] mt-1 ${
                                isMine ? "text-blue-100" : "text-gray-400"
                              }`}
                            >
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </div>

                <div className="p-3 border-t border-gray-100 bg-white">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Type a message..."
                      rows={2}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="self-end px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Send</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile sidebar — admin/staff on large screens */}
          {canViewProfile && selectedContact && (
            <div className="hidden xl:flex w-72 2xl:w-80 border-l border-gray-100 flex-col shrink-0 bg-gray-50/50">
              <UserProfilePanel
                profile={partnerProfile}
                loading={loadingPartnerProfile}
                viewOnly={isStaffViewOnly}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
