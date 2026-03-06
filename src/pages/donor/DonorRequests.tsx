import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { requestService } from '@services/requestService';
import type { ClaimRequestSummary, ClaimRequestStatus } from '@services/requestService';
import { ClaimRequestChat } from '@components/requests/ClaimRequestChat';
import './DonorRequests.css';

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
    rejected: 'Declined',
    withdrawn: 'Withdrawn',
};

const DonorRequests: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<ClaimRequestSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending'>('pending');

    const loadRequests = useCallback(async () => {
        if (!user) return;
        const res = await requestService.getDonorRequests(user.id);
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

    const filtered = filter === 'pending'
        ? requests.filter(r => r.status === 'pending')
        : requests;

    // Group by listing
    const grouped: Record<string, ClaimRequestSummary[]> = {};
    filtered.forEach(r => {
        if (!grouped[r.listingId]) grouped[r.listingId] = [];
        grouped[r.listingId].push(r);
    });

    const pendingCount = requests.filter(r => r.status === 'pending').length;

    return (
        <div className="dreq-page">
            <div className="dreq-header">
                <div>
                    <h1>Requests</h1>
                    <p className="dreq-subtitle">
                        {pendingCount} pending request{pendingCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="dreq-tabs">
                    <button
                        className={`dreq-tab ${filter === 'pending' ? 'dreq-tab--active' : ''}`}
                        onClick={() => setFilter('pending')}
                    >
                        Pending
                    </button>
                    <button
                        className={`dreq-tab ${filter === 'all' ? 'dreq-tab--active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                </div>
            </div>

            <div className="dreq-layout">
                {/* Left: List */}
                <div className={`dreq-list-panel ${showChat ? 'dreq-list-panel--hidden-mobile' : ''}`}>
                    {loading ? (
                        <div className="dreq-loading">
                            {[0,1,2].map(i => <div key={i} className="dreq-skeleton" style={{ animationDelay: `${i*80}ms` }} />)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="dreq-empty">
                            <p className="dreq-empty-title">
                                {filter === 'pending' ? 'No pending requests' : 'No requests yet'}
                            </p>
                            <p className="dreq-empty-sub">
                                {filter === 'pending'
                                    ? 'Recipients will appear here when they request your listings.'
                                    : 'Switch to "Pending" to see active requests.'}
                            </p>
                        </div>
                    ) : (
                        Object.entries(grouped).map(([listingId, reqs]) => (
                            <div key={listingId} className="dreq-group">
                                <p className="dreq-group-label">{reqs[0].listingTitle}</p>
                                {reqs.map(req => (
                                    <button
                                        key={req.id}
                                        className={`dreq-card ${selectedId === req.id ? 'dreq-card--active' : ''}`}
                                        onClick={() => handleSelect(req.id)}
                                    >
                                        <div className="dreq-card-top">
                                            <span className="dreq-card-name">
                                                {req.recipientName}
                                                {req.recipientOrgName && (
                                                    <span className="dreq-card-org"> · {req.recipientOrgName}</span>
                                                )}
                                            </span>
                                            {req.unreadCount > 0 && (
                                                <span className="dreq-unread">{req.unreadCount}</span>
                                            )}
                                        </div>
                                        {req.lastMessageBody && (
                                            <p className="dreq-card-snippet">{req.lastMessageBody}</p>
                                        )}
                                        <div className="dreq-card-footer">
                                            <span className={`dreq-status dreq-status--${req.status}`}>
                                                {STATUS_LABEL[req.status]}
                                            </span>
                                            <span className="dreq-time">{formatRelative(req.lastMessageAt ?? req.createdAt)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {/* Right: Chat */}
                <div className={`dreq-chat-panel ${!showChat ? 'dreq-chat-panel--hidden-mobile' : ''}`}>
                    {selectedId && user ? (
                        <div className="dreq-chat-wrap" style={{ position: 'relative' }}>
                            <button className="dreq-back-btn" onClick={() => setShowChat(false)}>
                                ← Back to Requests
                            </button>
                            <ClaimRequestChat
                                requestId={selectedId}
                                currentUserId={user.id}
                                userRole="donor"
                                onStatusChange={handleStatusChange}
                                onAccept={() => loadRequests()}
                                onReject={() => loadRequests()}
                            />
                        </div>
                    ) : (
                        <div className="dreq-empty-chat">
                            <p>Select a request to review and chat</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DonorRequests;
