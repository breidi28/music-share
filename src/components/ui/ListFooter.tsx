import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { HIG } from '../../theme/hig';

interface ListFooterProps {
    title: string;
    style?: ViewStyle;
}

/**
 * ListFooter - iOS-style section footer for grouped lists
 */
export function ListFooter({ title, style }: ListFooterProps) {
    return (
        <View style={[styles.footer, style]}>
            <Text style={styles.text}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    footer: {
        paddingHorizontal: HIG.list.groupedMargin + HIG.spacing.sm,
        paddingVertical: HIG.spacing.sm,
        marginTop: 4,
        marginBottom: 24,
    },
    text: {
        fontSize: 13,
        fontWeight: '400',
        color: '#6b7280',
        lineHeight: 18,
    },
});
