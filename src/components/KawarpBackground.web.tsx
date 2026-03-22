import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Kawarp, useKawarp } from '@kawarp/react';

type Props = {
    accent?: string;
    avatarUrl?: string | null;
    style?: any;
};

export default function KawarpBackground({ accent = '#3B82F6', avatarUrl, style }: Props) {
    const { ref, loadImage, loadGradient, start } = useKawarp();

    useEffect(() => {
        const load = async () => {
            if (avatarUrl) {
                // Remove /api prefix if navigating locally
                const url = avatarUrl.startsWith('http') ? avatarUrl : `https://music-share-b4r8.onrender.com${avatarUrl}`;
                await loadImage(url);
            } else {
                await loadGradient(['#111111', accent, '#000000'], 135);
            }
            start();
        };
        load();
    }, [avatarUrl, accent]);

    return (
        <View style={[StyleSheet.absoluteFill, style, { zIndex: 0 }]} pointerEvents="none">
            <Kawarp ref={ref} warpIntensity={0.8} style={{ width: '100%', height: '100%', position: 'absolute' }} />
        </View>
    );
}
