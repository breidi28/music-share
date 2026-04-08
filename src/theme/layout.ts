/**
 * Layout & Design Tokens
 * Aligned with Apple Human Interface Guidelines
 */

export const Layout = {
    // Spacing scale (4px base unit)
    space: {
        0: 0,
        1: 4,
        2: 8,
        3: 12,
        4: 16,
        5: 20,
        6: 24,
        8: 32,
        10: 40,
        12: 48,
    },

    // Border radius
    radius: {
        none: 0,
        sm: 8,
        md: 10,
        lg: 12,
        xl: 16,
        '2xl': 20,
        '3xl': 24,
        pill: 9999,
    },

    // Touch targets (HIG minimum 44x44pt)
    touch: {
        minTarget: 44,
        iconButton: 44,
        largeButton: 52,
        smallButton: 36,
    },

    // Borders
    border: {
        hairline: 0.5,
        thin: 1,
        thick: 2,
    },

    // Typography scale
    font: {
        xs: 11,
        sm: 13,
        md: 15,
        lg: 17,
        xl: 20,
        '2xl': 22,
        '3xl': 28,
        '4xl': 34,
    },

    // Font weights
    weight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
    },
};

export const Surface = {
    // Dark mode surfaces
    page: '#000000',
    card: '#1C1C1E',
    cardAlt: '#2C2C2E',
    cardElevated: '#3A3A3C',
    input: '#2C2C2E',
    modal: '#1C1C1E',

    // Borders
    borderSoft: 'rgba(255,255,255,0.06)',
    borderMedium: 'rgba(255,255,255,0.1)',
    borderStrong: 'rgba(255,255,255,0.15)',
    separator: 'rgba(84, 84, 88, 0.65)',

    // Overlays
    overlay: 'rgba(0,0,0,0.4)',
    overlayStrong: 'rgba(0,0,0,0.7)',
};

export const TextScale = {
    // iOS-style type scale
    largeTitle: 34,
    title1: 28,
    title2: 22,
    title3: 20,
    headline: 17,
    body: 17,
    callout: 16,
    subhead: 15,
    footnote: 13,
    caption1: 12,
    caption2: 11,

    // Aliases
    hero: 34,
    title: 22,
    label: 15,
    bodySm: 13,
    caption: 11,
};

// Line heights for better readability
export const LineHeight = {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
};
