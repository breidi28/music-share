import { Colors } from './index';

// Approximates the app's dark theme for Clerk's prebuilt web components
// (@clerk/expo/web SignIn/SignUp). Native uses clerk-theme.json instead —
// see the @clerk/expo config plugin in app.json.
export const clerkWebAppearance = {
    variables: {
        colorPrimary: Colors.primary,
        colorBackground: '#000000',
        colorInputBackground: '#1a1a1a',
        colorInputText: '#ffffff',
        colorText: '#ffffff',
        colorTextSecondary: '#6b7280',
        colorDanger: Colors.primary,
        borderRadius: '12px',
    },
};
