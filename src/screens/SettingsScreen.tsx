import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';

export default function SettingsScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuthStore();
    
    // Settings state
    const [notifications, setNotifications] = useState({
        likes: true,
        comments: true,
        follows: true,
        newPosts: true,
    });
    
    const [privacy, setPrivacy] = useState({
        profilePublic: true,
        showListeningActivity: true,
        showCollection: true,
    });

    const handleLogout = () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                    },
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This action cannot be undone. All your data will be permanently deleted.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implement account deletion API call
                        Alert.alert('Not Implemented', 'Account deletion will be available soon');
                    },
                },
            ]
        );
    };

    const SettingSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <View style={{ marginBottom: 32 }}>
            <Text style={{ 
                color: '#6b7280', 
                fontSize: 13, 
                fontWeight: '600', 
                textTransform: 'uppercase', 
                letterSpacing: 0.8, 
                marginBottom: 12,
                paddingHorizontal: 16,
            }}>
                {title}
            </Text>
            <View style={{ backgroundColor: '#1c1c1e', borderRadius: 12, marginHorizontal: 16 }}>
                {children}
            </View>
        </View>
    );

    const SettingRow = ({ 
        icon, 
        label, 
        value, 
        onPress, 
        showArrow = true, 
        isSwitch = false, 
        switchValue, 
        onSwitchChange,
        isLast = false,
        destructive = false,
    }: any) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={isSwitch}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: isLast ? 0 : 0.5,
                borderBottomColor: 'rgba(255,255,255,0.1)',
            }}
        >
            <Ionicons name={icon} size={22} color={destructive ? Colors.primary : '#9ca3af'} />
            <Text style={{ 
                color: destructive ? Colors.primary : 'white', 
                fontSize: 16, 
                marginLeft: 12, 
                flex: 1,
            }}>
                {label}
            </Text>
            {isSwitch && (
                <Switch
                    value={switchValue}
                    onValueChange={onSwitchChange}
                    trackColor={{ false: '#374151', true: Colors.primary }}
                    thumbColor={Platform.OS === 'ios' ? '#fff' : switchValue ? '#fff' : '#d1d5db'}
                />
            )}
            {!isSwitch && value && (
                <Text style={{ color: '#6b7280', fontSize: 15, marginRight: 8 }}>{value}</Text>
            )}
            {!isSwitch && showArrow && (
                <Ionicons name="chevron-forward" size={20} color="#4b5563" />
            )}
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: insets.top,
                    backgroundColor: '#000',
                    borderBottomWidth: 0.5,
                    borderBottomColor: 'rgba(255,255,255,0.1)',
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 34, fontWeight: '700', color: 'white', letterSpacing: -0.5, flex: 1 }}>
                        Settings
                    </Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingBottom: 100 }}>
                {/* Account Section */}
                <SettingSection title="Account">
                    <SettingRow
                        icon="person-outline"
                        label="Edit Profile"
                        onPress={() => navigation.navigate('Profile')}
                    />
                    <SettingRow
                        icon="mail-outline"
                        label="Email"
                        value={user?.email}
                        showArrow={false}
                        isLast
                    />
                </SettingSection>

                {/* Notifications Section */}
                <SettingSection title="Notifications">
                    <SettingRow
                        icon="heart-outline"
                        label="Likes"
                        isSwitch
                        switchValue={notifications.likes}
                        onSwitchChange={(v: boolean) => setNotifications({ ...notifications, likes: v })}
                    />
                    <SettingRow
                        icon="chatbubble-outline"
                        label="Comments"
                        isSwitch
                        switchValue={notifications.comments}
                        onSwitchChange={(v: boolean) => setNotifications({ ...notifications, comments: v })}
                    />
                    <SettingRow
                        icon="person-add-outline"
                        label="New Followers"
                        isSwitch
                        switchValue={notifications.follows}
                        onSwitchChange={(v: boolean) => setNotifications({ ...notifications, follows: v })}
                    />
                    <SettingRow
                        icon="musical-notes-outline"
                        label="New Posts from Friends"
                        isSwitch
                        switchValue={notifications.newPosts}
                        onSwitchChange={(v: boolean) => setNotifications({ ...notifications, newPosts: v })}
                        isLast
                    />
                </SettingSection>

                {/* Privacy Section */}
                <SettingSection title="Privacy">
                    <SettingRow
                        icon="eye-outline"
                        label="Public Profile"
                        isSwitch
                        switchValue={privacy.profilePublic}
                        onSwitchChange={(v: boolean) => setPrivacy({ ...privacy, profilePublic: v })}
                    />
                    <SettingRow
                        icon="headset-outline"
                        label="Show Listening Activity"
                        isSwitch
                        switchValue={privacy.showListeningActivity}
                        onSwitchChange={(v: boolean) => setPrivacy({ ...privacy, showListeningActivity: v })}
                    />
                    <SettingRow
                        icon="albums-outline"
                        label="Show Collection"
                        isSwitch
                        switchValue={privacy.showCollection}
                        onSwitchChange={(v: boolean) => setPrivacy({ ...privacy, showCollection: v })}
                        isLast
                    />
                </SettingSection>

                {/* App Section */}
                <SettingSection title="About">
                    <SettingRow
                        icon="information-circle-outline"
                        label="About tuneshare"
                        onPress={() => Alert.alert('tuneshare', 'Version 1.0.0\n\nA social music sharing platform.')}
                    />
                    <SettingRow
                        icon="document-text-outline"
                        label="Terms of Service"
                        onPress={() => Alert.alert('Terms', 'Terms of Service coming soon')}
                    />
                    <SettingRow
                        icon="shield-checkmark-outline"
                        label="Privacy Policy"
                        onPress={() => Alert.alert('Privacy', 'Privacy Policy coming soon')}
                    />
                    <SettingRow
                        icon="help-circle-outline"
                        label="Help & Support"
                        onPress={() => Alert.alert('Support', 'Contact support: support@tuneshare.app')}
                        isLast
                    />
                </SettingSection>

                {/* Danger Zone */}
                <SettingSection title="Account Actions">
                    <SettingRow
                        icon="log-out-outline"
                        label="Logout"
                        onPress={handleLogout}
                        showArrow={false}
                        destructive
                    />
                    <SettingRow
                        icon="trash-outline"
                        label="Delete Account"
                        onPress={handleDeleteAccount}
                        showArrow={false}
                        destructive
                        isLast
                    />
                </SettingSection>

                {/* Footer */}
                <View style={{ alignItems: 'center', marginTop: 24, paddingHorizontal: 32 }}>
                    <Text style={{ color: '#4b5563', fontSize: 13, textAlign: 'center' }}>
                        tuneshare • Version 1.0.0
                    </Text>
                    <Text style={{ color: '#374151', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                        Made with ❤️ for music lovers
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}
