# Settings Screen Documentation

## Overview

The Settings Screen (`src/screens/SettingsScreen.tsx`) is a comprehensive settings management interface for the music sharing app. It provides centralized control over:

- **Account Management**: Profile editing and user information
- **Music Service Integrations**: Connect and manage streaming service accounts
- **Notifications**: Control push notification preferences
- **Privacy**: Manage profile visibility and data sharing
- **App Information**: About, support, and legal information
- **Account Actions**: Logout and account deletion

## Features

### 1. Music Service Integrations

The screen supports connection to 6 music streaming services:

#### Fully Implemented Services

1. **Spotify**
   - Full OAuth 2.0 integration
   - Authorization code flow
   - Scopes: user profile, top tracks/artists, recently played, playlists, currently playing
   - Redirect URI: Custom scheme `musicshare://`

2. **YouTube Music**
   - Google OAuth 2.0 integration
   - Authorization code flow (no PKCE)
   - Scopes: YouTube read-only access
   - Redirect URI: Expo auth proxy `https://auth.expo.io/@breidi282/music-share`

3. **Deezer**
   - Deezer OAuth 2.0 integration
   - Authorization code flow
   - Scopes: basic access, email, offline access, library management, listening history
   - Redirect URI: Expo auth proxy `https://auth.expo.io/@breidi282/music-share`

#### Planned Services

4. **Apple Music**
   - Status: Coming soon
   - Requires: MusicKit JavaScript setup
   - Note: Shows informational alert when clicked

5. **Tidal**
   - Status: Backend ready, needs API credentials
   - Backend endpoints: `/api/tidal/*`
   - Note: Shows alert to add credentials to `.env` file

6. **Qobuz**
   - Status: Backend ready, needs API credentials
   - Backend endpoints: `/api/qobuz/*`
   - Note: Shows alert to add credentials to `.env` file

## Architecture

### State Management

```typescript
// User profile with service connection status
const [profile, setProfile] = useState<User | null>(null);

// Loading state for OAuth flows
const [loadingServices, setLoadingServices] = useState(false);

// Notification preferences (local state - TODO: persist to backend)
const [notifications, setNotifications] = useState({...});

// Privacy settings (local state - TODO: persist to backend)
const [privacy, setPrivacy] = useState({...});
```

### OAuth Flow

1. User clicks "Connect" button for a service
2. `useAuthRequest` hook initiates OAuth flow
3. User redirected to service's authorization page
4. Service redirects back with authorization code
5. `useEffect` detects response and calls callback handler
6. Backend exchanges code for access token
7. Profile state updated with connection status
8. Success/error alert shown to user

### Component Hierarchy

```
SettingsScreen
├── Header (Back button + Title)
└── ScrollView
    ├── SettingSection: Account
    │   ├── SettingRow: Edit Profile
    │   └── SettingRow: Username
    ├── SettingSection: Music Services
    │   ├── MusicServiceRow: Spotify
    │   ├── MusicServiceRow: YouTube Music
    │   ├── MusicServiceRow: Apple Music
    │   ├── MusicServiceRow: Tidal
    │   ├── MusicServiceRow: Qobuz
    │   └── MusicServiceRow: Deezer
    ├── SettingSection: Notifications
    │   ├── SettingRow: Likes (Switch)
    │   ├── SettingRow: Comments (Switch)
    │   ├── SettingRow: New Followers (Switch)
    │   └── SettingRow: New Posts from Friends (Switch)
    ├── SettingSection: Privacy
    │   ├── SettingRow: Public Profile (Switch)
    │   ├── SettingRow: Show Listening Activity (Switch)
    │   └── SettingRow: Show Collection (Switch)
    ├── SettingSection: About
    │   ├── SettingRow: About tuneshare
    │   ├── SettingRow: Terms of Service
    │   ├── SettingRow: Privacy Policy
    │   └── SettingRow: Help & Support
    └── SettingSection: Account Actions
        ├── SettingRow: Logout
        └── SettingRow: Delete Account
```

## Reusable Components

### SettingSection

Container component for grouping related settings.

