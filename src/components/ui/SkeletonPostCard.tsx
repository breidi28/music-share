import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function SkeletonPostCard() {
    const animatedValue = new Animated.Value(0);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    return (
        <View style={s.card}>
            {/* Header Skeleton */}
            <View style={s.header}>
                <Animated.View style={[s.avatar, { opacity }]} />
                <View style={s.headerText}>
                    <Animated.View style={[s.line, { width: 120, opacity }]} />
                    <Animated.View style={[s.line, { width: 80, marginTop: 6, opacity }]} />
                </View>
                <Animated.View style={[s.dots, { opacity }]} />
            </View>

            {/* Album Art Skeleton */}
            <View style={s.artWrap}>
                <Animated.View style={[s.art, { opacity }]} />
            </View>

            {/* Metadata Skeleton */}
            <View style={s.metadata}>
                <Animated.View style={[s.line, { width: 200, height: 18, opacity, borderRadius: 4 }]} />
                <Animated.View style={[s.line, { width: 150, height: 14, marginTop: 8, opacity, borderRadius: 4 }]} />
            </View>

            {/* Actions Skeleton */}
            <View style={s.actions}>
                <Animated.View style={[s.actionIcon, { opacity }]} />
                <Animated.View style={[s.actionIcon, { opacity }]} />
                <Animated.View style={[s.actionIcon, { opacity }]} />
                <View style={{ flex: 1 }} />
                <Animated.View style={[s.actionIcon, { opacity }]} />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    card: {
        backgroundColor: '#0a0a0c',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2f2f2f',
    },
    headerText: {
        flex: 1,
        marginLeft: 12,
    },
    line: {
        height: 12,
        backgroundColor: '#2f2f2f',
        borderRadius: 6,
    },
    dots: {
        width: 20,
        height: 12,
        backgroundColor: '#2f2f2f',
        borderRadius: 6,
    },
    artWrap: {
        marginHorizontal: 16,
        marginBottom: 16,
    },
    art: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#1f1f1f',
        borderRadius: 12,
    },
    metadata: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 20,
    },
    actionIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#2f2f2f',
    },
});
