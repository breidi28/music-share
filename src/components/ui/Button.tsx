import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { HIG } from '../../theme/hig';
import { Ionicons } from '@expo/vector-icons';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'link';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    icon?: keyof typeof Ionicons.glyphMap;
    iconPosition?: 'left' | 'right';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    size?: 'default' | 'small';
    style?: ViewStyle;
    titleStyle?: TextStyle;
    accessibilityLabel?: string;
}

/**
 * Button - iOS-style button component
 * Follows Apple HIG for button controls
 */
export function Button({
    title,
    onPress,
    variant = 'primary',
    icon,
    iconPosition = 'left',
    disabled = false,
    loading = false,
    fullWidth = false,
    size = 'default',
    style,
    titleStyle,
    accessibilityLabel,
}: ButtonProps) {
    const isDisabled = disabled || loading;
    const isPrimary = variant === 'primary';

    const iconTextColor = isDisabled
        ? HIG.systemColors.tertiaryLabel
        : isPrimary
            ? '#FFFFFF'
            : variant === 'destructive'
                ? HIG.systemColors.systemRed
                : variant === 'tertiary' || variant === 'link'
                    ? HIG.systemColors.systemBlue
                    : HIG.systemColors.label;

    const buttonStyles = [
        styles.button,
        styles[variant],
        fullWidth && styles.fullWidth,
        size === 'small' && styles.buttonSmall,
        isDisabled && styles.disabled,
        style,
    ];

    const textStyles = [
        styles.text,
        styles[`${variant}Text`],
        size === 'small' && styles.textSmall,
        isDisabled && styles.disabledText,
        titleStyle,
    ];

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel ?? title}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            hitSlop={size === 'small' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
            style={({ pressed }) => [buttonStyles, pressed && !isDisabled && styles.pressed]}
        >
            {loading ? (
                <ActivityIndicator
                    color={isPrimary ? '#FFFFFF' : HIG.systemColors.systemBlue}
                    size="small"
                />
            ) : (
                <>
                    {icon && iconPosition === 'left' && (
                        <Ionicons
                            name={icon}
                            size={size === 'small' ? 16 : 18}
                            color={iconTextColor}
                            style={styles.icon}
                        />
                    )}
                    <Text style={textStyles}>{title}</Text>
                    {icon && iconPosition === 'right' && (
                        <Ionicons
                            name={icon}
                            size={size === 'small' ? 16 : 18}
                            color={iconTextColor}
                            style={styles.icon}
                        />
                    )}
                </>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        height: HIG.button.height,
        borderRadius: HIG.button.cornerRadius,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: HIG.button.paddingHorizontal,
        minHeight: HIG.touchTarget.minimum,
    },
    buttonSmall: {
        minHeight: HIG.touchTarget.minimum,
        paddingHorizontal: 12,
    },
    fullWidth: {
        width: '100%',
    },
    // Primary variant
    primary: {
        backgroundColor: HIG.systemColors.systemBlue,
    },
    primaryText: {
        color: '#FFFFFF',
    },
    // Secondary variant
    secondary: {
        backgroundColor: HIG.systemColors.systemGray5,
    },
    secondaryText: {
        color: HIG.systemColors.label,
    },
    // Tertiary variant (ghost)
    tertiary: {
        backgroundColor: 'transparent',
    },
    tertiaryText: {
        color: HIG.systemColors.systemBlue,
    },
    // Destructive variant
    destructive: {
        backgroundColor: 'transparent',
    },
    destructiveText: {
        color: HIG.systemColors.systemRed,
    },
    // Link variant
    link: {
        backgroundColor: 'transparent',
        minHeight: HIG.touchTarget.minimum,
    },
    linkText: {
        color: HIG.systemColors.systemBlue,
    },
    // Text styles
    text: {
        fontSize: HIG.typeScale.body.size,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    textSmall: {
        fontSize: 15,
    },
    // Disabled state
    disabled: {
        opacity: 0.45,
    },
    disabledText: {
        color: HIG.systemColors.tertiaryLabel,
    },
    pressed: {
        opacity: 0.78,
    },
    // Icon
    icon: {
        marginHorizontal: 4,
    },
});
