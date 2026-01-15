import React, { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/index';
import { ROUTES } from '@utils/constants';
import './Header.css';

export const Header: React.FC = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
        // Theme toggle logic will be implemented later
    };

    /**
     * Scroll to a section by ID with smooth animation
     */
    const scrollToSection = useCallback((sectionId: string) => {
        if (sectionId === 'top') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);

    /**
     * Handle navigation to sections - works from ANY page
     * If on home page: just scroll
     * If on other page: navigate to home first, then scroll
     */
    const handleSectionNavigation = useCallback((e: React.MouseEvent, sectionId: string) => {
        e.preventDefault();

        const isOnHomePage = location.pathname === '/' || location.pathname === '';

        if (isOnHomePage) {
            // Already on home page - just scroll
            scrollToSection(sectionId);
        } else {
            // On another page - navigate to home first, then scroll
            // Use state to pass the section ID to scroll to after navigation
            navigate('/', { state: { scrollTo: sectionId } });

            // Use setTimeout to scroll after navigation completes
            setTimeout(() => {
                scrollToSection(sectionId);
            }, 100);
        }
    }, [location.pathname, navigate, scrollToSection]);

    // Navigation links configuration - only include sections that exist
    const navLinks = [
        { path: '/#top', label: 'Home', isHash: true, sectionId: 'top' },
        { path: '/#how-it-works', label: 'How It Works', isHash: true, sectionId: 'how-it-works' },
        { path: '/#why-sharebite', label: 'About', isHash: true, sectionId: 'why-sharebite' },
        { path: '/#contact', label: 'Contact', isHash: true, sectionId: 'contact' },
        ...(isAuthenticated
            ? [
                {
                    path:
                        user?.role === 'donor' ? ROUTES.DONOR_DASHBOARD : ROUTES.RECIPIENT_DASHBOARD,
                    label: 'Dashboard',
                    isHash: false,
                    sectionId: '',
                },
            ]
            : []),
    ];

    return (
        <header className="header">
            <nav className="nav">
                {/* Logo Section (Left) */}
                <Link to={ROUTES.HOME} className="logo-link">
                    <div className="logo-container">
                        <h1 className="logo-text">ShareBite</h1>
                    </div>
                </Link>

                {/* Navigation Links (Center) */}
                <div className="nav-links-container">
                    {navLinks.map(link => {
                        if (link.isHash) {
                            return (
                                <a
                                    key={link.path}
                                    href={link.path}
                                    onClick={(e) => handleSectionNavigation(e, link.sectionId)}
                                    className={`nav-link ${location.pathname === '/' && location.hash === `#${link.sectionId}` ? 'active' : ''}`}
                                >
                                    <div className="rolling-text">
                                        <span className="rolling-text-main">{link.label}</span>
                                        <span className="rolling-text-shadow">{link.label}</span>
                                    </div>
                                </a>
                            );
                        }

                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                            >
                                <div className="rolling-text">
                                    <span className="rolling-text-main">{link.label}</span>
                                    <span className="rolling-text-shadow">{link.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* Right Section - Auth Buttons or Theme Toggle */}
                <div className="nav-actions">
                    {!isAuthenticated ? (
                        <>
                            <Link to={ROUTES.LOGIN} className="nav-btn-text">
                                Login
                            </Link>
                            <Link to={ROUTES.REGISTER} className="nav-btn-primary">
                                Get Started
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to={ROUTES.PROFILE} className="nav-btn-text">
                                Profile
                            </Link>
                            <button onClick={logout} className="nav-btn-text">
                                Logout
                            </button>
                            <button
                                type="button"
                                className="theme-toggle-btn"
                                onClick={toggleTheme}
                                aria-label="Toggle theme"
                            >
                                {theme === 'dark' ? '☀️' : '🌙'}
                            </button>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
};
