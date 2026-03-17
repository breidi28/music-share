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
const CD_SIZE = SCREEN_WIDTH * 0.8;

interface InteractiveCDViewProps {
    albumArt?: string;
    albumTitle: string;
    artist: string;
    onClose: () => void;
}

export const InteractiveCDView: React.FC<InteractiveCDViewProps> = ({ 
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

        // Base 30 degree tilt for natural hand position
        const tiltY = interpolate(qy, [-0.5, 0.5], [-12, 12], Extrapolate.CLAMP);
        const tiltX = interpolate(qx, [-0.5, 0.5], [12, -12], Extrapolate.CLAMP);
        const flip = flipRotation.value;

        return {
            transform: [
                { perspective: 1000 },
                { rotateY: `${flip + tiltY}deg` },
                { rotateX: `${15 + tiltX}deg` }, // Base tilt for better viewing angle
                { scale: 1.05 }
            ],
            zIndex: flip >= 90 ? 1 : 2,
        };
    });

    const backFaceStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const tiltY = interpolate(qy, [-0.5, 0.5], [-12, 12], Extrapolate.CLAMP);
        const tiltX = interpolate(qx, [-0.5, 0.5], [12, -12], Extrapolate.CLAMP);
        const flip = flipRotation.value;

        return {
            transform: [
                { perspective: 1000 },
                { rotateY: `${flip + 180 + tiltY}deg` },
                { rotateX: `${15 + tiltX}deg` },
                { scale: 1.05 }
            ],
            zIndex: flip >= 90 ? 2 : 1,
        };
    });

    const shimmerStyle = useAnimatedStyle(() => {
        const { qy, qx } = sensor.sensor.value;
        // Tightened movement for better control
        const moveX = interpolate(qy, [-0.5, 0.5], [-80, 80]);
        const moveY = interpolate(qx, [-0.5, 0.5], [-80, 80]);
        
        return {
            transform: [
                { translateX: moveX },
                { translateY: moveY },
                { rotate: '45deg' }
            ]
        };
    });

    const mirrorReflectionStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const rotateZ = interpolate(qy, [-0.5, 0.5], [-70, 70], Extrapolate.CLAMP);

        return {
            transform: [
                { rotateZ: `${rotateZ}deg` },
                { scale: 2.2 } 
            ]
        };
    });

    const spectralFanStyle = useAnimatedStyle(() => {
        const { qy } = sensor.sensor.value;
        const rotateZ = interpolate(qy, [-0.5, 0.5], [-160, 160]);
        const opacity = interpolate(Math.abs(qy), [0, 0.5], [0.3, 0.7]);
        
        return {
            opacity,
            transform: [
                { rotateZ: `${rotateZ}deg` },
                { scale: 2.5 }
            ]
        };
    });

    const anisotropicStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const rotateZ = interpolate(qx + qy, [-1, 1], [-45, 45]);
        const opacity = interpolate(Math.abs(qx), [0, 0.5], [0.5, 0.9]);
        
        return {
            opacity,
            transform: [
                { rotateZ: `${rotateZ}deg` },
                { scale: 2.2 }
            ]
        };
    });

    const radialRayStyle = useAnimatedStyle(() => {
        const { qx, qy } = sensor.sensor.value;
        const rotateZ = interpolate(qy - qx, [-1, 1], [0, 360]);
        
        return {
            transform: [
                { rotateZ: `${rotateZ}deg` },
                { scale: 1.5 }
            ]
        };
    });

    const highlightStyle = useAnimatedStyle(() => {
        const { qx } = sensor.sensor.value;
        const opacity = interpolate(Math.abs(qx), [0, 0.5], [0.2, 0.6], Extrapolate.CLAMP);
        
        return { opacity };
    });

    const handleFlip = () => {
        const newRotation = isFlipped ? 0 : 180;
        flipRotation.value = withSpring(newRotation, { damping: 12, stiffness: 90 });
        setIsFlipped(!isFlipped);
    };

    return (
        <View style={styles.container}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
            
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
                <View style={styles.cdWrapper}>
                    
                    {/* FRONT SIDE (Album Art) */}
                    <Animated.View style={[styles.side, frontFaceStyle]}>
                        <View style={styles.cdBase}>
                            {albumArt ? (
                                <Image source={{ uri: albumArt }} style={styles.albumArt} />
                            ) : (
                                <View style={styles.placeholderArt}>
                                    <FontAwesome5 name="compact-disc" size={80} color="#4b5563" />
                                </View>
                            )}
                            
                            {/* Center Hole Details */}
                            <View style={styles.centerHoleOuter}>
                                <View style={styles.centerHoleInner} />
                            </View>

                            {/* Plastic Glossy Overlays */}
                            <LinearGradient
                                colors={['rgba(255,255,255,0.1)', 'transparent', 'rgba(0,0,0,0.1)']}
                                style={styles.glossOverlay}
                            />
                        </View>
                    </Animated.View>

                    {/* BACK SIDE (Shiny Data Side) */}
                    <Animated.View style={[styles.side, backFaceStyle]}>
                        <View style={[styles.cdBase, styles.backSide]}>
                            {/* Base Silver/Mirror Surface */}
                            <Animated.View style={[StyleSheet.absoluteFill, mirrorReflectionStyle]}>
                                <LinearGradient
                                    colors={['#cbd5e1', '#f8fafc', '#475569', '#020617', '#94a3b8', '#ffffff', '#1e293b']}
                                    locations={[0, 0.05, 0.4, 0.5, 0.6, 0.95, 1]}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0.1, y: 0.1 }}
                                    end={{ x: 0.9, y: 0.9 }}
                                />
                            </Animated.View>

                            {/* Sharp Radial Specular Rays */}
                            <Animated.View style={[StyleSheet.absoluteFill, radialRayStyle]}>
                                <LinearGradient
                                    colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0.49, y: 0 }}
                                    end={{ x: 0.51, y: 1 }}
                                />
                            </Animated.View>

                            {/* Anisotropic Rainbow Fans */}
                            <Animated.View style={[StyleSheet.absoluteFill, anisotropicStyle]}>
                                <LinearGradient
                                    colors={['transparent', 'rgba(139,92,246,0.3)', 'rgba(59,130,246,0.4)', 'rgba(16,185,129,0.3)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                />
                            </Animated.View>
                            
                            <Animated.View style={[StyleSheet.absoluteFill, spectralFanStyle]}>
                                <LinearGradient
                                    colors={['transparent', 'rgba(236,72,153,0.2)', 'rgba(245,158,11,0.25)', 'rgba(239,68,68,0.2)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                />
                            </Animated.View>

                            {/* Center Dark Band (Sharp center shadow) */}
                            <Animated.View style={[StyleSheet.absoluteFill, mirrorReflectionStyle]}>
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.8)', 'transparent']}
                                    style={StyleSheet.absoluteFill}
                                    start={{ x: 0.48, y: 0 }}
                                    end={{ x: 0.52, y: 1 }}
                                />
                            </Animated.View>

                            {/* Polycarbonate Gloss Finish (Rim + Coating) */}
                            <View style={styles.glassFinish}>
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.15)', 'transparent', 'rgba(255,255,255,0.05)']}
                                    style={StyleSheet.absoluteFill}
                                />
                            </View>

                            {/* Iridescent Shimmer (Noise/Sparkle) */}
                            <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
                                <LinearGradient
                                    colors={[
                                        'transparent',
                                        'rgba(139,92,246,0.15)', 
                                        'rgba(59,130,246,0.25)',  
                                        'rgba(245,158,11,0.2)',  
                                        'transparent'
                                    ]}
                                    style={styles.shimmerGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                            </Animated.View>

                            {/* Surface Details (The actual tracks/grooves) */}
                            <View style={styles.grooves} />
                            <View style={styles.prismRing} />
                            <View style={styles.radialReflections} />

                            {/* Center Hole Details (back side) */}
                            <View style={styles.centerHoleOuterBack}>
                                <View style={styles.centerHoleInnerBack} />
                            </View>
                        </View>
                    </Animated.View>

                </View>
            </TouchableOpacity>

            {/* Footer / Instructions */}
            <View style={styles.footer}>
                <Text style={styles.instructionText}>
                    <Ionicons name="phone-portrait-outline" size={14} color="#9ca3af" /> Tilt your phone to see the shimmer
                </Text>
                <TouchableOpacity onPress={handleFlip} style={styles.flipBtn}>
                    <Text style={styles.flipBtnText}>FLIP DISC</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
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
    cdWrapper: {
        width: CD_SIZE,
        height: CD_SIZE,
    },
    side: {
        ...StyleSheet.absoluteFillObject,
        backfaceVisibility: 'hidden',
    },
    cdBase: {
        width: CD_SIZE,
        height: CD_SIZE,
        borderRadius: CD_SIZE / 2,
        backgroundColor: '#0a0a0a',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backSide: {
        backgroundColor: '#d1d5db',
    },
    glassFinish: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: CD_SIZE / 2,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.15)',
        zIndex: 10,
    },
    albumArt: {
        width: '100%',
        height: '100%',
        opacity: 0.95,
    },
    placeholderArt: {
        flex: 1,
        width: '100%',
        backgroundColor: '#1f2937',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glossOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    centerHoleOuter: {
        position: 'absolute',
        width: CD_SIZE * 0.22,
        height: CD_SIZE * 0.22,
        borderRadius: (CD_SIZE * 0.22) / 2,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    centerHoleInner: {
        width: CD_SIZE * 0.08,
        height: CD_SIZE * 0.08,
        borderRadius: (CD_SIZE * 0.08) / 2,
        backgroundColor: 'black',
    },
    centerHoleOuterBack: {
        position: 'absolute',
        width: CD_SIZE * 0.25,
        height: CD_SIZE * 0.25,
        borderRadius: (CD_SIZE * 0.25) / 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    centerHoleInnerBack: {
        width: CD_SIZE * 0.08,
        height: CD_SIZE * 0.08,
        borderRadius: (CD_SIZE * 0.08) / 2,
        backgroundColor: 'black',
    },
    shimmerContainer: {
        position: 'absolute',
        width: '200%',
        height: '200%',
        top: '-50%',
        left: '-50%',
        zIndex: 2,
    },
    shimmerGradient: {
        flex: 1,
    },
    grooves: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: CD_SIZE / 2,
        borderWidth: 40,
        borderColor: 'rgba(0,0,0,0.03)',
        opacity: 0.5,
    },
    prismRing: {
        position: 'absolute',
        top: CD_SIZE * 0.115,
        left: CD_SIZE * 0.115,
        width: CD_SIZE * 0.77,
        height: CD_SIZE * 0.77,
        borderRadius: (CD_SIZE * 0.77) / 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        zIndex: 3,
    },
    radialReflections: {
        position: 'absolute',
        top: CD_SIZE * 0.03,
        left: CD_SIZE * 0.03,
        right: CD_SIZE * 0.03,
        bottom: CD_SIZE * 0.03,
        borderRadius: CD_SIZE / 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        opacity: 0.65,
        zIndex: 4,
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
        backgroundColor: 'white',
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
    },
    flipBtnText: {
        color: 'black',
        fontWeight: '700',
        fontSize: 14,
        letterSpacing: 1,
    }
});
