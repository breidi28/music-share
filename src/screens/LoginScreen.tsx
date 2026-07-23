import React from 'react';
import { View } from 'react-native';
import { AuthView } from '@clerk/expo/native';

export default function LoginScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: 'black' }}>
            <AuthView mode="signIn" isDismissible={false} />
        </View>
    );
}
