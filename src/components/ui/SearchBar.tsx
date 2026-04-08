import React, { useState, useCallback } from 'react';
import { View, TextInput, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HIG } from '../../theme/hig';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
    onSubmitEditing?: () => void;
    autoFocus?: boolean;
    style?: ViewStyle;
}

/**
 * SearchBar - iOS-style search input component
 * Follows Apple HIG for search controls
 */
export function SearchBar({
    value,
    onChangeText,
    placeholder = 'Search',
    onClear,
    onSubmitEditing,
    autoFocus = false,
    style,
}: SearchBarProps) {
    const [isFocused, setIsFocused] = useState(false);

    const handleClear = useCallback(() => {
        onChangeText('');
        onClear?.();
    }, [onChangeText, onClear]);

    return (
        <View style={[styles.container, isFocused && styles.containerFocused, style]}>
            <View style={styles.searchIconContainer}>
                <Ionicons name="search" size={18} color={HIG.systemColors.secondaryLabel} />
            </View>
            <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={HIG.systemColors.tertiaryLabel}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus={autoFocus}
                clearButtonMode="while-editing"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onSubmitEditing={onSubmitEditing}
                returnKeyType="search"
                accessibilityLabel={placeholder}
            />
            {value.length > 0 && (
                <Pressable
                    onPress={handleClear}
                    style={styles.clearButton}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                >
                    <Ionicons name="close-circle" size={18} color={HIG.systemColors.tertiaryLabel} />
                </Pressable>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: HIG.systemColors.systemGray5,
        borderRadius: 10,
        minHeight: HIG.touchTarget.minimum,
        paddingHorizontal: HIG.spacing.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    containerFocused: {
        borderColor: HIG.systemColors.systemBlue,
        backgroundColor: HIG.systemColors.systemBackground,
    },
    searchIconContainer: {
        marginRight: HIG.spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: HIG.typeScale.body.size,
        color: HIG.systemColors.label,
        paddingVertical: 0,
        minHeight: 36,
    },
    clearButton: {
        marginLeft: HIG.spacing.sm,
        width: HIG.touchTarget.minimum,
        height: HIG.touchTarget.minimum,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: -HIG.spacing.xs,
    },
});
