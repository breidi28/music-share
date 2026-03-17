import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Image, StyleSheet } from 'react-native';
import Animated, { 
    useAnimatedStyle, 
    useSharedValue, 
    withSpring, 
    interpolate, 
    useAnimatedSensor, 
    SensorType,
    Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VINYL_SIZE = SCREEN_WIDTH * 0.85; // Vinyls are usually larger in feel than CDs
const LABEL_SIZE = VINYL_SIZE * 0.35;

interface InteractiveVinylViewProps {
    albumArt?: string;
    albumTitle: string;
    artist: string;
    onClose: () => void;
}

export const InteractiveVinylView: React.FC<InteractiveVinylViewProps> = ({ 
    albumArt, 
    albumTitle, 
    artist, 
    onClose 
}) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const flipRotation = useSharedValue(0);
    
    // Using ROTATION sensor for best tilt effect
    const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 10 });

    const frontFaceStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const tiltY = interpolate(qy, [-0.5, 0.5], [-10, 10], Extrapolate.CLAMP);
        const tiltX = interpolate(qx, [-0.5, 0.5], [10, -10], Extrapolate.CLAMP);
        const flip = flipRotation.value;

        return {
            transform: [
                { perspective: 1200 },
                { rotateY: `${flip + tiltY}deg` },
                { rotateX: `${15 + tiltX}deg` },
                { scale: 1.02 }
            ],
            zIndex: flip >= 90 ? 1 : 2,
        };
    });

    const backFaceStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const tiltY = interpolate(qy, [-0.5, 0.5], [-10, 10], Extrapolate.CLAMP);
        const tiltX = interpolate(qx, [-0.5, 0.5], [10, -10], Extrapolate.CLAMP);
        const flip = flipRotation.value;

        return {
            transform: [
                { perspective: 1200 },
                { rotateY: `${flip + 180 + tiltY}deg` },
                { rotateX: `${15 + tiltX}deg` },
                { scale: 1.02 }
            ],
            zIndex: flip >= 90 ? 2 : 1,
        };
    });

    const reflectionStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const rotateZ = interpolate(qy - qx, [-1, 1], [-45, 45]);
        const opacity = interpolate(Math.abs(qx) + Math.abs(qy), [0, 1], [0.3, 0.6]);
        
        return {
            opacity,
            transform: [
                { rotateZ: `${rotateZ}deg` },
                { scale: 2 }
            ]
        };
    });

    const labelReflectionStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const translateX = interpolate(qy, [-0.5, 0.5], [-15, 15]);
        const translateY = interpolate(qx, [-0.5, 0.5], [-15, 15]);

        return {
            transform: [{ translateX }, { translateY }]
        };
    });

    const handleFlip = () => {
        const newRotation = isFlipped ? 0 : 180;
        flipRotation.value = withSpring(newRotation, { damping: 14, stiffness: 80 });
        setIsFlipped(!isFlipped);
    };

    return (
        <View style={styles.container}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title} numberOfLines={1}>{albumTitle}</Text>
                    <Text style={styles.artist}>{artist}</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            {/* Interaction Area */}
            <TouchableOpacity 
                activeOpacity={1} 
                onPress={handleFlip} 
                style={styles.discContainer}
            >
                <View style={styles.vinylWrapper}>
                    
                    {/* SIDE A */}
                    <Animated.View style={[styles.side, frontFaceStyle]}>
                        <View style={styles.vinylBase}>
                            {/* Record Surface Grooves */}
                            <View style={styles.groovePattern} />
                            <View style={[styles.groovePattern, { transform: [{ scale: 0.8 }] }]} />
                            <View style={[styles.groovePattern, { transform: [{ scale: 0.6 }] }]} />
                            
                            {/* Anisotropic Reflection (Bow-tie) */}
                            <Animated.View style={[StyleSheet.absoluteFill, reflectionStyle]}>
                                <LinearGradient
                                    colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent', 'rgba(255,255,255,0.08)', 'transparent']}
                                    locations={[0, 0.25, 0.5, 0.75, 1]}
                                    style={StyleSheet.absoluteFill}
                                />
                            </Animated.View>

                            {/* Center Label */}
                            <View style={styles.labelContainer}>
                                {albumArt ? (
                                    <Image source={{ uri: albumArt }} style={styles.labelArt} />
                                ) : (
                                    <View style={styles.placeholderLabel}>
                                        <Text style={styles.placeholderText}>SIDE A</Text>
                                    </View>
                                )}
                                <View style={styles.labelOverlay}>
                                    <Text style={styles.sideIndicator}>A</Text>
                                </View>
                                {/* Center Hole */}
                                <View style={styles.centerHole} />
                                
                                {/* Label Reflection */}
                                <Animated.View style={[styles.labelGloss, labelReflectionStyle]}>
                                    <LinearGradient
                                        colors={['rgba(255,255,255,0.2)', 'transparent']}
                                        style={StyleSheet.absoluteFill}
                                    />
                                </Animated.View>
                            </View>

                            {/* Outer Rim Gloss */}
                            <View style={styles.vinylRim} />
                        </View>
                    </Animated.View>

                    {/* SIDE B */}
                    <Animated.View style={[styles.side, backFaceStyle]}>
                        <View style={styles.vinylBase}>
                            <View style={styles.groovePattern} />
                            <View style={[styles.groovePattern, { transform: [{ scale: 0.8 }] }]} />
                            
                            <Animated.View style={[StyleSheet.absoluteFill, reflectionStyle]}>
                                <LinearGradient
                                    colors={['transparent', 'rgba(255,255,255,0.05)', 'transparent', 'rgba(255,255,255,0.05)', 'transparent']}
                                    locations={[0, 0.25, 0.5, 0.75, 1]}
                                    style={StyleSheet.absoluteFill}
                                />
                            </Animated.View>

                            <View style={styles.labelContainer}>
                                {albumArt ? (
                                    <Image source={{ uri: albumArt }} style={[styles.labelArt, { opacity: 0.7 }]} />
                                ) : (
                                    <View style={styles.placeholderLabel}>
                                        <Text style={styles.placeholderText}>SIDE B</Text>
                                    </View>
                                )}
                                <View style={styles.labelOverlay}>
                                    <Text style={styles.sideIndicator}>B</Text>
                                </View>
                                <View style={styles.centerHole} />
                            </View>
                            <View style={styles.vinylRim} />
                        </View>
                    </Animated.View>

                </View>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.instructionText}>
                    <Ionicons name="swap-horizontal" size={14} color="#9ca3af" /> Tap to flip the record
                </Text>
                <TouchableOpacity onPress={handleFlip} style={styles.flipBtn}>
                    <Text style={styles.flipBtnText}>FLIP RECORD</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'space-between',
        paddingVertical: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    headerText: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    artist: {
        color: '#fa243c',
        fontSize: 14,
        marginTop: 2,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    discContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    vinylWrapper: {
        width: VINYL_SIZE,
        height: VINYL_SIZE,
    },
    side: {
        ...StyleSheet.absoluteFillObject,
        backfaceVisibility: 'hidden',
    },
    vinylBase: {
        width: VINYL_SIZE,
        height: VINYL_SIZE,
        borderRadius: VINYL_SIZE / 2,
        backgroundColor: '#050505',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 25 },
        shadowOpacity: 0.6,
        shadowRadius: 35,
        elevation: 25,
    },
    groovePattern: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: VINYL_SIZE / 2,
        borderWidth: 60,
        borderColor: 'rgba(255,255,255,0.02)',
        opacity: 0.8,
    },
    labelContainer: {
        width: LABEL_SIZE,
        height: LABEL_SIZE,
        borderRadius: LABEL_SIZE / 2,
        backgroundColor: '#111',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    labelArt: {
        width: '100%',
        height: '100%',
        opacity: 0.9,
    },
    placeholderLabel: {
        flex: 1,
        width: '100%',
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#4b5563',
        fontWeight: '700',
        fontSize: 12,
    },
    labelOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center',
        paddingTop: 10,
    },
    sideIndicator: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        opacity: 0.8,
    },
    centerHole: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#000',
        zIndex: 10,
    },
    labelGloss: {
        position: 'absolute',
        top: -10,
        left: -10,
        right: -10,
        bottom: -10,
        opacity: 0.5,
    },
    vinylRim: {
        position: 'absolute',
        top: 2,
        left: 2,
        right: 2,
        bottom: 2,
        borderRadius: VINYL_SIZE / 2,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: 40,
    },
    instructionText: {
        color: '#9ca3af',
        fontSize: 13,
        marginBottom: 20,
    },
    flipBtn: {
        backgroundColor: '#FA243C',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    flipBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 1,
    }
});
