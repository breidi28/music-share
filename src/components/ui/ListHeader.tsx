import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { HIG } from '../../theme/hig';

interface ListHeaderProps {
    title: string;
    style?: ViewStyle;
}

/**
 * ListHeader - iOS-style section header for grouped lists
 */
export function ListHeader({ title, style }: ListHeaderProps) {
    return (
        <View style={[styles.header, style]}>
            <Text style={styles.title}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: HIG.list.groupedMargin + HIG.spacing.sm,
        paddingTop: HIG.spacing.xl,
        paddingBottom: HIG.spacing.sm,
    },
    title: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
});
