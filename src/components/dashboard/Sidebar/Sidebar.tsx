/**
 * Sidebar Component
 * 
 * Navigation sidebar with:
 * - Logo/brand
 * - Navigation links
 * - Active state indication
 * - Mobile slide-in animation
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ROUTES } from '@utils/constants';
import './Sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    userRole: 'donor' | 'recipient';
}

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
}

// Donor navigation items
const DONOR_NAV_ITEMS: NavItem[] = [
    {
        path: ROUTES.DONOR_DASHBOARD,
        label: 'Dashboard',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
    },
    {
        path: ROUTES.CREATE_LISTING,
        label: 'Create Listing',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
        ),
    },
    {
        path: '/donor/listings',
        label: 'My Listings',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
        ),
    },
    {
        path: ROUTES.PROFILE,
        label: 'Profile',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, userRole }) => {
    const location = useLocation();
    const navItems = userRole === 'donor' ? DONOR_NAV_ITEMS : DONOR_NAV_ITEMS; // TODO: Add recipient items

    return (
        <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
            {/* Header with Close Button (Mobile) */}
            <div className="sidebar__header">
                <div className="sidebar__brand">
                    <span className="sidebar__logo">🍽️</span>
                    <span className="sidebar__brand-text">ShareBite</span>
                </div>
                <button
                    className="sidebar__close"
                    onClick={onClose}
                    aria-label="Close menu"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            {/* Navigation Links */}
            <nav className="sidebar__nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `sidebar__link ${isActive || location.pathname === item.path ? 'sidebar__link--active' : ''}`
                        }
                    >
                        <span className="sidebar__link-icon">{item.icon}</span>
                        <span className="sidebar__link-text">{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="sidebar__footer">
                <NavLink to={ROUTES.HOME} className="sidebar__link sidebar__link--home">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span>Back to Home</span>
                </NavLink>
            </div>
        </aside>
    );
};
