import React, { useEffect, useRef, useState, useCallback } from 'react';
import { requestService } from '@services/requestService';
import type { ClaimMessage, ClaimRequestDetail, ClaimRequestStatus } from '@services/requestService';
import './ClaimRequestChat.css';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// ── Status Badge ───────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: ClaimRequestStatus }> = ({ status }) => {
    const map: Record<ClaimRequestStatus, { label: string; cls: string }> = {
        pending:   { label: 'Pending',   cls: 'crc-badge--pending'   },
        accepted:  { label: 'Accepted',  cls: 'crc-badge--accepted'  },
        rejected:  { label: 'Rejected',  cls: 'crc-badge--rejected'  },
        withdrawn: { label: 'Withdrawn', cls: 'crc-badge--withdrawn' },
    };
    const { label, cls } = map[status];
    return <span className={`crc-badge ${cls}`}>{label}</span>;
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ClaimRequestChatProps {
    requestId: string;
    currentUserId: string;
    userRole: 'donor' | 'recipient';
    onAccept?: () => void;
    onReject?: () => void;
    onWithdraw?: () => void;
    onStatusChange?: (newStatus: ClaimRequestStatus) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ClaimRequestChat: React.FC<ClaimRequestChatProps> = ({
    requestId,
    currentUserId,
    userRole,
    onAccept,
    onReject,
    onWithdraw,
    onStatusChange,
}) => {
    const [detail, setDetail] = useState<ClaimRequestDetail | null>(null);
    const [messages, setMessages] = useState<ClaimMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendText, setSendText] = useState('');
    const [sending, setSending] = useState(false);
    const [actioning, setActioning] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'accept' | 'reject' | 'withdraw' | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Load initial data
    useEffect(() => {
        setLoading(true);
        requestService.getRequestWithMessages(requestId, currentUserId).then(res => {
            if (res.success && res.data) {
                setDetail(res.data);
                setMessages(res.data.messages);
                requestService.markMessagesRead(requestId, currentUserId);
            }
            setLoading(false);
        });
    }, [requestId, currentUserId]);

    // Real-time subscription
    useEffect(() => {
        const channel = requestService.subscribeToMessages(requestId, (newMsg) => {
            setMessages(prev => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
            if (newMsg.senderId !== currentUserId) {
                requestService.markMessagesRead(requestId, currentUserId);
            }
        });
        return () => { channel.unsubscribe(); };
    }, [requestId, currentUserId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const handleSend = useCallback(async () => {
        const body = sendText.trim();
        if (!body || sending) return;
        setSending(true);
        const res = await requestService.sendMessage(requestId, currentUserId, body);
        if (res.success) {
            setSendText('');
        }
        setSending(false);
    }, [sendText, sending, requestId, currentUserId]);

    const handleAction = async (action: 'accept' | 'reject' | 'withdraw') => {
        setActioning(true);
        let res;
        if (action === 'accept')   res = await requestService.acceptRequest(requestId);
        else if (action === 'reject')  res = await requestService.rejectRequest(requestId);
        else                           res = await requestService.withdrawRequest(requestId);

        if (res.success) {
            const newStatus: ClaimRequestStatus = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'withdrawn';
            setDetail(prev => prev ? { ...prev, status: newStatus } : prev);
            onStatusChange?.(newStatus);
            if (action === 'accept') onAccept?.();
            if (action === 'reject') onReject?.();
            if (action === 'withdraw') onWithdraw?.();
        }
        setActioning(false);
        setConfirmAction(null);
    };

    if (loading) {
        return (
            <div className="crc-loading">
                <div className="crc-spinner" />
            </div>
        );
    }

    if (!detail) {
        return <div className="crc-error">Could not load request.</div>;
    }

    const isPending = detail.status === 'pending';
    const isAccepted = detail.status === 'accepted';
    const canSend = isPending || isAccepted;

    return (
        <div className="crc">
            {/* Listing Summary Card */}
            <div className="crc-listing-card">
                <div className="crc-listing-info">
                    <p className="crc-listing-title">{detail.listing.title}</p>
                    <p className="crc-listing-meta">
                        {detail.listing.quantity} {detail.listing.quantityUnit}
                        {detail.listing.address && ` · ${detail.listing.address}`}
                    </p>
                </div>
                <StatusBadge status={detail.status} />
            </div>

            {/* Accepted Banner (recipient) */}
            {isAccepted && userRole === 'recipient' && detail.donorPhone && (
                <div className="crc-accepted-banner">
                    <span>
                        <svg className="crc-accepted-banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: '-2px' }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="9 12 11.5 14.5 16 9.5" />
                        </svg>
                        {' '}Accepted — contact the donor to arrange pickup
                    </span>
                    <a href={`tel:${detail.donorPhone}`} className="crc-phone-link">{detail.donorPhone}</a>
                </div>
            )}

            {/* Recipient Info (donor view) */}
            {userRole === 'donor' && (
                <div className="crc-recipient-info">
                    <span className="crc-recipient-name">{detail.recipientName}</span>
                    {detail.recipientOrgName && (
                        <span className="crc-recipient-org">
                            {detail.recipientOrgName}
                            {detail.recipientIsCharity && ' · Charity'}
                        </span>
                    )}
                </div>
            )}

            {/* Messages */}
            <div className="crc-messages">
                {messages.length === 0 ? (
                    <p className="crc-no-messages">No messages yet. Start the conversation.</p>
                ) : (
                    messages.map(msg => {
                        const isOwn = msg.senderId === currentUserId;
                        return (
                            <div key={msg.id} className={`crc-msg ${isOwn ? 'crc-msg--own' : 'crc-msg--other'} crc-msg-enter`}>
                                {!isOwn && <p className="crc-msg-sender">{msg.senderName}</p>}
                                <div className="crc-msg-bubble">{msg.body}</div>
                                <p className="crc-msg-time">{formatTime(msg.createdAt)}</p>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            {canSend ? (
                <div className="crc-input-row">
                    <textarea
                        className="crc-input"
                        value={sendText}
                        onChange={e => setSendText(e.target.value)}
                        placeholder="Type a message..."
                        rows={2}
                        disabled={sending}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button className="crc-send-btn" onClick={handleSend} disabled={sending || !sendText.trim()}>
                        {sending ? '...' : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 16 12 8" />
                                <polyline points="8 12 12 8 16 12" />
                            </svg>
                        )}
                    </button>
                </div>
            ) : (
                <p className="crc-closed-note">
                    {detail.status === 'rejected'  && 'This request was not accepted.'}
                    {detail.status === 'withdrawn' && 'This request was withdrawn.'}
                    {detail.status === 'accepted' && userRole === 'donor' && 'Request accepted.'}
                </p>
            )}

            {/* Actions */}
            {isPending && (
                <div className="crc-actions">
                    {userRole === 'donor' && (
                        <>
                            <button className="crc-btn-reject" onClick={() => setConfirmAction('reject')} disabled={actioning}>
                                Decline
                            </button>
                            <button className="crc-btn-accept" onClick={() => setConfirmAction('accept')} disabled={actioning}>
                                Accept Request
                            </button>
                        </>
                    )}
                    {userRole === 'recipient' && (
                        <button className="crc-btn-withdraw" onClick={() => setConfirmAction('withdraw')} disabled={actioning}>
                            Withdraw Request
                        </button>
                    )}
                </div>
            )}

            {/* Confirm Modal */}
            {confirmAction && (
                <div className="crc-confirm-overlay" onClick={() => setConfirmAction(null)}>
                    <div className="crc-confirm" onClick={e => e.stopPropagation()}>
                        <p className="crc-confirm-text">
                            {confirmAction === 'accept' && 'Accept this request? All other pending requests on this listing will be rejected.'}
                            {confirmAction === 'reject' && 'Decline this request?'}
                            {confirmAction === 'withdraw' && 'Withdraw your claim request?'}
                        </p>
                        <div className="crc-confirm-actions">
                            <button className="crc-btn-cancel" onClick={() => setConfirmAction(null)} disabled={actioning}>Cancel</button>
                            <button
                                className={confirmAction === 'accept' ? 'crc-btn-accept' : 'crc-btn-reject'}
                                onClick={() => handleAction(confirmAction)}
                                disabled={actioning}
                            >
                                {actioning ? '...' : confirmAction === 'accept' ? 'Confirm Accept' : confirmAction === 'reject' ? 'Confirm Decline' : 'Confirm Withdraw'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