```typescript
<SettingSection title="Section Title">
  {/* Settings rows */}
</SettingSection>
```

### SettingRow

Generic row component supporting multiple types:

**Navigation Row**
```typescript
<SettingRow
  icon="person-outline"
  label="Edit Profile"
  onPress={() => navigation.navigate('Profile')}
/>
```

**Display-Only Row**
```typescript
<SettingRow
  icon="at-outline"
  label="Username"
  value={user?.username}
  showArrow={false}
  isLast
/>
```

**Switch Row**
```typescript
<SettingRow
  icon="heart-outline"
  label="Likes"
  isSwitch={true}
  switchValue={notifications.likes}
  onSwitchChange={(v) => setNotifications({...notifications, likes: v})}
/>
```

**Destructive Row**
```typescript
<SettingRow
  icon="log-out-outline"
  label="Logout"
  onPress={handleLogout}
  destructive
/>
```

### MusicServiceRow

Specialized component for music service connections.

```typescript
<MusicServiceRow
  icon="spotify"              // FontAwesome5 icon name
  label="Spotify"             // Display name
  connected={profile?.has_spotify_linked}
  onConnect={() => spotifyPromptAsync()}
  onDisconnect={handleDisconnectSpotify}
  color="#1DB954"             // Brand color
  loading={loadingServices}
/>
```

## Setup Requirements

### Spotify Integration

1. Create app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URI: `musicshare://callback`
3. Copy Client ID to `SPOTIFY_CLIENT_ID` constant
4. Backend needs Client Secret in `.env`

### YouTube Music Integration

1. Create project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create OAuth 2.0 Web Client credentials
4. Add authorized redirect URI: `https://auth.expo.io/@breidi282/music-share`
5. Copy Client ID to `GOOGLE_WEB_CLIENT_ID` constant
6. Backend needs Client Secret in `.env`

### Tidal Integration

1. Apply for Tidal API access (developer program required)
2. Add credentials to backend `.env`:
   ```
   TIDAL_CLIENT_ID=your_client_id
   TIDAL_CLIENT_SECRET=your_client_secret
   ```
3. Backend endpoints already implemented

### Qobuz Integration

1. Contact Qobuz for API access
2. Add credentials to backend `.env`:
   ```
   QOBUZ_APP_ID=your_app_id
   QOBUZ_APP_SECRET=your_app_secret
   ```
3. Backend endpoints already implemented

### Deezer Integration

