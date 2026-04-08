import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { HIG } from '../../theme/hig';

interface Segment {
    label: string;
    value: string;
    icon?: string;
}

interface SegmentedControlProps {
    segments: Segment[];
    selectedValue: string;
    onValueChange: (value: string) => void;
    style?: object;
}

/**
 * SegmentedControl - iOS-style segmented control
 * Follows Apple HIG for segmented controls
 */
export function SegmentedControl({ segments, selectedValue, onValueChange, style }: SegmentedControlProps) {
    const [thumbPosition, setThumbPosition] = useState(0);
    const [thumbWidth, setThumbWidth] = useState(0);

    const selectedIndex = segments.findIndex(s => s.value === selectedValue);

    const handleLayout = useCallback((event: LayoutChangeEvent, index: number) => {
        if (index === selectedIndex) {
            const { width } = event.nativeEvent.layout;
            setThumbWidth(width);
            setThumbPosition(event.nativeEvent.layout.x);
        }
    }, [selectedIndex]);

    const thumbAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: withSpring(thumbPosition, { damping: 15, stiffness: 150 }) }],
        width: withSpring(thumbWidth),
    }));

    return (
        <View style={[styles.container, style]}>
            <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
            {segments.map((segment, index) => (
                <Pressable
                    key={segment.value}
                    style={[styles.segment, index === 0 && styles.segmentFirst, index === segments.length - 1 && styles.segmentLast]}
                    onPress={() => onValueChange(segment.value)}
                    accessibilityRole="button"
                    accessibilityLabel={segment.label}
                    accessibilityState={{ selected: index === selectedIndex }}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                    onLayout={(e) => handleLayout(e, index)}
                >
                    <Text
                        style={[
                            styles.segmentText,
                            index === selectedIndex ? styles.segmentTextSelected : styles.segmentTextUnselected,
                        ]}
                    >
                        {segment.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: HIG.systemColors.systemGray5,
        borderRadius: 9,
        padding: 2,
        position: 'relative',
        minHeight: 32,
    },
    thumb: {
        position: 'absolute',
        top: 2,
        bottom: 2,
        backgroundColor: HIG.systemColors.systemGray4,
        borderRadius: 7,
    },
    segment: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        zIndex: 1,
    },
    segmentFirst: {
        borderTopLeftRadius: 7,
        borderBottomLeftRadius: 7,
    },
    segmentLast: {
        borderTopRightRadius: 7,
        borderBottomRightRadius: 7,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    segmentTextSelected: {
        color: HIG.systemColors.label,
    },
    segmentTextUnselected: {
        color: HIG.systemColors.secondaryLabel,
    },
});
