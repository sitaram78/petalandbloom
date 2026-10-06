import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ChevronLeft,
  Package,
  X,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { supabase } from '@/lib/supabaseClient';
import { useNotification } from '@/context/NotificationContext';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { formatPrice } from '@/data/products';
import { generateUUID, isValidUUID } from '@/utils/uuid';

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

const CANNED_REPLIES = [
  {
    label: 'Custom Palette',
    icon: '🎨',
    text: 'Namaste! We dye our 100% combed cotton yarn to order and can craft this in any bespoke colorway or palette you wish. Would you like to see our seasonal shade card?',
  },
  {
    label: 'In Crafting Queue',
    icon: '⏳',
    text: 'Your order is currently with our master florists in the crafting queue. Each petal is delicately hand-crocheted and inspected before careful boxing.',
  },
  {
    label: 'Courier Dispatched',
    icon: '🚚',
    text: 'Your bespoke parcel has been securely packed and dispatched with our courier partner. You will receive live SMS and tracking updates on your phone shortly.',
  },
  {
    label: 'Gift Packaging',
    icon: '🎁',
    text: 'All bespoke bouquets arrive in our signature kraft floral box, nestled in tissue, and accompanied by a botanical parchment card with our wax seal.',
  },
  {
    label: 'Care & Display',
    icon: '🌿',
    text: 'Crochet blooms are everlasting! Simply keep them away from direct prolonged water or dampness. For occasional dusting, use a soft bristle makeup brush or cool gentle hairdryer.',
  },
];

