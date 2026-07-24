import { Colors } from './index';

// Approximates the app's dark theme for Clerk's prebuilt web components
// (@clerk/expo/web SignIn/SignUp). Native uses clerk-theme.json instead —
// see the @clerk/expo config plugin in app.json.
//
// @clerk/themes' `dark` baseTheme didn't visibly apply against this
// @clerk/react version (only colorPrimary-derived accents rendered; body
// text stayed near-invisible), so all variables are set explicitly here
// instead of relying on it. Names below match what @clerk/themes' own
// dark.mjs uses internally: colorForeground / colorInputForeground /
// colorInput — NOT colorText / colorInputText / colorInputBackground,
// which this version silently ignores.
export const clerkWebAppearance = {
    variables: {
        colorPrimary: Colors.primary,
        colorPrimaryForeground: '#ffffff',
        colorBackground: '#000000',
        colorInput: '#1a1a1a',
        colorNeutral: '#ffffff',
        colorForeground: '#ffffff',
        colorInputForeground: '#ffffff',
        colorDanger: Colors.primary,
        borderRadius: '12px',
    },
};
