import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HIG } from '../../theme/hig';

type ListItemProps = {
    title: string;
    subtitle?: string;
    value?: string | React.ReactNode;
    valueStyle?: TextStyle;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
    iconLogo?: React.ReactNode;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
    chevron?: boolean;
    onPress?: () => void;
    destructive?: boolean;
    style?: ViewStyle;
    titleStyle?: TextStyle;
    height?: 'standard' | 'tall';
    disabled?: boolean;
};

/**
 * ListItem - iOS-style list row component
 * Follows Apple HIG for table view cells
 */
export function ListItem({
    title,
    subtitle,
    value,
    valueStyle,
    icon,
    iconColor = HIG.systemColors.systemBlue,
    iconLogo,
    leftElement,
    rightElement,
    chevron = false,
    onPress,
    destructive = false,
    style,
    titleStyle,
    height = 'standard',
    disabled = false,
}: ListItemProps) {
    const isInteractive = !!onPress;
    const titleColor = destructive ? HIG.systemColors.systemRed : HIG.systemColors.label;
    const valueColor = destructive ? HIG.systemColors.systemRed : HIG.systemColors.secondaryLabel;

    const Content = (
        <View style={[styles.row, height === 'tall' && styles.rowTall, disabled && styles.disabledRow, style]}>
            {/* Left element */}
            <View style={styles.left}>
                {leftElement}
                {iconLogo ? (
                    <View style={styles.iconContainerLogo}>
                        {iconLogo}
                    </View>
                ) : icon ? (
                    <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
                        <Ionicons name={icon} size={20} color={iconColor} />
                    </View>
                ) : null}
            </View>

            {/* Middle - Title & Subtitle */}
            <View style={styles.middle}>
                <Text style={[styles.title, { color: titleColor }, titleStyle]} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={styles.subtitle} numberOfLines={2}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {/* Right element */}
            <View style={styles.right}>
                {typeof value === 'string' ? (
                    <Text style={[styles.value, { color: valueColor }, valueStyle]} numberOfLines={1}>
                        {value}
                    </Text>
                ) : (
                    value
                )}
                {rightElement}
                {chevron && (
                    <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={HIG.systemColors.secondaryLabel}
                    />
                )}
            </View>
        </View>
    );

    if (isInteractive && !disabled) {
        return (
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityState={{ disabled }}
                disabled={disabled}
                style={({ pressed }) => [pressed && styles.pressedRow]}
            >
                {Content}
            </Pressable>
        );
    }

    return Content;
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: HIG.list.rowHeight,
        paddingHorizontal: HIG.list.rowPadding,
        paddingVertical: HIG.spacing.sm,
    },
    rowTall: {
        minHeight: HIG.list.rowHeightTall,
        paddingVertical: HIG.spacing.md,
    },
    left: {
        marginRight: HIG.spacing.md,
    },
    iconContainer: {
        width: 30,
        height: 30,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerLogo: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    middle: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: HIG.typeScale.body.size,
        fontWeight: '400',
        letterSpacing: -0.2,
    },
    subtitle: {
        fontSize: HIG.typeScale.caption1.size,
        color: HIG.systemColors.secondaryLabel,
        marginTop: 2,
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: HIG.spacing.sm,
    },
    value: {
        fontSize: HIG.typeScale.subhead.size,
        color: HIG.systemColors.secondaryLabel,
    },
    pressedRow: {
        backgroundColor: HIG.semantic.cardBackgroundActive,
    },
    disabledRow: {
        opacity: 0.55,
    },
});
