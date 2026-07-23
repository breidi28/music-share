import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

// ─── Stack param list ─────────────────────────────────────────────────────────
export type RootStackParamList = {
    // Auth
    Login: undefined;
    Register: undefined;

    // Main tab container
    Main: undefined;

    // Screens pushed from anywhere
    Profile: { userId: number } | undefined;
    Notifications: undefined;
    Settings: undefined;
    EditProfile: undefined;
    Search: undefined;
    FollowersList: { userId: number; initialTab?: 'followers' | 'following' };
    Collection: { userId?: number } | undefined;
    ListenLater: undefined;
    CollaborativeLists: undefined;
    WeeklyRecap: undefined;
    ArtistProgress: { artist: string };
    HelpSupport: undefined;
    Terms: undefined;
    PrivacyPolicy: undefined;
    Changelog: undefined;
};

// ─── Tab param list ───────────────────────────────────────────────────────────
export type TabParamList = {
    Feed: undefined;
    Explore: undefined;
    Share: undefined;
    ProfileTab: undefined;
    Activity: undefined;
};

// ─── Convenience prop types ───────────────────────────────────────────────────
export type StackScreenProps<T extends keyof RootStackParamList> =
    NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
    BottomTabScreenProps<TabParamList, T>,
    NativeStackScreenProps<RootStackParamList>
>;
