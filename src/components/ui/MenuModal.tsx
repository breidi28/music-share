import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback, Platform } from 'react-native';
import Modal from 'react-native-modal';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';
import { Layout, Surface } from '../../theme/layout';

export type MenuOption = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
    icon?: keyof typeof Ionicons.glyphMap;
};

interface MenuModalProps {
    visible: boolean;
    title: string;
    options: MenuOption[];
    onClose: () => void;
}

export function MenuModal({ visible, title, options, onClose }: MenuModalProps) {
    return (
        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            onSwipeComplete={onClose}
            swipeDirection="down"
            animationIn="slideInUp"
            animationOut="slideOutDown"
            animationInTiming={300}
            animationOutTiming={250}
            backdropTransitionOutTiming={0}
            useNativeDriverForBackdrop={true}
            style={s.modalWrapper}
        >
            <View style={s.modalContainer}>
                <View style={s.header}>
                    <View style={s.dragIndicator} />
                    <Text style={s.title}>{title}</Text>
                </View>
                        
                        <View style={s.optionsContainer}>
                            {options.map((opt, idx) => {
                                const isDestructive = opt.style === 'destructive';
                                const isCancel = opt.style === 'cancel';
                                const color = isDestructive ? '#ef4444' : (isCancel ? '#9ca3af' : 'white');
                                
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[
                                            s.optionBtn,
                                            isCancel && s.cancelBtn,
                                            idx < options.length - 1 && !isCancel && s.separator
                                        ]}
                                        onPress={() => {
                                            onClose();
                                            if (opt.onPress) opt.onPress();
                                        }}
                                    >
                                        {opt.icon && (
                                            <Ionicons 
                                                name={opt.icon} 
                                                size={20} 
                                                color={color} 
                                                style={{ marginRight: 12 }} 
                                            />
                                        )}
                                        <Text style={[s.optionText, { color }, isDestructive && s.destructiveText]}>
                                            {opt.text}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    modalWrapper: {
        justifyContent: 'flex-end',
        margin: 0,
    },
    modalContainer: {
        width: '100%',
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    dragIndicator: {
        width: 36,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginBottom: 12,
        alignSelf: 'center',
    },
    title: {
        color: '#d1d5db',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    optionsContainer: {
        paddingBottom: 8,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    separator: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    cancelBtn: {
        marginTop: 4,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderTopWidth: 4,
        borderTopColor: '#0A0A0F',
    },
    optionText: {
        fontSize: 17,
        fontWeight: '500',
    },
    destructiveText: {
        fontWeight: '700',
    },
});
