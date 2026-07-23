import React from 'react';
import { View } from 'react-native';
import { SignUp } from '@clerk/expo/web';
import { clerkWebAppearance } from '../theme/clerkWebAppearance';

export default function RegisterScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <SignUp appearance={clerkWebAppearance} />
        </View>
    );
}
