import React, { useEffect, useRef, useState, useCallback } from 'react';
import './WhyShareBite.css';

// ============================================
// IMAGE DATA
// ============================================

const CAROUSEL_IMAGES = [
    { src: '/src/assets/why_realtime.png', alt: 'Real-time coordination dashboard' },
    { src: '/src/assets/why_geolocation.png', alt: 'Geolocation matching map' },
    { src: '/src/assets/why_impact.png', alt: 'Social impact community' },
    { src: '/src/assets/why_automation.png', alt: 'Automated expiry system' },
];

// ============================================
// ANIMATION UTILITIES
// ============================================

const lerp = (start: number, end: number, factor: number): number => {
    return start + (end - start) * factor;
};

const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
};

const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// ============================================
// MAIN COMPONENT
// ============================================

export const WhyShareBite: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    // Animation state (scrollProgress reserved for debug)
    // const [scrollProgress, setScrollProgress] = useState(0);

    // Current animated values
    const [animValues, setAnimValues] = useState({
        headlineOpacity: 0,
        headlineScale: 0.95,
        headlineTranslateY: 30,
        carouselTranslateY: 0,
    });

    // Target values (updated on scroll)
    const targetRef = useRef({
        headlineOpacity: 0,
        headlineScale: 0.95,
        headlineTranslateY: 30,
        carouselTranslateY: 0,
    });

    // Calculate animation targets based on scroll
    const calculateTargets = useCallback(() => {
        if (!sectionRef.current) return;

        const rect = sectionRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        // Calculate scroll progress: 0 = section entering, 1 = section exiting
        const sectionVisibility = (windowHeight - rect.top) / (windowHeight + rect.height);
        const progress = clamp(sectionVisibility, 0, 1);
        // setScrollProgress(progress); // Uncomment for debugging

        // Apply easing
        const eased = easeInOutCubic(progress);

        // Headline animation: fade in (0-0.3), visible (0.3-0.7), fade out (0.7-1)
        let headlineOpacity = 1;
        if (progress < 0.2) {
            headlineOpacity = progress / 0.2; // Fade in
        } else if (progress > 0.8) {
            headlineOpacity = (1 - progress) / 0.2; // Fade out
        }

        // Scale: 0.95 → 1.0 → 0.95
        const headlineScale = 0.95 + eased * 0.05;

        // TranslateY: 30 → 0 → -30
        const headlineTranslateY = 30 - eased * 60;

        // Image carousel: parallax scroll (images move UP as user scrolls DOWN)
        // Total image stack height: 4 images × 270px + gaps = ~1200px
        // Viewport is ~385px, so max translate is ~800px
        const maxCarouselTranslate = 600; // Pixels to move
        const parallaxFactor = 0.8; // Images move slower than scroll
        const carouselTranslateY = -(progress * maxCarouselTranslate * parallaxFactor);

        targetRef.current = {
            headlineOpacity: clamp(headlineOpacity, 0, 1),
            headlineScale: clamp(headlineScale, 0.95, 1),
            headlineTranslateY,
            carouselTranslateY,
        };
    }, []);

    // Smooth animation loop
    const animate = useCallback(() => {
        const lerpFactor = 0.08;

        setAnimValues((prev) => ({
            headlineOpacity: lerp(prev.headlineOpacity, targetRef.current.headlineOpacity, lerpFactor),
            headlineScale: lerp(prev.headlineScale, targetRef.current.headlineScale, lerpFactor),
            headlineTranslateY: lerp(prev.headlineTranslateY, targetRef.current.headlineTranslateY, lerpFactor),
            carouselTranslateY: lerp(prev.carouselTranslateY, targetRef.current.carouselTranslateY, lerpFactor),
        }));

        rafRef.current = requestAnimationFrame(animate);
    }, []);

    // Setup scroll listener and animation loop
    useEffect(() => {
        calculateTargets();
        rafRef.current = requestAnimationFrame(animate);

        const handleScroll = () => calculateTargets();
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [animate, calculateTargets]);

    return (
        <section id="why-sharebite" className="why-section" ref={sectionRef}>
            {/* Top Section Divider Line */}
            <div className="why-divider" />

            {/* Continuous Marquee Headline - Matches HowItWorks style */}
            <div className="why-headline-wrapper">
                <div className="why-marquee-track">
                    {/* First set of headlines */}
                    <div className="why-marquee-content">
                        <h2 className="why-marquee-text">why sharebite©</h2>
                        <span className="why-marquee-separator">✦</span>
                        <h2 className="why-marquee-text">bridging the gap©</h2>
                        <span className="why-marquee-separator">✦</span>
                        <h2 className="why-marquee-text">why sharebite©</h2>
                        <span className="why-marquee-separator">✦</span>
                    </div>
                    {/* Duplicate for seamless loop */}
                    <div className="why-marquee-content" aria-hidden="true">
                        <h2 className="why-marquee-text">why sharebite©</h2>
                        <span className="why-marquee-separator">✦</span>
                        <h2 className="why-marquee-text">bridging the gap©</h2>
                        <span className="why-marquee-separator">✦</span>
                        <h2 className="why-marquee-text">why sharebite©</h2>
                        <span className="why-marquee-separator">✦</span>
                    </div>
                </div>
            </div>

            {/* Bottom Divider Line */}
            <div className="why-divider" />

            {/* Section Header - 3 Part Layout */}
            <div className="why-section-header">
                <h5 className="why-header-left">© Why ShareBite</h5>
                <span className="why-header-middle">(SB® — 04)</span>
                <span className="why-header-right">Our Mission</span>
            </div>

            {/* Split Headlines with scroll animation */}
            <h2
                className="why-headline why-headline-top"
                style={{
                    opacity: animValues.headlineOpacity,
                    transform: `scale(${animValues.headlineScale}) translateY(${animValues.headlineTranslateY}px)`,
                }}
            >
                Bridging
            </h2>

            {/* Main Content: Two Columns */}
            <div className="why-content">
                {/* LEFT: Image Carousel */}
                <div className="why-carousel-container">
                    <div
                        ref={carouselRef}
                        className="why-carousel-track"
                        style={{
                            transform: `translateY(${animValues.carouselTranslateY}px)`,
                        }}
                    >
                        {CAROUSEL_IMAGES.map((image, index) => (
                            <div
                                key={index}
                                className="why-carousel-item"
                                style={{
                                    top: `${index * 300}px`, // 280px height + 20px gap
                                }}
                            >
                                <img
                                    src={image.src}
                                    alt={image.alt}
                                    className="why-carousel-image"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Text + Button */}
                <div className="why-text-column">
                    <div className="why-text-content">
                        <p className="why-paragraph">
                            Commercial platforms prioritise efficiency but exclude vulnerable
                            users. Community platforms lack automation and scalability. NGO
                            systems lack real-time responsiveness.
                        </p>
                        <p className="why-paragraph why-paragraph-bold">
                            ShareBite combines real-time digital coordination,
                            geolocation-based matching, and automated expiry systems with an
                            explicit social impact orientation.
                        </p>
                    </div>
                    <a href="/about" className="why-button">
                        Learn More
                    </a>
                </div>
            </div>

            {/* Bottom Headline: "the gap." */}
            <h2
                className="why-headline why-headline-bottom"
                style={{
                    opacity: animValues.headlineOpacity,
                    transform: `scale(${animValues.headlineScale}) translateY(${-animValues.headlineTranslateY}px)`,
                }}
            >
                the gap.
            </h2>

            {/* Final Divider - Headlines sit above this */}
            <div className="why-divider why-divider-bottom" />
        </section>
    );
};
