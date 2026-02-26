import React from 'react';
import { NavLink } from 'react-router-dom';
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

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconGrid = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

const IconList = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="6" x2="20" y2="6" />
        <line x1="9" y1="12" x2="20" y2="12" />
        <line x1="9" y1="18" x2="20" y2="18" />
        <circle cx="4" cy="6" r="1" />
        <circle cx="4" cy="12" r="1" />
        <circle cx="4" cy="18" r="1" />
    </svg>
);

const IconUser = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const IconSearch = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const IconHome = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

/* Brand mark: share-icon (3 nodes + 2 connecting lines) in a lime-green tile */
const BrandMark = () => (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#7DFF12" />
        <circle cx="9"  cy="14"   r="2.25" fill="#0B0B0B" />
        <circle cx="19" cy="8.5"  r="2.25" fill="#0B0B0B" />
        <circle cx="19" cy="19.5" r="2.25" fill="#0B0B0B" />
        <line x1="11.1" y1="13.1" x2="16.9" y2="9.5"  stroke="#0B0B0B" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="11.1" y1="14.9" x2="16.9" y2="18.5" stroke="#0B0B0B" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

// ─── Nav data ─────────────────────────────────────────────────────────────────

const DONOR_NAV: NavItem[] = [
    { path: ROUTES.DONOR_DASHBOARD, label: 'Dashboard',     icon: <IconGrid /> },
    { path: ROUTES.CREATE_LISTING,  label: 'New Listing',   icon: <IconPlus /> },
    { path: ROUTES.MY_LISTINGS,     label: 'My Listings',   icon: <IconList /> },
    { path: ROUTES.PROFILE,         label: 'Profile',       icon: <IconUser /> },
];

const RECIPIENT_NAV: NavItem[] = [
    { path: ROUTES.RECIPIENT_DASHBOARD, label: 'Dashboard',  icon: <IconGrid />   },
    { path: ROUTES.BROWSE_LISTINGS,     label: 'Browse Food', icon: <IconSearch /> },
    { path: ROUTES.RECIPIENT_PROFILE,   label: 'Profile',    icon: <IconUser />   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, userRole }) => {
    const navItems = userRole === 'donor' ? DONOR_NAV : RECIPIENT_NAV;
    const roleLabel = userRole === 'donor' ? 'Donor' : 'Recipient';
    const roleBadgeClass = userRole === 'donor' ? 'sb__role--donor' : 'sb__role--recipient';

    return (
        <aside className={`sb ${isOpen ? 'sb--open' : ''}`} aria-label="Sidebar navigation">

            {/* ── Logo ─────────────────────────────────────── */}
            <div className="sb__logo">
                <div className="sb__brand-block">
                    <span className="sb__brand-name">
                        <span className="sb__brand-light">Share</span><span className="sb__brand-bold">Bite</span>
                    </span>
                    <span className={`sb__role ${roleBadgeClass}`}>{roleLabel}</span>
                </div>
                <button className="sb__close" onClick={onClose} aria-label="Close menu">
                    <IconX />
                </button>
            </div>

            {/* ── Navigation ───────────────────────────────── */}
            <nav className="sb__nav" role="navigation">
                <p className="sb__section-label">Menu</p>
                <ul className="sb__list">
                    {navItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                onClick={onClose}
                                end={
                                    item.path === ROUTES.DONOR_DASHBOARD ||
                                    item.path === ROUTES.RECIPIENT_DASHBOARD
                                }
                                className={({ isActive }) =>
                                    `sb__link ${isActive ? 'sb__link--active' : ''}`
                                }
                            >
                                <span className="sb__link-icon">{item.icon}</span>
                                <span className="sb__link-label">{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* ── Footer ───────────────────────────────────── */}
            <div className="sb__footer">
                <NavLink to={ROUTES.HOME} className="sb__back-home" onClick={onClose}>
                    <span className="sb__link-icon"><IconHome /></span>
                    <span className="sb__link-label">Back to Home</span>
                </NavLink>
                <p className="sb__footer-copy">© 2025 ShareBite</p>
            </div>
        </aside>
    );
};
