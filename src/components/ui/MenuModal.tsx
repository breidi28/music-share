import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TouchableWithoutFeedback, Platform } from 'react-native';
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
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity 
                style={s.overlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                <TouchableWithoutFeedback>
                    <View style={s.modalContainer}>
                        <View style={s.header}>
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
                </TouchableWithoutFeedback>
            </TouchableOpacity>
        </Modal>
    );
}

const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: '#1c1c1e',
        borderRadius: 16,
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
