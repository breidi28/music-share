export const Colors = {
    // Base dark palette
    bg: '#0A0A0F',
    bgCard: '#12121A',
    bgElevated: '#1A1A26',
    bgModal: '#1E1E2E',

    // Accent – Apple Music style Red/Pink
    primary: '#FA243C',
    primaryLight: '#FF3B50',
    primaryDark: '#D6001B',
    secondary: '#FA243C',
    secondaryLight: '#FF3B50',

    // Status
    nowPlaying: '#10B981',   // green – currently listening
    loved: '#EC4899',        // pink – loved/liked
    history: '#6366F1',      // indigo – history

    // Text
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
    textInverse: '#0A0A0F',

    // UI
    border: '#1E1E2E',
    divider: '#1A1A26',
    overlay: 'rgba(0,0,0,0.7)',

    // Gradients (as arrays for LinearGradient)
    gradientPrimary: ['#FA243C', '#FF3B50'] as string[],
    gradientCard: ['#12121A', '#1A1A26'] as string[],
    gradientNowPlaying: ['#065F46', '#10B981'] as string[],
};

export const Typography = {
    fontXS: 11,
    fontSM: 13,
    fontMD: 15,
    fontLG: 17,
    fontXL: 20,
    font2XL: 24,
    font3XL: 30,

    thin: '200' as const,
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
};

export const Radii = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
};

// Helper: choosing black or white text based on background brightness
export const getContrastColor = (hex: string): string => {
    if (!hex || hex.length < 6) return '#FFFFFF';
    const c = hex.startsWith('#') ? hex.substring(1) : hex;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#000000' : '#FFFFFF'; // threshold bumped to 150 for better legibility on medium/light colors
};
