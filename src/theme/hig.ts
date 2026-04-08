/**
 * Apple Human Interface Guidelines Design Tokens
 * Based on https://developer.apple.com/design/human-interface-guidelines
 */

export const HIG = {
    // Touch targets - minimum 44x44pt for all interactive elements
    touchTarget: {
        minimum: 44,
        iconButton: 44,
        largeButton: 52,
        tabBarIcon: 30,
    },

    // Layout & Spacing
    spacing: {
        none: 0,
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        '2xl': 24,
        '3xl': 32,
        '4xl': 40,
        '5xl': 48,
    },

    // Border Radii (iOS-style)
    radii: {
        none: 0,
        sm: 8,
        md: 10,
        lg: 12,
        xl: 16,
        '2xl': 20,
        '3xl': 24,
        full: 9999,
        // iOS specific
        groupedCard: 10,
        systemMaterial: 12,
    },

    // Typography - SF Pro style scale
    typeScale: {
        largeTitle: { size: 34, weight: '700', lineHeight: 41 },
        title1: { size: 28, weight: '700', lineHeight: 34 },
        title2: { size: 22, weight: '700', lineHeight: 28 },
        title3: { size: 20, weight: '700', lineHeight: 25 },
        headline: { size: 17, weight: '600', lineHeight: 22 },
        body: { size: 17, weight: '400', lineHeight: 22 },
        callout: { size: 16, weight: '400', lineHeight: 21 },
        subhead: { size: 15, weight: '400', lineHeight: 20 },
        footnote: { size: 13, weight: '400', lineHeight: 18 },
        caption1: { size: 12, weight: '400', lineHeight: 16 },
        caption2: { size: 11, weight: '400', lineHeight: 13 },
    },

    // Colors - iOS system colors
    systemColors: {
        // Backgrounds
        systemBackground: '#000000',
        secondarySystemBackground: '#1C1C1E',
        tertiarySystemBackground: '#2C2C2E',

        // Grouped tables
        groupedBackground: '#000000',
        groupedCard: '#1C1C1E',
        groupedCardActive: '#2C2C2E',

        // Separators
        separator: 'rgba(84, 84, 88, 0.65)',
        separatorOpaque: 'rgba(84, 84, 88, 0.65)',

        // Text
        label: '#FFFFFF',
        secondaryLabel: '#8E8E93',
        tertiaryLabel: '#636366',
        quaternaryLabel: '#48484A',

        // System colors
        systemBlue: '#0A84FF',
        systemGreen: '#30D158',
        systemIndigo: '#5E5CE6',
        systemOrange: '#FF9F0A',
        systemPink: '#FF375F',
        systemPurple: '#BF5AF2',
        systemRed: '#FF453A',
        systemTeal: '#5AC8FA',
        systemYellow: '#FFD60A',
        systemGray: '#8E8E93',
        systemGray2: '#636366',
        systemGray3: '#48484A',
        systemGray4: '#3A3A3C',
        systemGray5: '#2C2C2E',
        systemGray6: '#1C1C1E',
    },

    // Semantic aliases for consistent component styling
    semantic: {
        pageBackground: '#000000',
        groupedBackground: '#000000',
        cardBackground: '#1C1C1E',
        cardBackgroundActive: '#2C2C2E',
        controlBackground: '#2C2C2E',
        controlBackgroundPressed: '#3A3A3C',
        border: 'rgba(84, 84, 88, 0.65)',
        label: '#FFFFFF',
        secondaryLabel: '#8E8E93',
        tertiaryLabel: '#636366',
        accent: '#0A84FF',
        destructive: '#FF453A',
        success: '#30D158',
        disabled: '#48484A',
    },

    // Navigation
    navBar: {
        height: 44,
        largeTitleHeight: 96,
        blurredHeight: 52,
    },

    // Tab Bar
    tabBar: {
        height: 49,
        itemMinWidth: 53,
        iconSize: 30,
    },

    // List/TableView
    list: {
        rowHeight: 44,
        rowHeightTall: 60,
        rowPadding: 16,
        rowIconSize: 30,
        separatorInset: 0,
        groupedCornerRadius: 10,
        groupedMargin: 16,
    },

    // Modal/Sheet
    modal: {
        cornerRadius: 12,
        sheetCornerRadius: 10,
        detents: ['medium', 'large'],
        gripWidth: 36,
        gripHeight: 5,
    },

    // Alerts
    alert: {
        cornerRadius: 14,
        minWidth: 270,
        maxWidth: 310,
    },

    // Buttons
    button: {
        height: 44,
        cornerRadius: 12,
        minTapTarget: 44,
        paddingHorizontal: 16,
    },

    // Input fields
    input: {
        height: 44,
        cornerRadius: 10,
        fontSize: 17,
    },

    // Shadows (iOS elevation)
    shadows: {
        none: {
            shadowColor: 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
        },
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
        },
        xl: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.2,
            shadowRadius: 24,
            elevation: 16,
        },
    },

    // Animation timing (iOS standard)
    animation: {
        timingDefault: 0.3,
        timingFast: 0.2,
        timingSlow: 0.5,
        springDamping: 0.7,
        springResponse: 0.45,
    },

    // Safe area insets (dynamic - use react-native-safe-area-context)
    safeArea: {
        top: 47, // iPhone notch
        bottom: 34, // iPhone home indicator
        left: 0,
        right: 0,
    },
};

// Legacy exports for backwards compatibility
export const touchTargetMin = HIG.touchTarget.minimum;
export const rowMinHeight = HIG.list.rowHeight;
export const navBarHeight = HIG.navBar.height;
export const sectionCornerRadius = HIG.radii.groupedCard;
export const separatorThickness = HIG.list.separatorInset;
export const groupedBackground = HIG.systemColors.groupedBackground;
export const groupedCard = HIG.systemColors.groupedCard;
export const separator = HIG.systemColors.separator;
export const secondaryText = HIG.systemColors.secondaryLabel;
