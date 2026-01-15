import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import './MainLayout.css';

/**
 * RootLayout - Industry-standard persistent layout using React Router's Outlet
 * 
 * Header and Footer render ONCE and persist across route changes.
 * Only the content inside <Outlet /> changes when navigating.
 * 
 * This prevents unnecessary re-renders and provides smooth navigation.
 */
export const RootLayout: React.FC = () => {
    return (
        <div className="main-layout">
            <Header />
            <main className="main-content">
                <Outlet />
            </main>
            <Footer />
        </div>
    );
};

/**
 * @deprecated Use RootLayout with Outlet pattern instead.
 * Kept for backward compatibility during migration.
 */
interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="main-layout">
            <Header />
            <main className="main-content">
                {children}
            </main>
            <Footer />
        </div>
    );
};
