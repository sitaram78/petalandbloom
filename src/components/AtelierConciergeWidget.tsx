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
} from 'lucide-react';
import { useStoreSettings } from '@/context/StoreSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';

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
    return localStorage.getItem('tpb_active_conversation_id');
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [hasStartedConversation, setHasStartedConversation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [messages, isChatOpen]);

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
            'Welcome to The Petal & Bloom Atelier! How can we assist you with our handcrafted crochet florals or custom gifts today?',
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
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0 && isMounted) {
          setMessages(data);
          setHasStartedConversation(true);
        }
      } catch (err) {
        // Fallback
      }
    }

    loadMessages();

    // Active real-time polling every 2s while chat drawer is open
    const pollTimer = setInterval(() => {
      if (isChatOpen) {
        loadMessages();
      }
    }, 2000);

    // Subscribe to new messages via BroadcastChannel (local & cross-tab in same browser)
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('tpb_assistance_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'NEW_MESSAGE' && event.data.message?.conversation_id === conversationId) {
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
      clearInterval(pollTimer);
      if (bc) bc.close();
    };
  }, [conversationId, isChatOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);

    const senderName = customerName.trim() || profile?.full_name || 'Guest Visitor';
    const tempId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMsg: ChatMessage = {
      id: tempId,
      sender_type: 'CUSTOMER',
      sender_name: senderName,
      message_text: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText('');

    try {
      let activeConvId = conversationId;

      // Create conversation if not exists
      if (!activeConvId) {
        activeConvId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  const handleQuickQuestion = (question: string) => {
    setInputText(question);
  };

  // If in WHATSAPP mode and chat is closed, floating bubble triggers WhatsApp directly
  const handleBubbleClick = () => {
    if (settings.conciergeChannelMode === 'WHATSAPP') {
      const url = buildWhatsAppUrl('Hi The Petal & Bloom! I have a question about your handcrafted blooms.');
      window.open(url, '_blank');
    } else {
      setIsChatOpen(!isChatOpen);
    }
  };

  return (
    <>
      {/* Responsive Floating Action Bubble */}
      <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 print:hidden flex flex-col items-end">
        {!isChatOpen && (
          <button
            onClick={handleBubbleClick}
            className={`group flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 border ${
              settings.conciergeChannelMode === 'WHATSAPP'
                ? 'bg-[#25D366] text-white hover:bg-[#20bd5a] border-emerald-300/40 shadow-emerald-950/20'
                : 'bg-bark text-linen hover:bg-rose-deep border-canvas-line shadow-bark/30'
            }`}
            aria-label={settings.conciergeChannelMode === 'WHATSAPP' ? 'Chat on WhatsApp' : 'Studio Assistance'}
          >
            <div className="relative flex items-center justify-center">
              {settings.conciergeChannelMode === 'WHATSAPP' ? (
                <Phone size={18} className="text-white fill-current sm:w-5 sm:h-5" />
              ) : (
                <MessageCircle size={18} className="text-linen sm:w-5 sm:h-5" />
              )}
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-bark animate-pulse" />
            </div>
            <div className="flex flex-col text-left leading-tight pr-1">
              {settings.conciergeChannelMode === 'WHATSAPP' ? (
                <>
                  <span className="text-[11px] sm:text-xs font-semibold tracking-wide uppercase sm:hidden">WhatsApp</span>
                  <span className="text-xs uppercase tracking-wider font-semibold hidden sm:inline">Chat on WhatsApp</span>
                </>
              ) : (
                <>
                  <span className="text-[11px] sm:text-xs font-semibold tracking-wide uppercase sm:hidden">Live Chat</span>
                  <span className="text-xs uppercase tracking-wider font-semibold hidden sm:inline">Studio Assistance</span>
                </>
              )}
            </div>
          </button>
        )}
      </div>

      {/* In-System Chat Drawer / Window */}
      {isChatOpen && settings.conciergeChannelMode === 'IN_SYSTEM' && (
        <div className="fixed inset-x-3 bottom-20 sm:inset-x-auto sm:bottom-6 sm:right-6 w-auto sm:w-[400px] h-[520px] max-h-[75vh] sm:max-h-[85vh] bg-white rounded-atelier-card shadow-2xl border border-canvas-line flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300 z-50">
          {/* Header */}
          <div className="p-4 bg-bark text-linen flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose/20 flex items-center justify-center text-linen font-serif">
                🌸
              </div>
              <div>
                <h4 className="font-serif font-medium text-sm text-linen">The Petal &amp; Bloom</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-white/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Artisan Assistance · Live in Studio</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <a
                href={buildWhatsAppUrl('Hi! I am switching over from the site chat to WhatsApp.')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-white/70 hover:text-white rounded hover:bg-white/10 text-[10px] flex items-center gap-1"
                title="Switch to WhatsApp"
              >
                <Phone size={12} />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 text-white/70 hover:text-white rounded hover:bg-white/10"
                aria-label="Close assistance window"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Guidance Strip */}
          <div className="bg-linen px-3.5 py-2 border-b border-canvas-line flex items-center justify-between text-[11px] text-ink-light">
            <span className="italic">Questions on floral customization or orders?</span>
            <span className="font-mono text-[10px] text-rose font-medium">Bespoke MTO</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-canvas/20">
            {messages.map((msg) => {
              const isMe = msg.sender_type === 'CUSTOMER';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-sm text-xs leading-relaxed ${
                      isMe
                        ? 'bg-bark text-linen rounded-br-none shadow-sm'
                        : 'bg-white text-ink border border-canvas-line rounded-bl-none shadow-sm'
                    }`}
                  >
                    {!isMe && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose mb-1">
                        {msg.sender_name}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.message_text}</p>
                    <p
                      className={`text-[9px] mt-1 text-right ${
                        isMe ? 'text-white/60' : 'text-ink-light/60'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Guest Identity Form (only shown if not logged in and starting fresh) */}
          {!user && !hasStartedConversation && (
            <div className="p-3 bg-linen border-t border-canvas-line space-y-2 text-xs">
              <p className="text-[10px] uppercase font-bold text-bark tracking-wider">
                Your Contact (So our studio can get back to you)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-canvas-line rounded text-xs"
                />
                <input
                  type="tel"
                  placeholder="Mobile Number"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-canvas-line rounded text-xs"
                />
              </div>
            </div>
          )}

          {/* Quick Suggestion Pills */}
          {messages.length <= 2 && (
            <div className="px-3 py-2 bg-white border-t border-canvas-line flex gap-1.5 overflow-x-auto no-scrollbar">
              {[
                'Custom color request',
                'Track my order',
                'Delivery timeline',
                'Flower care advice',
              ].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => handleQuickQuestion(pill)}
                  className="px-2.5 py-1 bg-canvas/40 hover:bg-rose/10 border border-canvas-line rounded-full text-[10px] text-ink-light hover:text-rose whitespace-nowrap transition-colors"
                >
                  {pill}
                </button>
              ))}
            </div>
          )}

          {/* Input Composer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-canvas-line flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask our studio artisans..."
              className="flex-1 px-3 py-2 bg-canvas/30 border border-canvas-line rounded-sm text-xs text-ink focus:outline-none focus:border-bark"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="p-2.5 bg-bark text-linen hover:bg-rose-deep rounded-sm transition-all disabled:opacity-40"
              aria-label="Send message"
            >
              {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
