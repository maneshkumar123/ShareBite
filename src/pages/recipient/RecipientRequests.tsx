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
                <p className="rreq-subtitle">{requests.length} request{requests.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="rreq-layout">
                {/* Left: List */}
                <div className={`rreq-list-panel ${showChat ? 'rreq-list-panel--hidden-mobile' : ''}`}>
                    {loading ? (
                        <div className="rreq-loading">
                            {[0,1,2].map(i => <div key={i} className="rreq-skeleton" style={{ animationDelay: `${i*80}ms` }} />)}
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="rreq-empty">
                            <p className="rreq-empty-title">No requests yet</p>
                            <p className="rreq-empty-sub">Browse listings and send a claim request to get started.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <button
                                key={req.id}
                                className={`rreq-card ${selectedId === req.id ? 'rreq-card--active' : ''}`}
                                onClick={() => handleSelect(req.id)}
                            >
                                <div className="rreq-card-top">
                                    <span className="rreq-card-title">{req.listingTitle}</span>
                                    {req.unreadCount > 0 && (
                                        <span className="rreq-unread">{req.unreadCount}</span>
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
                                    <span className="rreq-time">{formatRelative(req.lastMessageAt ?? req.createdAt)}</span>
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
                                ← Back to Requests
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
                            <p>Select a request to view the conversation</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecipientRequests;
