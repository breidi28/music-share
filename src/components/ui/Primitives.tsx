import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { Layout, Surface } from '../../theme/layout';

type CardProps = {
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
};

export function AppCard({ children, style }: CardProps) {
    return <View style={[styles.card, style]}>{children}</View>;
}

type ChipProps = {
    label: string;
    color?: string;
    style?: ViewStyle | ViewStyle[];
    textStyle?: TextStyle | TextStyle[];
};

export function AppChip({ label, color = '#9ca3af', style, textStyle }: ChipProps) {
    return (
        <View style={[styles.chip, { borderColor: `${color}66`, backgroundColor: `${color}1F` }, style]}>
            <Text style={[styles.chipText, { color }, textStyle]}>{label}</Text>
        </View>
    );
}

type IconButtonProps = {
    onPress: () => void;
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
};

export function AppIconButton({ onPress, children, style }: IconButtonProps) {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.iconButton, style]}>
            {children}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Surface.card,
        borderRadius: Layout.radius.xl,
        borderWidth: 1,
        borderColor: Surface.borderSoft,
        padding: Layout.space[3],
    },
    chip: {
        borderWidth: 1,
        borderRadius: Layout.radius.pill,
        paddingHorizontal: Layout.space[2],
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    chipText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    iconButton: {
        width: Layout.touch.iconButton,
        height: Layout.touch.iconButton,
        borderRadius: Layout.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
