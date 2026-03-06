import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { requestService } from '@services/requestService';
import type { ClaimRequestSummary, ClaimRequestStatus } from '@services/requestService';
import { ClaimRequestChat } from '@components/requests/ClaimRequestChat';
import './RecipientRequests.css';

const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const STATUS_LABEL: Record<ClaimRequestStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Not Accepted',
    withdrawn: 'Withdrawn',
};

/** Simple line-art envelope SVG for the empty state */
const EnvelopeIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 48 }) => (
    <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <rect x="4" y="10" width="40" height="28" rx="3" />
        <polyline points="4,10 24,28 44,10" />
        <line x1="4" y1="38" x2="18" y2="26" />
        <line x1="44" y1="38" x2="30" y2="26" />
    </svg>
);

/** Chat bubble SVG for the empty chat panel */
const ChatBubbleIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 56 }) => (
    <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 56 56"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M8 10h32a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" />
        <line x1="14" y1="20" x2="34" y2="20" />
        <line x1="14" y1="26" x2="28" y2="26" />
    </svg>
);

const RecipientRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ClaimRequestSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);

    const loadRequests = useCallback(async () => {
        if (!user) return;
        const res = await requestService.getMyRequests(user.id);
        if (res.success && res.data) setRequests(res.data);
        setLoading(false);
    }, [user]);

    useEffect(() => { loadRequests(); }, [loadRequests]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        setShowChat(true);
    };

    const handleStatusChange = (newStatus: ClaimRequestStatus) => {
        setRequests(prev => prev.map(r => r.id === selectedId ? { ...r, status: newStatus, unreadCount: 0 } : r));
    };

    return (
        <div className="rreq-page">
            <div className="rreq-header">
                <h1>My Requests</h1>
                <p className="rreq-subtitle">
                    {loading ? 'Loading...' : `${requests.length} request${requests.length !== 1 ? 's' : ''}`}
                </p>
            </div>

            <div className="rreq-layout">
                {/* Left: List */}
                <div className={`rreq-list-panel ${showChat ? 'rreq-list-panel--hidden-mobile' : ''}`}>
                    {loading ? (
                        <div className="rreq-loading">
                            {[0, 1, 2].map(i => (
                                <div
                                    key={i}
                                    className="rreq-skeleton"
                                    style={{ animationDelay: `${i * 80}ms` }}
                                />
                            ))}
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="rreq-empty">
                            <EnvelopeIcon className="rreq-empty-icon" size={48} />
                            <p className="rreq-empty-title">No requests yet</p>
                            <p className="rreq-empty-sub">
                                Browse listings and send a claim request to get started.
                            </p>
                        </div>
                    ) : (
                        requests.map((req, i) => (
                            <button
                                key={req.id}
                                className={`rreq-card ${selectedId === req.id ? 'rreq-card--active' : ''}`}
                                onClick={() => handleSelect(req.id)}
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                <div className="rreq-card-top">
                                    <span className="rreq-card-title">{req.listingTitle}</span>
                                    {req.unreadCount > 0 && (
                                        <span className="rreq-unread" aria-label={`${req.unreadCount} unread`} />
                                    )}
                                </div>
                                <p className="rreq-card-donor">{req.donorName}</p>
                                {req.lastMessageBody && (
                                    <p className="rreq-card-snippet">{req.lastMessageBody}</p>
                                )}
                                <div className="rreq-card-footer">
                                    <span className={`rreq-status rreq-status--${req.status}`}>
                                        {STATUS_LABEL[req.status]}
                                    </span>
                                    <span className="rreq-time">
                                        {formatRelative(req.lastMessageAt ?? req.createdAt)}
                                    </span>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {/* Right: Chat */}
                <div className={`rreq-chat-panel ${!showChat ? 'rreq-chat-panel--hidden-mobile' : ''}`}>
                    {selectedId && user ? (
                        <div className="rreq-chat-wrap" style={{ position: 'relative' }}>
                            <button className="rreq-back-btn" onClick={() => setShowChat(false)}>
                                &larr; Back to Requests
                            </button>
                            <ClaimRequestChat
                                requestId={selectedId}
                                currentUserId={user.id}
                                userRole="recipient"
                                onStatusChange={handleStatusChange}
                                onWithdraw={() => loadRequests()}
                            />
                        </div>
                    ) : (
                        <div className="rreq-empty-chat">
                            <ChatBubbleIcon className="rreq-empty-chat-icon" size={56} />
                            <p>Select a request to view the conversation</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecipientRequests;
