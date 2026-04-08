import React from 'react';
import { View, StyleSheet } from 'react-native';
import { HIG } from '../../theme/hig';

interface ListSeparatorProps {
    inset?: boolean;
    style?: object;
}

/**
 * ListSeparator - iOS-style separator between list items
 * Only shows between items, not before first or after last
 */
export function ListSeparator({ inset = false, style }: ListSeparatorProps) {
    return (
        <View
            style={[
                styles.separator,
                inset && styles.inset,
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: HIG.systemColors.separator,
        marginLeft: 0,
    },
    inset: {
        marginLeft: HIG.list.rowPadding,
    },
});
