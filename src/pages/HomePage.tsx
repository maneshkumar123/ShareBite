import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Hero } from '@components/features/Hero';
import { HowItWorks } from '@components/features/HowItWorks';
import { WhyShareBite } from '@components/features/WhyShareBite';
import './HomePage.css';

const HomePage: React.FC = () => {
    const location = useLocation();

    useEffect(() => {
        const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
        if (scrollTo) {
            // Small delay so the DOM is ready
            setTimeout(() => {
                document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            // Clear the state so back-nav doesn't re-scroll
            window.history.replaceState({}, '');
        }
    }, [location.state]);

    return (
        <div className="home-page">
            {/* Premium Hero Section with Creative Apes Design */}
            <Hero />

            {/* Premium How It Works Section - Creative Apes Featured Projects Style */}
            <HowItWorks />

            {/* Why ShareBite Section - Innovation in Motion Style */}
            <WhyShareBite />
        </div>
    );
};

export default HomePage;
