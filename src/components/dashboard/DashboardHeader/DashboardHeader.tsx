/**
 * Dashboard Header Component
 * 
 * Top navigation bar with:
 * - Hamburger menu (mobile)
 * - Page title / breadcrumb
 * - User avatar and name
 * - Logout button
 */

import React from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@utils/constants';
import './DashboardHeader.css';

interface DashboardHeaderProps {
    onMenuClick: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate(ROUTES.LOGIN);
    };

    const userInitial = user?.fullName?.charAt(0).toUpperCase() || 'U';

    return (
        <header className="dashboard-header">
            {/* Left: Menu Button (Mobile) + Title */}
            <div className="dashboard-header__left">
                <button
                    className="dashboard-header__menu-btn"
                    onClick={onMenuClick}
                    aria-label="Toggle menu"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                </button>
                <h1 className="dashboard-header__title">Dashboard</h1>
            </div>

            {/* Right: User Info + Logout */}
            <div className="dashboard-header__right">
                <div className="dashboard-header__user">
                    <div className="dashboard-header__avatar">
                        {user?.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.fullName} />
                        ) : (
                            <span>{userInitial}</span>
                        )}
                    </div>
                    <span className="dashboard-header__name">{user?.fullName || 'User'}</span>
                </div>
                <button
                    className="dashboard-header__logout"
                    onClick={handleLogout}
                    aria-label="Sign out"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                </button>
            </div>
        </header>
    );
};
