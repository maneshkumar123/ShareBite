/**
 * Dashboard Layout Component
 * 
 * Shell layout for dashboard pages with:
 * - Sidebar navigation (collapsible on mobile)
 * - Top header with user info
 * - Main content area via Outlet
 * 
 * Uses Outlet pattern for persistent layout (like RootLayout for public pages).
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { DashboardHeader } from '../DashboardHeader/DashboardHeader';
import { Sidebar } from '../Sidebar/Sidebar';
import './DashboardLayout.css';

interface DashboardLayoutProps {
    userRole: 'donor' | 'recipient';
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ userRole }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="dashboard-layout">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="dashboard-overlay"
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={closeSidebar}
                userRole={userRole}
            />

            {/* Main Content Area */}
            <div className="dashboard-main">
                {/* Header */}
                <DashboardHeader onMenuClick={toggleSidebar} />

                {/* Page Content - Renders nested routes */}
                <main className="dashboard-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