1. Create app at [Deezer Developers](https://developers.deezer.com/)
2. Add redirect URI: `https://auth.expo.io/@breidi282/music-share`
3. Add credentials to backend `.env`:
   ```
   DEEZER_APP_ID=your_app_id
   DEEZER_APP_SECRET=your_app_secret
   DEEZER_REDIRECT_URI=https://auth.expo.io/@breidi282/music-share
   ```
4. Copy App ID to `DEEZER_APP_ID` constant in SettingsScreen.tsx
5. Backend endpoints already implemented

## API Integration

### Endpoints Used

```typescript
// User profile
usersApi.getUser(userId) // GET /api/users/:id

// Spotify
spotifyApi.callback(code, redirectUri) // POST /api/spotify/callback
spotifyApi.disconnect() // POST /api/spotify/disconnect

// YouTube Music
youtubeApi.callback(code, redirectUri) // POST /api/youtube/callback
youtubeApi.disconnect() // POST /api/youtube/disconnect

// Apple Music
appleMusicApi.disconnect() // POST /api/apple-music/disconnect

// Tidal
tidalApi.disconnect() // POST /api/tidal/disconnect

// Qobuz
qobuzApi.disconnect() // POST /api/qobuz/disconnect

// Deezer
deezerApi.callback(code) // POST /api/deezer/callback
deezerApi.disconnect() // DELETE /api/deezer/disconnect
```

## TODO Items

### High Priority

1. **Persist Notification Preferences**
   - Add backend API endpoint: `PUT /api/users/me/settings`
   - Save notification settings to database
   - Load settings on component mount

2. **Persist Privacy Settings**
   - Add to same settings endpoint
   - Implement privacy checks in backend queries
   - Update User model with privacy fields

3. **Implement Account Deletion**
   - Add backend endpoint: `DELETE /api/users/me`
   - Cascade delete all user data (posts, comments, likes, etc.)
   - Add confirmation with password re-entry
   - Soft delete option (mark as deleted vs. permanent)

### Medium Priority

1. **Apple Music Integration**
   - Set up MusicKit JavaScript
   - Implement OAuth flow
   - Add backend endpoints

2. **Error Handling Improvements**
   - Better error messages for OAuth failures
   - Retry logic for network errors
   - Offline state detection

3. **Loading States**
   - Skeleton screens while loading profile
   - Per-service loading indicators (currently global)
   - Optimistic updates for disconnect actions

### Low Priority

1. **Settings Export/Import**
   - Allow users to backup settings
   - Restore settings on new device

2. **Advanced Notifications**
   - Quiet hours configuration
   - Per-user notification preferences
   - Email notifications toggle

3. **Advanced Privacy**
   - Blocked users list
   - Private account mode
   - Hide from search

## Testing Checklist

### OAuth Flows

- [ ] Spotify connect succeeds
- [ ] Spotify connect handles user cancellation
- [ ] Spotify disconnect works
- [ ] YouTube Music connect succeeds
- [ ] YouTube Music connect handles user cancellation
- [ ] YouTube Music disconnect works
- [ ] Multiple OAuth flows don't interfere with each other

### UI/UX

- [ ] All sections render correctly
- [ ] Back button navigates to previous screen
- [ ] Edit Profile navigates to profile screen
- [ ] Switches toggle correctly
- [ ] Loading spinner shows during OAuth
- [ ] Connection status updates in real-time
- [ ] Brand colors display correctly for each service

### Error Cases

- [ ] Network errors show appropriate alerts
- [ ] Invalid OAuth responses handled gracefully
- [ ] Backend errors display user-friendly messages
- [ ] Profile fails to load shows error state

### Responsiveness

- [ ] Works on iOS
- [ ] Works on Android
- [ ] Works on different screen sizes
- [ ] Safe area insets respected
- [ ] Scrolling works smoothly

## Troubleshooting

### OAuth Not Working

**Problem**: "Invalid redirect URI" error

**Solution**: 
- Verify redirect URI matches exactly in developer console
- Check scheme is registered in `app.json`
- Ensure `WebBrowser.maybeCompleteAuthSession()` is called

**Problem**: "Missing client ID" error

**Solution**:
- Verify constants are set correctly
- Check backend `.env` has client secrets
- Ensure OAuth request hook is initialized

### Connection Status Not Updating

**Problem**: Service shows disconnected after successful OAuth

**Solution**:
- Check backend returns updated user object
- Verify `setProfile(res.data.user)` is called
- Check User model includes `has_X_linked` fields

### Switches Not Working

**Problem**: Toggles don't persist after navigation

**Solution**:
- Implement backend persistence (current limitation)
- Add local storage as temporary fix
- Use AsyncStorage for persistence

## Performance Considerations

1. **Profile Fetching**: Only fetches on mount and user ID change
2. **OAuth Hooks**: Initialized once, not re-created on each render
3. **Subcomponents**: Defined inside component for access to state
4. **List Rendering**: Uses native components optimized for performance

## Accessibility

- All touchable elements have appropriate hit targets (44x44 min)
- Icons provide visual context for settings
- Switch components follow platform conventions
- Alert dialogs provide clear confirmation messaging
- Color contrast meets WCAG AA standards

## Related Files

- `src/api/endpoints.ts` - API client methods
- `src/store/authStore.ts` - User authentication state
- `src/types/index.ts` - User type definition
- `backend/app.py` - Backend OAuth implementations
- `app.json` - Deep linking configuration

## Version History

**v1.0.0** - Initial implementation
- All 5 music services UI
- Spotify and YouTube Music OAuth
- Notifications and privacy toggles (local only)
- Logout functionality
- Account deletion placeholder
