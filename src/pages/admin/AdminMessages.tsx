import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Search,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Send,
  Loader2,
  Filter,
  ExternalLink,
  User,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';

interface Conversation {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  subject: string;
  status: 'OPEN' | 'PENDING_ADMIN' | 'REPLIED' | 'RESOLVED';
  last_message_preview: string | null;
  last_message_at: string;
  created_at: string;
}

interface MessageItem {
  id: string;
  conversation_id: string;
  sender_type: 'CUSTOMER' | 'ADMIN' | 'BOT';
  sender_name: string;
  message_text: string;
  created_at: string;
}

export default function AdminMessages() {
  const { settings, updateSettings } = useStoreSettings();
  const { showNotification } = useNotification();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ADMIN' | 'OPEN' | 'RESOLVED'>('ALL');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assistance_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        setConversations(data);
        if (data.length > 0 && !selectedConv) {
          setSelectedConv(data[0]);
        }
      }
    } catch (err: any) {
      console.warn('Fetch conversations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when selected conversation changes
  useEffect(() => {
    if (!selectedConv) return;
    setLoadingMessages(true);

    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from('assistance_messages')
          .select('*')
          .eq('conversation_id', selectedConv?.id)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(data);
        }
      } catch (err: any) {
        console.warn('Load messages error:', err);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();

    // Subscribe to new incoming messages for the active conversation
    const channel = supabase
      .channel(`admin_chat:${selectedConv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assistance_messages',
          filter: `conversation_id=eq.${selectedConv.id}`,
        },
        (payload) => {
          const newMsg = payload.new as MessageItem;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || isSending) return;

    setIsSending(true);
    const text = replyText.trim();
    const tempMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConv.id,
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempMsg]);
    setReplyText('');

    try {
      await supabase.from('assistance_messages').insert({
        conversation_id: selectedConv.id,
        sender_type: 'ADMIN',
        sender_name: 'Studio Artisan',
        message_text: text,
      });

      await supabase
        .from('assistance_conversations')
        .update({
          status: 'REPLIED',
          last_message_preview: `Artisan: ${text}`,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', selectedConv.id);

      setSelectedConv((prev) => (prev ? { ...prev, status: 'REPLIED' } : null));
      showNotification('Reply delivered to customer chat!', 'success');
      await fetchConversations();
    } catch (err: any) {
      showNotification('Failed to send reply: ' + err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleResolve = async (convId: string) => {
    try {
      await supabase
        .from('assistance_conversations')
        .update({ status: 'RESOLVED' })
        .eq('id', convId);

      setSelectedConv((prev) => (prev ? { ...prev, status: 'RESOLVED' } : null));
      showNotification('Conversation marked as resolved.', 'success');
      await fetchConversations();
    } catch (err: any) {
      showNotification('Error resolving conversation', 'error');
    }
  };

  const handleToggleChannelMode = async () => {
    const nextMode = settings.conciergeChannelMode === 'WHATSAPP' ? 'IN_SYSTEM' : 'WHATSAPP';
    const result = await updateSettings({ conciergeChannelMode: nextMode });
    if (result.success) {
      showNotification(
        `Concierge Mode switched to: ${
          nextMode === 'IN_SYSTEM' ? 'In-System Live Assistant' : 'Direct WhatsApp'
        }!`,
        'success'
      );
    }
  };

  // Open direct WhatsApp chat with this customer
  const openWhatsAppForCustomer = (conv: Conversation) => {
    const cleanPhone = (conv.customer_phone || '').replace(/\D/g, '').slice(-10);
    const text = `🌸 *The Petal & Bloom Studio Assistance*\n\nHello ${conv.customer_name},\nWe are following up regarding your enquiry: "${conv.subject}".\nHow may we help you further? ✨`;
    if (cleanPhone) {
      window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const matchesFilter =
      statusFilter === 'ALL' ? true : c.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.customer_name.toLowerCase().includes(q) ||
      (c.customer_phone && c.customer_phone.includes(q)) ||
      (c.customer_email && c.customer_email.toLowerCase().includes(q)) ||
      (c.subject && c.subject.toLowerCase().includes(q));

    return matchesFilter && matchesSearch;
  });

  return (
    <AdminLayout activePage="settings">
      <main className="p-6 lg:p-10 max-w-7xl mx-auto">
        {/* Header & Mode Switcher */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-rose font-medium mb-1">
              Customer Support &amp; Concierge
            </p>
            <h1 className="heading-serif text-4xl text-bark">Live Assistance Inbox</h1>
            <p className="text-xs text-ink-light mt-1">
              Manage in-system live customer chats and seamlessly coordinate via WhatsApp.
            </p>
          </div>

          {/* Concierge Mode Quick Toggle Button */}
          <div className="flex items-center gap-3 bg-linen p-3 rounded-sm border border-canvas-line">
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-bark tracking-wider">
                Storefront Concierge Mode
              </p>
              <p className="text-xs text-rose font-semibold">
                {settings.conciergeChannelMode === 'IN_SYSTEM'
                  ? 'In-System Live Assistant'
                  : 'Direct WhatsApp'}
              </p>
            </div>
            <button
              onClick={handleToggleChannelMode}
              className={`p-2 rounded-full transition-all ${
                settings.conciergeChannelMode === 'IN_SYSTEM'
                  ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200'
                  : 'text-bark bg-canvas/40 hover:bg-canvas/60'
              }`}
              title="Click to toggle between Direct WhatsApp and In-System Assistant"
            >
              {settings.conciergeChannelMode === 'IN_SYSTEM' ? (
                <ToggleRight size={32} />
              ) : (
                <ToggleLeft size={32} />
              )}
            </button>
          </div>
        </header>

        {/* Workspace Layout: Left Sidebar List, Right Chat Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          {/* Conversation List Column (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-sm border border-canvas-line shadow-soft flex flex-col overflow-hidden">
            {/* Search & Filter */}
            <div className="p-4 border-b border-canvas-line space-y-3 bg-linen/50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-light" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, or question..."
                  className="w-full pl-9 pr-3 py-1.5 bg-canvas/40 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto text-[10px]">
                {(['ALL', 'PENDING_ADMIN', 'OPEN', 'RESOLVED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded-sm uppercase tracking-wider font-semibold transition-all ${
                      statusFilter === filter
                        ? 'bg-bark text-linen'
                        : 'bg-canvas/40 text-ink-light hover:text-ink'
                    }`}
                  >
                    {filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* List Items */}
            <div className="flex-1 overflow-y-auto divide-y divide-canvas-line">
              {loading ? (
                <div className="p-10 text-center">
                  <Loader2 size={24} className="animate-spin text-rose mx-auto mb-2" />
                  <p className="text-xs text-ink-light">Loading conversations...</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-10 text-center text-xs text-ink-light space-y-2">
                  <MessageCircle size={32} className="mx-auto text-ink-light/40" />
                  <p>No conversations found.</p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = selectedConv?.id === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv)}
                      className={`w-full p-4 text-left transition-colors flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-rose/5 border-l-4 border-l-rose'
                          : 'hover:bg-canvas/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-bark truncate">
                          {conv.customer_name}
                        </span>
                        <span className="text-[10px] text-ink-light font-mono">
                          {new Date(conv.last_message_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <p className="text-xs text-ink-light line-clamp-1">
                        {conv.last_message_preview || conv.subject}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            conv.status === 'PENDING_ADMIN'
                              ? 'bg-amber-100 text-amber-800'
                              : conv.status === 'RESOLVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {conv.status.replace('_', ' ')}
                        </span>
                        {conv.customer_phone && (
                          <span className="text-[10px] text-ink-light font-mono">
                            +91 {conv.customer_phone}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Conversation Detail Column (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-sm border border-canvas-line shadow-soft flex flex-col overflow-hidden">
            {selectedConv ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4 bg-linen border-b border-canvas-line flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-bark text-linen flex items-center justify-center font-bold text-sm">
                      {selectedConv.customer_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-semibold text-bark text-base">
                          {selectedConv.customer_name}
                        </h3>
                        {selectedConv.customer_id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bark text-linen">
                            Registered Customer
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-light mt-0.5">
                        {selectedConv.customer_phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={11} /> +91 {selectedConv.customer_phone}
                          </span>
                        )}
                        {selectedConv.customer_email && (
                          <span className="flex items-center gap-1">
                            <Mail size={11} /> {selectedConv.customer_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openWhatsAppForCustomer(selectedConv)}
                      className="px-3 py-1.5 bg-[#25D366] text-white hover:opacity-90 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-opacity"
                      title="Continue conversation on WhatsApp"
                    >
                      <Phone size={13} />
                      WhatsApp
                    </button>
                    {selectedConv.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolve(selectedConv.id)}
                        className="px-3 py-1.5 border border-canvas-line text-ink hover:bg-canvas/40 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 size={13} className="text-emerald-700" />
                        Resolve
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-canvas/10">
                  {loadingMessages ? (
                    <div className="p-10 text-center">
                      <Loader2 size={24} className="animate-spin text-rose mx-auto" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="p-10 text-center text-xs text-ink-light">
                      No messages recorded in this conversation yet.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isArtisan = m.sender_type === 'ADMIN';
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isArtisan ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[75%] p-3.5 rounded-sm text-xs leading-relaxed ${
                              isArtisan
                                ? 'bg-bark text-linen rounded-br-none shadow-sm'
                                : 'bg-white text-ink border border-canvas-line rounded-bl-none shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-center gap-4 mb-1">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isArtisan ? 'text-rose-200' : 'text-rose'
                                }`}
                              >
                                {isArtisan ? 'Artisan Team' : m.sender_name}
                              </span>
                              <span
                                className={`text-[9px] font-mono ${
                                  isArtisan ? 'text-white/60' : 'text-ink-light'
                                }`}
                              >
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{m.message_text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Composer */}
                <form onSubmit={handleSendReply} className="p-4 bg-white border-t border-canvas-line">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type studio response to customer..."
                      className="flex-1 px-4 py-2.5 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !replyText.trim()}
                      className="px-5 py-2.5 bg-bark text-linen hover:bg-rose-deep rounded-sm text-xs uppercase tracking-wider font-medium flex items-center gap-2 transition-all disabled:opacity-40"
                    >
                      {isSending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>Send Reply</span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="p-16 text-center text-xs text-ink-light m-auto space-y-2">
                <MessageCircle size={40} className="mx-auto text-ink-light/40" />
                <p>Select a conversation from the left to view and reply.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </AdminLayout>
  );
}
