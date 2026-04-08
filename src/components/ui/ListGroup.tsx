import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { HIG } from '../../theme/hig';

interface ListGroupProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    style?: ViewStyle;
    inset?: boolean;
}

/**
 * ListGroup - iOS-style grouped list container
 * Follows Apple HIG for grouped table views
 */
export function ListGroup({ children, header, footer, style, inset = true }: ListGroupProps) {
    const childrenArray = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={[!inset && styles.fullWidth, style]}>
            {header}
            <View style={inset ? styles.groupedContainer : styles.fullWidthContainer}>
                {childrenArray.map((child, index) => (
                    <React.Fragment key={index}>
                        {child}
                        {index < childrenArray.length - 1 && (
                            <View style={styles.separator} />
                        )}
                    </React.Fragment>
                ))}
            </View>
            {footer}
        </View>
    );
}

const styles = StyleSheet.create({
    groupedContainer: {
        marginHorizontal: HIG.list.groupedMargin,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.03)',
        marginLeft: 16,
    },
    fullWidthContainer: {
        backgroundColor: 'transparent',
    },
    fullWidth: {
        marginHorizontal: 0,
    },
});
