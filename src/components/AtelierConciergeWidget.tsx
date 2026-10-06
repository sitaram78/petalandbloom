import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Sparkles,
  Phone,
  User,
  ExternalLink,
  ChevronDown,
  CheckCheck,
  Clock,
  ShieldCheck,
  Heart,
  ArrowLeft,
  Sparkle,
} from 'lucide-react';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { generateUUID, isValidUUID } from '@/utils/uuid';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';

interface ChatMessage {
  id: string;
  sender_type: 'CUSTOMER' | 'ADMIN' | 'BOT';
  sender_name: string;
  message_text: string;
  created_at: string;
}

export default function AtelierConciergeWidget() {
  const {
    settings,
    isChatOpen,
    setIsChatOpen,
    activeContextMessage,
    buildWhatsAppUrl,
  } = useStoreSettings();

  const { user, profile } = useAuth();

  const [conversationId, setConversationId] = useState<string | null>(() => {
    const stored = localStorage.getItem('tpb_active_conversation_id');
    return isValidUUID(stored) ? stored : null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [hasStartedConversation, setHasStartedConversation] = useState(false);
  const [isArtisanTyping, setIsArtisanTyping] = useState(false);

  // Mobile Collapsed State: when closed or after interaction on mobile, becomes compact circular icon
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('tpb_concierge_collapsed_mobile') === 'true';
    } catch {
      return false;
    }
  });

  const handleCloseChat = () => {
    setIsChatOpen(false);
    setIsMobileCollapsed(true);
    try {
      sessionStorage.setItem('tpb_concierge_collapsed_mobile', 'true');
    } catch {}
  };

  // Mobile Swipe Down to Close gesture hook (120fps direct GPU engine)
  const {
    sheetRef: chatSheetRef,
    backdropRef: chatBackdropRef,
    handleTouchStart: handleChatTouchStart,
    handleTouchMove: handleChatTouchMove,
    handleTouchEnd: handleChatTouchEnd,
    triggerCloseWithAnimation: closeChatWithAnimation,
    sheetStyle: chatSheetStyle,
    isDragging: isChatDragging,
    isPastThreshold: isChatPastThreshold,
  } = useSwipeDownToClose({
    onClose: handleCloseChat,
    threshold: 75,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [messages, isChatOpen]);

  // Escape key listener to close chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChatOpen) {
        closeChatWithAnimation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, closeChatWithAnimation]);

  // Pre-fill profile info if logged in
  useEffect(() => {
    if (profile) {
      setCustomerName(profile.full_name || '');
      setCustomerPhone(profile.phone || '');
    }
  }, [profile]);

  // Prefill activeContextMessage if triggered from an enquiry button
  useEffect(() => {
    if (activeContextMessage && isChatOpen) {
      setInputText(activeContextMessage);
    }
  }, [activeContextMessage, isChatOpen]);

  // Load conversation messages from Supabase or localStorage
  useEffect(() => {
    if (!conversationId) {
      // Default welcome greeting
      setMessages([
        {
          id: 'welcome-bot',
          sender_type: 'BOT',
          sender_name: 'Atelier Concierge',
          message_text:
            'Namaste! Welcome to The Petal & Bloom Atelier. How can we assist you with our handcrafted crochet florals, custom bouquets, or bespoke gift orders today?',
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    let isMounted = true;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/assistance/messages?conversation_id=${encodeURIComponent(conversationId || '')}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.messages && json.messages.length > 0 && isMounted) {
            setMessages(json.messages);
            setHasStartedConversation(true);
            return;
          }
        }
      } catch (err) {
        // Fallback
      }

      try {
        const { data, error } = await supabase
          .from('assistance_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })
          .limit(50);

        if (!error && data && data.length > 0 && isMounted) {
          setMessages(data);
          setHasStartedConversation(true);
        }
      } catch (err) {
        // Fallback
      }
    }

    loadMessages();

    // Dual Engine Realtime: Supabase Broadcast (Sub-50ms) + PostgreSQL WAL Changes (Persistence fallback)
    const channelTopic = `assistance:chat:${conversationId}`;
    const msgChannel = supabase.channel(channelTopic, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    // Engine 1: Instant WebSocket Broadcast (Sub-50ms cross-device delivery)
    msgChannel.on('broadcast', { event: 'NEW_MESSAGE' }, ({ payload }) => {
      if (!isMounted || !payload) return;
      const newMsg = payload as ChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setHasStartedConversation(true);
      setIsArtisanTyping(false);
    });

    // Live typing indicator listener
    msgChannel.on('broadcast', { event: 'TYPING' }, ({ payload }) => {
      if (!isMounted || !payload) return;
      if (payload.sender === 'ADMIN') {
        setIsArtisanTyping(Boolean(payload.isTyping));
      }
    });

    // Realtime chat cleared listener (instantly clears messages when admin purges chat)
    msgChannel.on('broadcast', { event: 'CHAT_CLEARED' }, () => {
      if (!isMounted) return;
      setMessages([]);
      setIsArtisanTyping(false);
    });

    // Engine 2: PostgreSQL WAL Changes (Fail-safe persistence sync)
    msgChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'assistance_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        if (!isMounted) return;
        const newMsg = payload.new as ChatMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setHasStartedConversation(true);
      }
    );

    msgChannel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'assistance_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      () => {
        if (!isMounted) return;
        setMessages([]);
      }
    );

    msgChannel.subscribe();
    channelRef.current = msgChannel;

    // Passive fallback sync every 30s while chat is open
    const fallbackTimer = setInterval(() => {
      if (isChatOpen) {
        loadMessages();
      }
    }, 30000);

    // Subscribe to new messages via local browser BroadcastChannel (same-origin instant sync)
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('tpb_assistance_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'CHAT_CLEARED' && event.data.conversation_id === conversationId) {
            if (isMounted) {
              setMessages([]);
            }
          } else if (event.data?.type === 'NEW_MESSAGE' && event.data.message?.conversation_id === conversationId) {
            const newMsg = event.data.message as ChatMessage;
            if (isMounted) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }

    return () => {
      isMounted = false;
      channelRef.current = null;
      supabase.removeChannel(msgChannel);
      clearInterval(fallbackTimer);
      if (bc) bc.close();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [conversationId, isChatOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);

    const senderName = customerName.trim() || profile?.full_name || 'Guest Visitor';
    let activeConvId = conversationId;

    // Create valid UUID conversation if not exists
    if (!activeConvId || !isValidUUID(activeConvId)) {
      activeConvId = generateUUID();
      setConversationId(activeConvId);
      localStorage.setItem('tpb_active_conversation_id', activeConvId);
      setHasStartedConversation(true);

      try {
        await fetch('/api/assistance/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: activeConvId,
            customer_id: user?.id || null,
            customer_name: senderName,
            customer_phone: customerPhone.trim() || profile?.phone || null,
            customer_email: user?.email || null,
            subject: text.slice(0, 60),
            status: 'PENDING_ADMIN',
            last_message_preview: text,
          }),
        });
      } catch {}
    }

    const msgId = generateUUID();
    const newMsg: ChatMessage = {
      id: msgId,
      sender_type: 'CUSTOMER',
      sender_name: senderName,
      message_text: text,
      created_at: new Date().toISOString(),
    };

    // Optimistic UI (0ms instant display for sender)
    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    // ENGINE 1: Ultra-Fast WebSocket Broadcast (Sub-50ms instant delivery to Admin)
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'NEW_MESSAGE',
          payload: { ...newMsg, conversation_id: activeConvId },
        });
        channelRef.current.send({
          type: 'broadcast',
          event: 'TYPING',
          payload: { isTyping: false, sender: 'CUSTOMER' },
        });
      }
    } catch (bcErr) {
      console.warn('Realtime broadcast warning:', bcErr);
    }

    // ENGINE 2: Persistent Storage via API
    try {
      await fetch('/api/assistance/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newMsg.id,
          conversation_id: activeConvId,
          sender_type: 'CUSTOMER',
          sender_name: senderName,
          message_text: text,
        }),
      });

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('tpb_assistance_channel');
        bc.postMessage({
          type: 'NEW_MESSAGE',
          message: { ...newMsg, conversation_id: activeConvId },
        });
        bc.close();
      }
    } catch (err) {
      console.warn('Error saving in-system message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'TYPING',
        payload: { isTyping: true, sender: 'CUSTOMER' },
      });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'TYPING',
            payload: { isTyping: false, sender: 'CUSTOMER' },
          });
        }
      }, 2000);
    }
  };

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  // Feature flag check: If In-System live chat is disabled, automatically fall back to WhatsApp
  const isLiveChatEnabled = settings.featureFlags?.enableLiveChat !== false;
  const effectiveMode = isLiveChatEnabled ? settings.conciergeChannelMode : 'WHATSAPP';

  // If in WHATSAPP mode and chat is closed, floating bubble triggers WhatsApp directly
  const handleBubbleClick = () => {
    if (effectiveMode === 'WHATSAPP') {
      const url = buildWhatsAppUrl('Hi The Petal & Bloom! I have a question about your handcrafted blooms.');
      window.open(url, '_blank');
    } else {
      setIsChatOpen(!isChatOpen);
    }
  };

  // Group consecutive messages from the same sender to eliminate repetitive boxy headers
  const groupedMessages = messages.map((msg, index) => {
    const isMe = msg.sender_type === 'CUSTOMER';
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isSameSenderAsPrev = prevMsg && prevMsg.sender_type === msg.sender_type;

    const prevTime = prevMsg ? new Date(prevMsg.created_at).getTime() : 0;
    const currTime = new Date(msg.created_at).getTime();
    const isCloseInTime = currTime - prevTime < 4 * 60 * 1000; // 4 mins

    const isFollowUp = isSameSenderAsPrev && isCloseInTime;

    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
    const isSameSenderAsNext = nextMsg && nextMsg.sender_type === msg.sender_type;
    const nextTime = nextMsg ? new Date(nextMsg.created_at).getTime() : 0;
    const isCloseToNext = nextTime - currTime < 4 * 60 * 1000;
    const isLastInGroup = !(isSameSenderAsNext && isCloseToNext);

    return {
      ...msg,
      isMe,
      isFollowUp,
      isFirstInGroup: !isFollowUp,
      isLastInGroup,
    };
  });

  return (
    <>
      {/* Floating Action Launcher (when chat is closed) */}
      {!isChatOpen && (
        <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 print:hidden flex flex-col items-end">
          <button
            onClick={handleBubbleClick}
            className={`group flex items-center shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border ${
              effectiveMode === 'WHATSAPP'
                ? 'bg-[#25D366] text-white hover:bg-[#20bd5a] border-emerald-300/40 shadow-emerald-950/20'
                : 'bg-bark text-parchment-50 hover:bg-bark-dark border-canvas-line/80 shadow-bark/30'
            } ${
              isMobileCollapsed
                ? 'w-12 h-12 p-0 justify-center rounded-full sm:w-auto sm:h-auto sm:px-4 sm:py-3 sm:gap-2.5'
                : 'px-4 py-3 gap-2.5 rounded-full'
            }`}
            aria-label={effectiveMode === 'WHATSAPP' ? 'Chat on WhatsApp' : 'Studio Assistance'}
          >
            <div className="relative flex items-center justify-center flex-shrink-0">
              {effectiveMode === 'WHATSAPP' ? (
                <Phone size={19} className="text-white fill-current" />
              ) : (
                <MessageCircle size={19} className="text-rose-200" />
              )}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-bark animate-pulse" />
            </div>

            <div
              className={`flex flex-col text-left leading-tight pr-0.5 transition-all duration-300 overflow-hidden ${
                isMobileCollapsed
                  ? 'max-w-0 opacity-0 sm:max-w-xs sm:opacity-100 sm:block'
                  : 'max-w-xs opacity-100'
              }`}
            >
              {effectiveMode === 'WHATSAPP' ? (
                <>
                  <span className="text-[11px] font-semibold tracking-wide uppercase sm:hidden whitespace-nowrap">WhatsApp</span>
                  <span className="text-xs uppercase tracking-wider font-semibold hidden sm:inline whitespace-nowrap">WhatsApp Studio</span>
                </>
              ) : (
                <>
                  <span className="text-[11px] font-serif font-medium tracking-wide sm:hidden whitespace-nowrap">Artisan Chat</span>
                  <div className="hidden sm:block">
                    <span className="text-xs font-serif font-medium text-parchment-50 block leading-tight whitespace-nowrap">Atelier Concierge</span>
                    <span className="text-[9px] uppercase tracking-wider text-rose-200 font-mono whitespace-nowrap">Live in Studio</span>
                  </div>
                </>
              )}
            </div>
          </button>
        </div>
      )}

      {/* In-System Chat Window / Responsive Bottom Sheet */}
      {isChatOpen && effectiveMode === 'IN_SYSTEM' && (
        <>
          {/* Mobile Backdrop Overlay */}
          <div
            ref={chatBackdropRef}
            className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-50"
            onClick={closeChatWithAnimation}
          />

          {/* Chat Container */}
          <div
            ref={chatSheetRef}
            style={chatSheetStyle}
            className={`fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-6 sm:right-6 w-full sm:w-[410px] h-[86vh] sm:h-[620px] max-h-[92vh] sm:max-h-[85vh] bg-parchment-50 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-canvas-line/80 flex flex-col overflow-hidden z-50 ${
              !isChatDragging ? 'animate-slide-up' : ''
            }`}
          >
            {/* Mobile Sheet Drag Indicator Bar (Interactive Swipe-Down Area) */}
            <div
              className="sm:hidden pt-3 pb-1.5 bg-bark flex justify-center cursor-grab active:cursor-grabbing select-none touch-none"
              onTouchStart={handleChatTouchStart}
              onTouchMove={handleChatTouchMove}
              onTouchEnd={handleChatTouchEnd}
            >
              <div
                className={`h-1 rounded-full transition-all duration-150 ${
                  isChatPastThreshold
                    ? 'w-14 bg-rose-300 scale-y-125'
                    : isChatDragging
                    ? 'w-12 bg-white/70 scale-y-110'
                    : 'w-10 bg-white/30'
                }`}
              />
            </div>

            {/* Header (Also Swipeable) */}
            <div
              className="px-4 py-3 bg-bark text-parchment-50 flex items-center justify-between border-b border-white/10 select-none touch-none"
              onTouchStart={handleChatTouchStart}
              onTouchMove={handleChatTouchMove}
              onTouchEnd={handleChatTouchEnd}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose/20 border border-rose/30 flex items-center justify-center text-rose-200 font-serif text-sm font-semibold shadow-inner">
                    PB
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-bark animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif font-medium text-sm text-parchment-50 tracking-tight">The Petal &amp; Bloom</h4>
                    <span className="text-[9px] uppercase tracking-widest font-mono text-rose-200 px-1.5 py-0.2 rounded bg-rose/20">Studio</span>
                  </div>
                  <p className="text-[11px] text-parchment-50/70 flex items-center gap-1.5 mt-0.5">
                    <span>Artisan Concierge</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">Replies in ~2 min</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={buildWhatsAppUrl('Hi! I am switching over from the site concierge to WhatsApp.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-[#25D366]/20 hover:bg-[#25D366] text-emerald-200 hover:text-white rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all border border-[#25D366]/30"
                  title="Switch to WhatsApp"
                >
                  <Phone size={11} className="fill-current" />
                  <span className="hidden xs:inline">WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={closeChatWithAnimation}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-parchment-50/70 hover:text-parchment-50 hover:bg-white/10 transition-colors"
                  aria-label="Close concierge window"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Quick Topics Ribbon */}
            <div className="px-3.5 py-2 bg-linen/60 border-b border-canvas-line/60 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {[
                { label: 'Custom Palette', icon: '🎨', prompt: 'I want to ask about custom colorways and bespoke yarn options.' },
                { label: 'Track Order', icon: '📦', prompt: 'Can you help me check the crafting or shipping status of my order?' },
                { label: 'Gift Wrap & Card', icon: '🎁', prompt: 'Do you offer hand-lettered wax-sealed notes and gift packaging?' },
                { label: 'Care & Longevity', icon: '✨', prompt: 'How do I care for my handmade crochet flowers for lifelong display?' },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleQuickQuestion(item.prompt)}
                  className="px-2.5 py-1 bg-white hover:bg-rose/10 border border-canvas-line hover:border-rose/40 rounded-full text-[11px] text-bark hover:text-rose-deep whitespace-nowrap transition-all shadow-2xs flex items-center gap-1.5 flex-shrink-0"
                >
                  <span className="text-xs">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2 atelier-scrollbar bg-parchment/60">
              {groupedMessages.map((msg) => {
                const timeString = new Date(msg.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                if (msg.sender_type === 'BOT') {
                  return (
                    <div key={msg.id} className="pt-1 pb-2">
                      <div className="bg-linen/80 border border-canvas-line/80 rounded-2xl p-3.5 shadow-2xs space-y-1.5">
                        <div className="flex items-center gap-1.5 text-rose text-xs font-medium">
                          <Sparkles size={13} />
                          <span className="font-serif">The Atelier Welcome</span>
                        </div>
                        <p className="text-xs text-bark leading-relaxed">{msg.message_text}</p>
                        <p className="text-[9px] text-ink-light/60 font-mono text-right">{timeString}</p>
                      </div>
                    </div>
                  );
                }

                if (msg.isMe) {
                  // Customer message bubble
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col items-end ${msg.isFirstInGroup ? 'pt-2' : 'pt-0.5'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-[78%] px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs transition-all bg-bark text-parchment-50 ${
                          msg.isFirstInGroup && msg.isLastInGroup
                            ? 'rounded-2xl rounded-tr-xs'
                            : msg.isFirstInGroup
                            ? 'rounded-2xl rounded-tr-xs rounded-br-md'
                            : msg.isLastInGroup
                            ? 'rounded-2xl rounded-tr-md rounded-br-xs'
                            : 'rounded-2xl rounded-r-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message_text}</p>
                        <div className="text-[9px] text-parchment-50/70 font-mono mt-1 flex items-center justify-end gap-1">
                          <span>{timeString}</span>
                          <CheckCheck size={11} className="text-emerald-400" />
                        </div>
                      </div>
                    </div>
                  );
                }

                // Studio Artisan message bubble
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col items-start ${msg.isFirstInGroup ? 'pt-2' : 'pt-0.5'}`}
                  >
                    {msg.isFirstInGroup && (
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-rose">
                        <Sparkles size={11} />
                        <span>Master Artisan Studio</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] sm:max-w-[78%] px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs transition-all bg-white text-bark border border-canvas-line/80 ${
                        msg.isFirstInGroup && msg.isLastInGroup
                          ? 'rounded-2xl rounded-tl-xs'
                          : msg.isFirstInGroup
                          ? 'rounded-2xl rounded-tl-xs rounded-bl-md'
                          : msg.isLastInGroup
                          ? 'rounded-2xl rounded-tl-md rounded-bl-xs'
                          : 'rounded-2xl rounded-l-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message_text}</p>
                      {msg.isLastInGroup && (
                        <p className="text-[9px] text-ink-light/60 font-mono mt-1 text-right">{timeString}</p>
                      )}
                    </div>
                  </div>
                );
              })}
              {isArtisanTyping && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-rose-deep bg-rose/10 border border-rose/20 rounded-full w-fit animate-fade-in mt-1">
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-rose animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="font-serif italic text-[11px]">Atelier Florist is crafting a reply...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Guest Identity Form (only if guest and starting conversation) */}
            {!user && !hasStartedConversation && (
              <div className="mx-3 my-2 p-3 bg-linen/90 rounded-xl border border-canvas-line space-y-2 text-xs shadow-2xs">
                <div className="flex items-center gap-1.5 text-bark font-medium">
                  <Sparkles size={12} className="text-rose" />
                  <span>Receive Live Crafting Photos &amp; Order Updates</span>
                </div>
                <p className="text-[11px] text-ink-light leading-snug">
                  Provide your name and contact so our studio can notify you as your custom blooms are crafted:
                </p>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-canvas-line rounded-md text-xs text-bark placeholder:text-ink-light/50 focus:outline-none focus:border-bark"
                  />
                  <input
                    type="tel"
                    placeholder="Phone / WhatsApp"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-canvas-line rounded-md text-xs text-bark placeholder:text-ink-light/50 focus:outline-none focus:border-bark"
                  />
                </div>
              </div>
            )}

            {/* Input Composer */}
            <div className="p-3 bg-white border-t border-canvas-line">
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-2 bg-parchment-50 border border-canvas-line rounded-full p-1 pl-3.5 focus-within:border-bark focus-within:ring-2 focus-within:ring-rose/15 transition-all shadow-2xs"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Ask our master florists anything..."
                  className="flex-1 bg-transparent text-xs sm:text-sm text-bark placeholder:text-ink-light/50 focus:outline-none py-1.5"
                />

                <button
                  type="submit"
                  disabled={isSending || !inputText.trim()}
                  className="w-8 h-8 rounded-full bg-bark hover:bg-rose-deep text-parchment-50 transition-all duration-200 flex items-center justify-center flex-shrink-0 shadow-xs active:scale-95 disabled:opacity-30 disabled:scale-95 cursor-pointer"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} className="translate-x-0.5" />
                  )}
                </button>
              </form>
              <div className="mt-1.5 flex items-center justify-between px-2 text-[10px] text-ink-light/60">
                <span>Handcrafted with love in Odisha</span>
                <span className="font-mono text-[9px]">End-to-End Concierge</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
