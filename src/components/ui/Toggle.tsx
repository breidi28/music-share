import React, { useCallback } from 'react';
import { Switch, StyleSheet, Platform } from 'react-native';
import { HIG } from '../../theme/hig';

interface ToggleProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    size?: 'default' | 'small';
}

/**
 * Toggle - iOS-style switch component
 * Follows Apple HIG for toggle controls
 */
export function Toggle({ value, onValueChange, disabled = false, size = 'default' }: ToggleProps) {
    const handleChange = useCallback((newValue: boolean) => {
        if (!disabled) {
            onValueChange(newValue);
        }
    }, [disabled, onValueChange]);

    return (
        <Switch
            value={value}
            onValueChange={handleChange}
            disabled={disabled}
            trackColor={{
                false: HIG.systemColors.systemGray5,
                true: 'rgba(250, 36, 60, 0.58)',
            }}
            thumbColor={HIG.systemColors.systemBackground}
            ios_backgroundColor={HIG.systemColors.systemGray5}
            style={[styles.switch, size === 'small' && styles.switchSmall]}
        />
    );
}

const styles = StyleSheet.create({
    switch: {
        transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }],
        margin: -4,
    },
    switchSmall: {
        transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
    },
});
