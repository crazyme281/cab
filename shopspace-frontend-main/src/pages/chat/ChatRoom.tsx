import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ReportModal from '../../components/ReportModal';
import HeaderMenu from '../../components/HeaderMenu';

interface Message {
  message_id: number;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  product_id: number | null;
  is_read: boolean;
  created_at: string;
}

interface OtherUser {
  user_id: string;
  full_name: string;
  profile_image: string | null;
}

interface ThreadProduct {
  product_id: number;
  title: string;
  price: string;
  image_url: string | null;
}

const formatMoney = (price: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(
    Number(price)
  );

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const ChatRoom: React.FC = () => {
  const { userId: otherUserId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('product');
  const { user } = useAuth();
  const userId = user?.user_id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [threadProduct, setThreadProduct] = useState<ThreadProduct | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<number | null>(null);
  const messagesLengthRef = useRef(0);
  const bannerProductIdRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const isSelf = !!userId && userId === otherUserId;

  const loadMessages = async () => {
    if (!userId || !otherUserId || userId === otherUserId) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })
      .limit(500);
    if (!aliveRef.current) return;
    const rows = (data as Message[]) || [];

    // Polling returns the same messages most of the time. Only touch state when
    // something actually changed, otherwise every poll re-renders the list and
    // scrolls the person back to the bottom while they're reading older messages.
    const last = rows.length > 0 ? rows[rows.length - 1].message_id : null;
    if (last !== lastMessageIdRef.current || rows.length !== messagesLengthRef.current) {
      lastMessageIdRef.current = last;
      messagesLengthRef.current = rows.length;
      setMessages(rows);
    }

    // Mark incoming messages as read — only if there is anything unread
    // (RLS only allows updating rows where we're the receiver).
    if (rows.some((m) => m.receiver_id === userId && !m.is_read)) {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', userId)
        .eq('is_read', false);
    }

    // Most recently referenced product in this thread, for the banner.
    const latestProductId = [...rows].reverse().find((m) => m.product_id != null)?.product_id ?? null;
    if (latestProductId !== bannerProductIdRef.current) {
      bannerProductIdRef.current = latestProductId;
      if (latestProductId == null) {
        setThreadProduct(null);
      } else {
        const { data: p } = await supabase
          .from('products')
          .select('product_id, title, price, image_url')
          .eq('product_id', latestProductId)
          .maybeSingle();
        if (aliveRef.current) setThreadProduct((p as ThreadProduct) || null);
      }
    }
  };

  useEffect(() => {
    if (!otherUserId || !userId) return;
    aliveRef.current = true;
    lastMessageIdRef.current = null;
    messagesLengthRef.current = 0;
    bannerProductIdRef.current = null;
    setMessages([]);
    setThreadProduct(null);

    supabase
      .from('users')
      .select('user_id, full_name, profile_image')
      .eq('user_id', otherUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (aliveRef.current) setOtherUser((data as OtherUser) || null);
      });

    loadMessages();
    const interval = setInterval(loadMessages, 4000); // poll for new messages
    return () => {
      aliveRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId, userId]);

  // Scroll down only when a new message arrives, not on every poll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !otherUserId || isSelf || sending) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    setDraft('');
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.user_id,
        receiver_id: otherUserId,
        message_text: text,
        product_id: productId ? Number(productId) : null,
      });
      if (error) throw new Error(error.message);
      loadMessages();
    } catch (err) {
      // Put the draft back if sending failed, and say so
      setDraft(text);
      setSendError('Message not sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="market-page-outer">
      <div className="market-page ss-medium chat-room-card">
        <header className="ss-page-header">
          <Link to="/chats" className="ss-back-btn" aria-label="Back to chats">
            <i className="ti ti-arrow-left" aria-hidden="true"></i>
          </Link>
          <span className="chat-room-name">{otherUser?.full_name || 'Chat'}</span>
          <button type="button" className="admin-report-link chat-report-btn" onClick={() => setShowReport(true)}>
            Report
          </button>
          <HeaderMenu />
        </header>

        {showReport && otherUserId && (
          <ReportModal reportedUserId={otherUserId} onClose={() => setShowReport(false)} />
        )}

        {threadProduct && (
          <Link to={`/market/product/${threadProduct.product_id}`} className="chat-product-banner">
            <div className="chat-product-banner-image">
              {threadProduct.image_url ? (
                <img src={threadProduct.image_url} alt={threadProduct.title} />
              ) : (
                <div className="market-card-placeholder">
                  <i className="ti ti-photo" aria-hidden="true"></i>
                </div>
              )}
            </div>
            <div className="chat-product-banner-body">
              <div className="chat-product-banner-title">{threadProduct.title}</div>
              <div className="chat-product-banner-price">{formatMoney(threadProduct.price)}</div>
            </div>
            <span className="chat-product-banner-link">View item</span>
          </Link>
        )}

        <div className="chat-room-messages">
          {isSelf && <p className="market-status">You can't message yourself.</p>}
          {messages.map((m) => {
            const mine = m.sender_id === user?.user_id;
            return (
              <div key={m.message_id} className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
                <div className={`chat-bubble ${mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
                  <div>{m.message_text}</div>
                  <div className="chat-bubble-time">{formatTime(m.created_at)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {sendError && <p className="auth-error chat-send-error" role="alert">{sendError}</p>}
        <form className="chat-room-input-bar" onSubmit={handleSend}>
          <input
            type="text"
            className="chat-room-input"
            placeholder="Message"
            aria-label="Message"
            maxLength={2000}
            disabled={isSelf}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="chat-room-send" disabled={sending || isSelf || !draft.trim()}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoom;