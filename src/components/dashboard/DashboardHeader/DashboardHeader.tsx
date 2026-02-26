/**
 * Dashboard Header Component
 *
 * Top navigation bar with:
 * - Hamburger menu (mobile)
 * - Page title
 * - Notification bell with real-time updates
 * - User avatar and name
 * - Logout button
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES, PAGE_TITLES } from '@utils/constants';
import { notificationService } from '@services/notificationService';
import type { AppNotification } from '@services/notificationService';
import './DashboardHeader.css';

interface DashboardHeaderProps {
    onMenuClick: () => void;
}

const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
};

const BellIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const MenuIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="20" height="20">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="14" y2="17" />
    </svg>
);

const SignOutIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const channelRef = useRef<ReturnType<typeof notificationService.subscribeToNotifications> | null>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        setLoadingNotifs(true);
        const result = await notificationService.getNotifications(user.id);
        if (result.success && result.data) setNotifications(result.data);
        setLoadingNotifs(false);
    }, [user]);

    useEffect(() => {
        if (!user) return;
        loadNotifications();
        channelRef.current = notificationService.subscribeToNotifications(user.id, (newNotif) => {
            setNotifications(prev => [newNotif, ...prev].slice(0, 20));
        });
        return () => {
            if (channelRef.current) notificationService.unsubscribe(channelRef.current);
        };
    }, [user, loadNotifications]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifs(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleMarkAllRead = async () => {
        if (!user) return;
        await notificationService.markAllRead(user.id);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleNotifClick = async (notif: AppNotification) => {
        if (!notif.read) {
            await notificationService.markOneRead(notif.id);
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        }
        setShowNotifs(false);
        if (notif.listingId) navigate(`/listing/${notif.listingId}`);
    };

    const handleLogout = async () => {
        await logout();
        navigate(ROUTES.LOGIN);
    };

    const userInitial = user?.fullName?.charAt(0).toUpperCase() || 'U';
    const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

    return (
        <header className="dh">
            {/* Left: Hamburger + Title */}
            <div className="dh__left">
                <button className="dh__menu-btn" onClick={onMenuClick} aria-label="Toggle menu">
                    <MenuIcon />
                </button>
                <h1 className="dh__title">{pageTitle}</h1>
            </div>

            {/* Right: Bell + User + Logout */}
            <div className="dh__right">

                {/* Notifications */}
                <div className="dh__notif-wrap" ref={notifRef}>
                    <button
                        className="dh__icon-btn"
                        onClick={() => setShowNotifs(prev => !prev)}
                        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                    >
                        <BellIcon />
                        {unreadCount > 0 && (
                            <span className="dh__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>

                    {showNotifs && (
                        <div className="dh__notif-panel" role="dialog" aria-label="Notifications">
                            <div className="dh__notif-header">
                                <span className="dh__notif-heading">Notifications</span>
                                {unreadCount > 0 && (
                                    <button className="dh__notif-mark-read" onClick={handleMarkAllRead}>
                                        Mark all read
                                    </button>
                                )}
                            </div>
                            <div className="dh__notif-list">
                                {loadingNotifs ? (
                                    <p className="dh__notif-empty">Loading…</p>
                                ) : notifications.length === 0 ? (
                                    <p className="dh__notif-empty">No notifications yet</p>
                                ) : (
                                    notifications.map(notif => (
                                        <button
                                            key={notif.id}
                                            className={`dh__notif-item ${!notif.read ? 'dh__notif-item--unread' : ''}`}
                                            onClick={() => handleNotifClick(notif)}
                                        >
                                            <span className="dh__notif-emoji" aria-hidden="true">
                                                {notif.type === 'new_listing' ? '🍽️' : '✅'}
                                            </span>
                                            <div className="dh__notif-body">
                                                <p className="dh__notif-item-title">{notif.title}</p>
                                                <p className="dh__notif-item-msg">{notif.message}</p>
                                                <p className="dh__notif-item-time">{formatTimeAgo(notif.createdAt)}</p>
                                            </div>
                                            {!notif.read && <span className="dh__notif-dot" aria-hidden="true" />}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <span className="dh__divider" aria-hidden="true" />

                {/* User */}
                <div className="dh__user">
                    <div className="dh__avatar" aria-hidden="true">
                        {user?.avatarUrl
                            ? <img src={user.avatarUrl} alt={user.fullName} />
                            : <span>{userInitial}</span>
                        }
                    </div>
                    <span className="dh__user-name">{user?.fullName || 'User'}</span>
                </div>

                {/* Sign Out */}
                <button className="dh__signout" onClick={handleLogout} aria-label="Sign out">
                    <SignOutIcon />
                    <span>Sign out</span>
                </button>
            </div>
        </header>
    );
};