export default function AdminMessages() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useStoreSettings();
  const { showNotification } = useNotification();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_ADMIN' | 'OPEN' | 'RESOLVED'>('ALL');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [mobileActiveView, setMobileActiveView] = useState<'list' | 'chat'>('list');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Patron Context & Order History Drawer State
  const [patronOrders, setPatronOrders] = useState<any[]>([]);
  const [patronProfile, setPatronProfile] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);

  const fetchConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      try {
        const res = await fetch('/api/assistance/conversations');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.conversations)) {
            setConversations(json.conversations);
            if (json.conversations.length > 0) {
              setSelectedConv((current) => {
                if (!current) return json.conversations[0];
                // Keep selected conversation in sync with latest preview/status
                const found = json.conversations.find((c: any) => c.id === current.id);
                return found || current;
              });
            }
            return;
          }
        }
      } catch (err) {
        console.warn('API fetch conversations error:', err);
      }

      try {
        const { data, error } = await supabase
          .from('assistance_conversations')
          .select('*')
          .order('last_message_at', { ascending: false });

        if (!error && data) {
          setConversations(data);
          if (data.length > 0) {
            setSelectedConv((current) => current || data[0]);
          }
        }
      } catch (err: any) {
        console.warn('Fetch conversations error:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations(false);

    // Supabase Realtime channel for live conversation updates
    const channel = supabase
      .channel('realtime:assistance_conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assistance_conversations' },
        () => {
          fetchConversations(true);
        }
      )
      .subscribe();

    // Intelligent background fallback polling every 30 seconds
    const interval = setInterval(() => {
      fetchConversations(true);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Fetch messages when selected conversation changes with realtime push + passive fallback
  useEffect(() => {
    if (!selectedConv?.id) return;
    let isMounted = true;

    async function loadMessages(silent = false) {
      if (!silent) setLoadingMessages(true);
      try {
        try {
          const res = await fetch(`/api/assistance/messages?conversation_id=${encodeURIComponent(selectedConv?.id || '')}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.messages) && isMounted) {
              setMessages(json.messages);
              return;
            }
          }
        } catch (err) {
          console.warn('API load messages error:', err);
        }

        try {
          const { data, error } = await supabase
            .from('assistance_messages')
            .select('*')
            .eq('conversation_id', selectedConv?.id)
            .order('created_at', { ascending: true })
            .limit(50);

          if (!error && data && isMounted) {
            setMessages(data);
          }
        } catch (err: any) {
          console.warn('Supabase load messages error:', err);
        }
      } finally {
        if (!silent && isMounted) setLoadingMessages(false);
      }
    }

    loadMessages(false);

    // Dual Engine Realtime: Supabase Broadcast (Sub-50ms) + PostgreSQL WAL Changes (Persistence fallback)
    const channelTopic = `assistance:chat:${selectedConv.id}`;
    const msgChannel = supabase.channel(channelTopic, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    // Engine 1: Instant WebSocket Broadcast (Sub-50ms cross-device delivery)
    msgChannel.on('broadcast', { event: 'NEW_MESSAGE' }, ({ payload }) => {
      if (!isMounted || !payload) return;
      const newMsg = payload as MessageItem;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      fetchConversations(true);
      setIsCustomerTyping(false);
    });

    // Live customer typing indicator
    msgChannel.on('broadcast', { event: 'TYPING' }, ({ payload }) => {
      if (!isMounted || !payload) return;
      if (payload.sender === 'CUSTOMER') {
        setIsCustomerTyping(Boolean(payload.isTyping));
      }
    });

    // Engine 2: PostgreSQL WAL Changes (Fail-safe persistence sync)
    msgChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'assistance_messages',
        filter: `conversation_id=eq.${selectedConv.id}`,
      },
      (payload) => {
        if (!isMounted) return;
        const newMsg = payload.new as MessageItem;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        fetchConversations(true);
      }
    );

    msgChannel.subscribe();
    channelRef.current = msgChannel;

    // Passive fallback interval (30 seconds)
    const messagePollInterval = setInterval(() => {
      loadMessages(true);
    }, 30000);

    // Subscribe to new incoming messages via BroadcastChannel (0ms delivery in same browser)
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('tpb_assistance_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'NEW_MESSAGE' && isMounted) {
            if (event.data.message?.conversation_id === selectedConv?.id) {
              const newMsg = event.data.message as MessageItem;
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
            fetchConversations(true);
          }
        };
      } catch {}
    }

    return () => {
      isMounted = false;
      channelRef.current = null;
      supabase.removeChannel(msgChannel);
      clearInterval(messagePollInterval);
      if (bc) bc.close();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedConv?.id]);

  // Load Patron Context & Order History
  useEffect(() => {
    if (!selectedConv) {
      setPatronOrders([]);
      setPatronProfile(null);
      return;
    }

    let isMounted = true;
    async function loadPatronContext() {
      setLoadingContext(true);
      try {
        const conditions: string[] = [];
        if (selectedConv?.customer_id) conditions.push(`customer_id.eq.${selectedConv.customer_id}`);
        if (selectedConv?.customer_phone) conditions.push(`guest_phone.eq.${selectedConv.customer_phone}`);
        if (selectedConv?.customer_email) conditions.push(`guest_email.eq.${selectedConv.customer_email}`);

        if (conditions.length > 0) {
          const { data: ords } = await supabase
            .from('orders')
            .select('id, order_number, order_status, total_in_paise, created_at, order_items')
            .or(conditions.join(','))
            .order('created_at', { ascending: false })
            .limit(5);

          if (ords && isMounted) setPatronOrders(ords);
        } else {
          if (isMounted) setPatronOrders([]);
        }

        if (selectedConv?.customer_id) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, role, created_at')
            .eq('id', selectedConv.customer_id)
            .maybeSingle();

          if (prof && isMounted) setPatronProfile(prof);
        } else {
          if (isMounted) setPatronProfile(null);
        }
      } catch (e) {
        console.warn('Error loading patron context:', e);
      } finally {
        if (isMounted) setLoadingContext(false);
      }
    }

    loadPatronContext();
    return () => {
      isMounted = false;
    };
  }, [selectedConv]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [selectedConv?.id]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConv || isSending) return;

    setIsSending(true);
    const text = replyText.trim();
    const msgId = generateUUID();
    const tempMsg: MessageItem = {
      id: msgId,
      conversation_id: selectedConv.id,
      sender_type: 'ADMIN',
      sender_name: 'Studio Artisan',
      message_text: text,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI (0ms instant display)
    setMessages((prev) => [...prev, tempMsg]);
    setReplyText('');

    // ENGINE 1: Ultra-Fast WebSocket Broadcast (Sub-50ms instant delivery to Customer)
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'NEW_MESSAGE',
          payload: tempMsg,
        });
        channelRef.current.send({
          type: 'broadcast',
          event: 'TYPING',
          payload: { isTyping: false, sender: 'ADMIN' },
        });
      }
    } catch (bcErr) {
      console.warn('Realtime admin broadcast warning:', bcErr);
    }

    // ENGINE 2: Persistent Storage via API
    try {
      await fetch('/api/assistance/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tempMsg.id,
          conversation_id: selectedConv.id,
          sender_type: 'ADMIN',
          sender_name: 'Studio Artisan',
          message_text: text,
        }),
      });

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('tpb_assistance_channel');
        bc.postMessage({
          type: 'NEW_MESSAGE',
          message: tempMsg,
        });
        bc.close();
      }

      setSelectedConv((prev) => (prev ? { ...prev, status: 'REPLIED' } : null));
      showNotification('Reply delivered to customer chat!', 'success');
      await fetchConversations();
    } catch (err: any) {
      showNotification('Failed to send reply: ' + err.message, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyText(e.target.value);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'TYPING',
        payload: { isTyping: true, sender: 'ADMIN' },
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'TYPING',
            payload: { isTyping: false, sender: 'ADMIN' },
          });
        }
      }, 2000);
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
    <AdminLayout activePage="messages">
      <div className="p-3 sm:p-5 lg:p-6 max-w-7xl mx-auto h-[calc(100dvh-4rem)] md:h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden w-full">
        {/* Header */}
        <header className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-1.5 sm:gap-4 mb-3 sm:mb-4">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-rose font-medium">
              Customer Support &amp; Concierge
            </p>
            <h1 className="heading-serif text-2xl sm:text-3xl text-bark">Live Assistance Inbox</h1>
            <p className="text-xs text-ink-light mt-0.5 hidden sm:block">
              Manage in-system live customer chats and seamlessly coordinate via WhatsApp.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-ink-light">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Real-time Concierge Active</span>
          </div>
        </header>

        {/* Workspace Layout: Left Sidebar List, Right Chat Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 flex-1 min-h-0">
          {/* Conversation List Column (4 cols) */}
          <div className={`lg:col-span-4 h-full bg-white rounded-sm border border-canvas-line shadow-soft flex flex-col min-h-0 overflow-hidden ${
            mobileActiveView === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}>
            {/* Search & Filter (Sticky / flex-shrink-0) */}
            <div className="flex-shrink-0 p-3 sm:p-3.5 border-b border-canvas-line space-y-2.5 bg-linen/50">
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

              <div className="flex gap-1.5 overflow-x-auto text-[10px] scrollbar-none">
                {(['ALL', 'PENDING_ADMIN', 'OPEN', 'RESOLVED'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 rounded-sm uppercase tracking-wider font-semibold transition-all whitespace-nowrap ${
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

            {/* List Items (Independent Scroll Area) */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-canvas-line atelier-scrollbar">
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
                      onClick={() => {
                        setSelectedConv(conv);
                        setMobileActiveView('chat');
                      }}
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
          <div className={`lg:col-span-8 h-full bg-white rounded-sm border border-canvas-line shadow-soft flex flex-col min-h-0 overflow-hidden ${
            mobileActiveView === 'list' ? 'hidden lg:flex' : 'flex'
          }`}>
            {selectedConv ? (
              <>
                {/* Active Chat Header */}
                <div className="flex-shrink-0 p-3.5 sm:p-4 bg-linen border-b border-canvas-line flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    {/* Mobile Back to List Button */}
                    <button
                      onClick={() => setMobileActiveView('list')}
                      className="lg:hidden p-1.5 -ml-1 rounded-sm hover:bg-canvas text-bark flex items-center gap-1 text-xs font-semibold flex-shrink-0"
                      title="Back to conversation list"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-bark text-linen flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                      {selectedConv.customer_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-semibold text-bark text-sm sm:text-base truncate">
                          {selectedConv.customer_name}
                        </h3>
                        {selectedConv.customer_id && (
                          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bark text-linen">
                            Registered Customer
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-light mt-0.5">
                        {selectedConv.customer_phone && (
                          <span className="flex items-center gap-1 font-mono text-[11px] sm:text-xs">
                            <Phone size={11} /> +91 {selectedConv.customer_phone}
                          </span>
                        )}
                        {selectedConv.customer_email && (
                          <span className="hidden md:flex items-center gap-1 text-[11px] sm:text-xs truncate max-w-[200px]">
                            <Mail size={11} /> {selectedConv.customer_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                    <button
                      onClick={() => setShowContextDrawer(!showContextDrawer)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-all border ${
                        showContextDrawer
                          ? 'bg-bark text-linen border-bark'
                          : 'bg-white border-canvas-line text-bark hover:border-bark'
                      }`}
                      title="Toggle Patron Context & Recent Orders"
                    >
                      <Package size={13} className={showContextDrawer ? 'text-rose-200' : 'text-rose'} />
                      <span className="hidden sm:inline">Patron Orders</span>
                      {patronOrders.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-rose text-white text-[9px] font-mono flex items-center justify-center font-bold">
                          {patronOrders.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => openWhatsAppForCustomer(selectedConv)}
                      className="px-2.5 sm:px-3 py-1.5 bg-[#25D366] text-white hover:opacity-90 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-opacity"
                      title="Continue conversation on WhatsApp"
                    >
                      <Phone size={12} />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                    {selectedConv.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolve(selectedConv.id)}
                        className="px-2.5 sm:px-3 py-1.5 border border-canvas-line text-ink hover:bg-canvas/40 rounded-sm text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 size={12} className="text-emerald-700" />
                        <span>Resolve</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Body + Patron Context Sidebar */}
                <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-3.5 bg-canvas/15 min-w-0 atelier-scrollbar"
                  >
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
                              className={`max-w-[88%] sm:max-w-[75%] p-3.5 sm:p-4 rounded-2xl text-xs leading-relaxed shadow-soft transition-all ${
                                isArtisan
                                  ? 'bg-bark text-parchment-50 rounded-tr-xs'
                                  : 'bg-white text-bark border border-canvas-line rounded-tl-xs'
                              }`}
                            >
                              <div className="flex justify-between items-center gap-4 mb-1.5">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                    isArtisan ? 'text-rose-200' : 'text-rose'
                                  }`}
                                >
                                  {isArtisan ? (
                                    <>
                                      <Sparkles size={11} />
                                      <span>Artisan Concierge</span>
                                    </>
                                  ) : (
                                    <>
                                      <User size={11} />
                                      <span>{m.sender_name || 'Patron'}</span>
                                    </>
                                  )}
                                </span>
                                <span
                                  className={`text-[9px] font-mono ${
                                    isArtisan ? 'text-parchment-50/60' : 'text-ink-light'
                                  }`}
                                >
                                  {new Date(m.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap leading-relaxed">{m.message_text}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {isCustomerTyping && (
                      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-ink-light bg-white border border-canvas-line rounded-full w-fit animate-fade-in mt-1 shadow-2xs">
                        <span className="inline-flex gap-1 items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-bark/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-bark/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-bark/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                        <span className="text-[11px] font-medium text-bark/70">Customer is typing...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Patron Context Sidebar Drawer */}
                  {showContextDrawer && (
                    <div className="w-full lg:w-80 h-full border-t lg:border-t-0 lg:border-l border-canvas-line bg-linen/50 flex flex-col overflow-y-auto p-4 space-y-4 max-h-[45vh] lg:max-h-none flex-shrink-0 atelier-scrollbar">
                      <div className="flex items-center justify-between pb-3 border-b border-canvas-line/80">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-rose" />
                          <h4 className="font-serif font-semibold text-bark text-sm">Patron Dossier</h4>
                        </div>
                        <button
                          onClick={() => setShowContextDrawer(false)}
                          className="p-1 rounded hover:bg-canvas text-ink-light hover:text-bark transition-colors"
                          title="Close dossier"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Patron Relationship Stats */}
                      <div className="bg-white p-3.5 rounded-sm border border-canvas-line space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-ink-light">Status</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose/10 text-rose border border-rose/20">
                            {selectedConv.customer_id ? 'Registered Patron' : 'Guest Visitor'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-canvas-line/60 text-xs">
                          <div>
                            <span className="text-[10px] text-ink-light block">Total Orders</span>
                            <span className="font-serif font-bold text-bark text-base">{patronOrders.length}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-ink-light block">Lifetime Spend</span>
                            <span className="font-serif font-bold text-bark text-base">
                              {formatPrice(patronOrders.reduce((sum, o) => sum + (o.total_in_paise || 0), 0) / 100)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Recent Orders List */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-ink-light">Recent Orders</span>
                          <button
                            onClick={() => navigate('/admin/orders')}
                            className="text-[10px] text-rose hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>All Orders</span>
                            <ExternalLink size={10} />
                          </button>
                        </div>

                        {loadingContext ? (
                          <div className="py-8 text-center text-xs text-ink-light">
                            <Loader2 size={16} className="animate-spin text-rose mx-auto mb-1" />
                            <span>Searching order ledger...</span>
                          </div>
                        ) : patronOrders.length === 0 ? (
                          <div className="bg-white/60 p-4 rounded-sm border border-canvas-line text-center text-xs text-ink-light space-y-1">
                            <p>No past orders located.</p>
                            <p className="text-[10px] text-ink-light/60">Phone: {selectedConv.customer_phone || 'None'}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {patronOrders.map((ord) => (
                              <div
                                key={ord.id}
                                onClick={() => navigate('/admin/orders')}
                                className="bg-white p-3 rounded-sm border border-canvas-line hover:border-bark hover:shadow-2xs transition-all cursor-pointer space-y-1.5"
                                title="Click to view in orders manager"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-xs text-bark">{ord.order_number}</span>
                                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-canvas border border-canvas-line text-bark">
                                    {ord.order_status.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-ink-light text-[10px]">
                                    {new Date(ord.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="font-serif font-bold text-bark">
                                    {formatPrice((ord.total_in_paise || 0) / 100)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Canned Concierge Responses Toolbar (flex-shrink-0) */}
                <div className="flex-shrink-0 px-3.5 py-2 bg-linen/60 border-t border-canvas-line flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose flex items-center gap-1 flex-shrink-0 mr-1">
                    <Sparkles size={11} /> Canned:
                  </span>
                  {CANNED_REPLIES.map((canned) => (
                    <button
                      key={canned.label}
                      type="button"
                      onClick={() => setReplyText(canned.text)}
                      className="px-2.5 py-1 rounded-full bg-white hover:bg-rose/10 border border-canvas-line hover:border-rose/30 text-[11px] text-bark hover:text-rose-deep transition-all shadow-2xs whitespace-nowrap flex items-center gap-1 flex-shrink-0"
                      title="Insert template into reply input"
                    >
                      <span>{canned.icon}</span>
                      <span>{canned.label}</span>
                    </button>
                  ))}
                </div>

                {/* Reply Composer (flex-shrink-0) */}
                <form onSubmit={handleSendReply} className="flex-shrink-0 p-3 sm:p-4 bg-white border-t border-canvas-line">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={handleReplyChange}
                      placeholder="Type studio response to customer..."
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !replyText.trim()}
                      className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-bark text-linen hover:bg-rose-deep rounded-sm text-xs uppercase tracking-wider font-medium flex items-center gap-1.5 sm:gap-2 transition-all disabled:opacity-40 flex-shrink-0"
                    >
                      {isSending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span className="hidden sm:inline">Send Reply</span>
                      <span className="sm:hidden">Send</span>
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
      </div>
    </AdminLayout>
  );
}
