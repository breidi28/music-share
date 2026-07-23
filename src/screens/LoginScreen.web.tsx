import React from 'react';
import { View } from 'react-native';
import { SignIn } from '@clerk/expo/web';
import { clerkWebAppearance } from '../theme/clerkWebAppearance';

export default function LoginScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <SignIn appearance={clerkWebAppearance} />
        </View>
    );
}
