import React, { useEffect, useRef, useState, useCallback } from 'react';
import stepListSurplus from '@assets/step_list_surplus.png';
import stepMatching from '@assets/step_matching.png';
import stepPickup from '@assets/step_pickup.png';
import './HowItWorks.css';

// Step data for ShareBite
const STEPS = [
    {
        number: '01',
        title: 'List Your Surplus',
        description: 'Restaurants and cafés post available food with photos, quantity, and pickup window',
        image: stepListSurplus,
        alt: 'Restaurant listing surplus food on ShareBite platform',
    },
    {
        number: '02',
        title: 'Real-Time Matching',
        description: 'Geolocation connects nearby recipients with fresh, available food instantly',
        image: stepMatching,
        alt: 'Map showing real-time food matching with nearby recipients',
    },
    {
        number: '03',
        title: 'Easy Pickup',
        description: 'Recipients collect food before it expires, reducing waste and feeding communities',
        image: stepPickup,
        alt: 'Person receiving food from restaurant donor',
    },
];

// ============================================
// ANIMATION UTILITIES
// ============================================

// Smooth linear interpolation - creates butter-smooth transitions
const lerp = (start: number, end: number, factor: number): number => {
    return start + (end - start) * factor;
};

// Custom easing function - smoother than cubic
const easeOutExpo = (t: number): number => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

// Ease in-out with more natural curve (reserved for future use)
// const easeInOutQuart = (t: number): number => {
//     return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
// };

// Clamp value between min and max
const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
};

// ============================================
// STEP CARD COMPONENT
// ============================================

interface StepCardProps {
    step: (typeof STEPS)[0];
}

const StepCard: React.FC<StepCardProps> = ({ step }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // Animation state with smooth transitions
    const [animState, setAnimState] = useState({
        opacity: 0.15, // Start slightly visible for better UX
        scale: 0.92,
        translateY: 80,
        imageParallax: 0,
    });

    // Target values (calculated from scroll)
    const targetRef = useRef({
        opacity: 0.15,
        scale: 0.92,
        translateY: 80,
        imageParallax: 0,
    });

    // Animation frame reference
    const rafRef = useRef<number | null>(null);

    // Calculate target values based on scroll position
    const calculateTargets = useCallback(() => {
        if (!cardRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Calculate scroll progress (0-1)
        // More refined calculation for smoother transitions
        const cardCenter = rect.top + rect.height / 2;
        const viewportCenter = windowHeight / 2;
        const distanceFromCenter = cardCenter - viewportCenter;
        const normalizedDistance = distanceFromCenter / windowHeight;

        // Progress: -1 (above viewport) to 0 (center) to 1 (below viewport)
        const progress = clamp(normalizedDistance, -1, 1);

        // Apply easing for smoother feel
        const easedProgress = easeOutExpo(1 - Math.abs(progress));

        // ===== OPACITY =====
        // Peak at center (1.0), fade at edges
        const opacity = clamp(0.15 + easedProgress * 0.85, 0.15, 1);

        // ===== SCALE =====
        // Subtle scale: 0.92 → 1.0 at center
        const scale = 0.92 + easedProgress * 0.08;

        // ===== TRANSLATE Y =====
        // Moves from +80px (below) to 0 (center) to -30px (above)
        const translateY = progress * 60;

        // ===== IMAGE PARALLAX =====
        // Subtle parallax effect on image (moves opposite to card)
        const imageParallax = progress * -20;

        targetRef.current = { opacity, scale, translateY, imageParallax };
    }, []);

    // Smooth animation loop with lerp
    const animate = useCallback(() => {
        const lerpFactor = 0.08; // Lower = smoother but slower

        setAnimState(prev => ({
            opacity: lerp(prev.opacity, targetRef.current.opacity, lerpFactor),
            scale: lerp(prev.scale, targetRef.current.scale, lerpFactor),
            translateY: lerp(prev.translateY, targetRef.current.translateY, lerpFactor),
            imageParallax: lerp(prev.imageParallax, targetRef.current.imageParallax, lerpFactor),
        }));

        rafRef.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        // Calculate initial targets
        calculateTargets();

        // Start animation loop
        rafRef.current = requestAnimationFrame(animate);

        // Update targets on scroll
        const handleScroll = () => {
            calculateTargets();
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [animate, calculateTargets]);

    return (
        <div
            ref={cardRef}
            className="step-card"
            style={{
                opacity: animState.opacity,
                transform: `scale(${animState.scale}) translateY(${animState.translateY}px)`,
            }}
        >
            {/* Card Header: Title + Description + CTA */}
            <div className="step-card-header">
                <div className="step-card-content">
                    <span className="step-number">Step {step.number}</span>
                    <h4 className="step-title">{step.title}</h4>
                    <p className="step-description">{step.description}</p>
                </div>
                <div className="step-cta-button">
                    <svg width="45" height="45" viewBox="0 0 45 45" fill="none">
                        <circle cx="22.5" cy="22.5" r="22" stroke="currentColor" strokeWidth="1" />
                        <path
                            d="M16 22.5h13M25 18l4.5 4.5-4.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>

            {/* Card Image with Parallax */}
            <div className="step-image-container">
                <img
                    ref={imageRef}
                    src={step.image}
                    alt={step.alt}
                    className="step-image"
                    style={{
                        transform: `translateY(${animState.imageParallax}px) scale(1.05)`,
                    }}
                />
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const HowItWorks: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);

    return (
        <section id="how-it-works" className="how-it-works-section" ref={sectionRef}>
            {/* Top Section Divider Line */}
            <div className="section-divider-line" />

            {/* Continuous Marquee Headline - Infinite scrolling ticker */}
            <div className="headline-wrapper">
                <div className="marquee-track">
                    {/* First set of headlines */}
                    <div className="marquee-content">
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                        <h2 className="headline-text">how do we do it?©</h2>
                        <span className="marquee-separator">✦</span>
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                    </div>
                    {/* Duplicate for seamless loop */}
                    <div className="marquee-content" aria-hidden="true">
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                        <h2 className="headline-text">how it works©</h2>
                        <span className="marquee-separator">✦</span>
                    </div>
                </div>
            </div>

            {/* Bottom Section Divider Line */}
            <div className="section-divider-line" />

            {/* Section Header */}
            <div className="how-it-works-header">
                <h5 className="header-left">© How It Works</h5>
                <span className="header-middle">(SB® — 03)</span>
                <span className="header-right">Simple Process</span>
            </div>

            {/* Step Cards Container */}
            <div className="steps-container">
                {STEPS.map((step) => (
                    <StepCard key={step.number} step={step} />
                ))}
            </div>
        </section>
    );
};
