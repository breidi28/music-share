import axios from 'axios';
import client, { API_BASE_URL } from './client';
import {
    PaginatedPosts,
    User,
    Comment,
    MusicSearchResult,
    CollectionItem,
    CollectionResponse,
    NotificationPreferences,
    ListenLaterItem,
    ReactionType,
    PostReactionsPayload,
    CollabList,
    CollabListTrack,
    WeeklyRecap,
    ArtistDiscographyProgressSummary,
    ArtistDiscographyProgressDetail,
    Post,
    AppNotification,
} from '../types';

// Auth
export const authApi = {
    getMe: () => client.get('/auth/me'),
    // Uses a bare axios call (not the shared `client`) because client's request
    // interceptor always injects the stored *app* token when present, which would
    // clobber this Clerk token on subsequent (post-first-login) exchange calls.
    clerkExchange: (clerkToken: string) =>
        axios.post<{ token: string; user: User }>(
            `${API_BASE_URL}/auth/clerk-exchange`,
            undefined,
            { headers: { Authorization: `Bearer ${clerkToken}` }, timeout: 20000 }
        ),
};

// Users
export const usersApi = {
    getUser: (userId: number) => client.get<User>(`/users/${userId}`),
    search: (q: string) => client.get<User[]>(`/users/search?q=${encodeURIComponent(q)}`),
    mentionSearch: (q: string) =>
        client.get<Array<{ id: number; username: string; display_name: string; avatar_url: string }>>(`/users/mention-search?q=${encodeURIComponent(q)}`),
    follow: (userId: number) => client.post(`/users/${userId}/follow`),
    getUserPosts: (userId: number, postType?: string, page = 1) =>
        client.get<PaginatedPosts>(`/users/${userId}/posts`, { params: { type: postType, page } }),
    getFollowers: (userId: number) => client.get<User[]>(`/users/${userId}/followers`),
    getFollowing: (userId: number) => client.get<User[]>(`/users/${userId}/following`),
    updateProfile: (data: Partial<User>) => client.put('/users/me', data),
    getTasteMatch: (userId: number) => client.get<{ match: number }>(`/users/${userId}/taste`),
};

// Posts
export const postsApi = {
    create: (data: {
        track_title: string;
        artist: string;
        album?: string;
        album_art_url?: string;
        caption?: string;
        post_type?: string;
        preview_url?: string;
        genre?: string;
    }) => client.post('/posts', data),
    getFeed: (page = 1) => client.get<PaginatedPosts>('/feed', { params: { page } }),
    likePost: (postId: number) => client.post(`/posts/${postId}/like`),
    deletePost: (postId: number) => client.delete(`/posts/${postId}`),
    getComments: (postId: number) => client.get<Comment[]>(`/posts/${postId}/comments`),
    addComment: (postId: number, text: string, parentId?: number) =>
        client.post(`/posts/${postId}/comments`, { text, parent_id: parentId }),
    pinComment: (postId: number, commentId: number) => client.post(`/posts/${postId}/pin-comment/${commentId}`),
    unpinComment: (postId: number) => client.delete(`/posts/${postId}/pin-comment`),
    getReactions: (postId: number) => client.get<PostReactionsPayload>(`/posts/${postId}/reactions`),
    addReaction: (postId: number, reactionType: ReactionType) =>
        client.post(`/posts/${postId}/reactions`, { reaction_type: reactionType }),
    removeReaction: (postId: number, reactionType: ReactionType) =>
        client.delete(`/posts/${postId}/reactions/${reactionType}`),
};

// Explore
export const exploreApi = {
    getPosts: (page = 1, genre?: string) =>
        client.get<PaginatedPosts>('/explore', { params: { page, genre } }),
    getRecommendations: () =>
        client.get<{
            because_you_liked: Array<{ reason: string; post: Post }>;
            genre_chips: string[];
            artist_chips: string[];
        }>('/explore/recommendations'),
};

// Spotify
export const spotifyApi = {
    callback: (code: string, redirectUri: string) => client.post('/integrations/spotify/callback', { code, redirect_uri: redirectUri }),
    getLive: (userId?: number) =>
        client.get('/integrations/spotify/live', {
            params: { user_id: userId },
            timeout: 20000,
        }),
    getRecent: (userId?: number) => client.get('/integrations/spotify/recent', { params: { user_id: userId } }),
    getTopArtists: (userId?: number) => client.get('/integrations/spotify/top-artists', { params: { user_id: userId } }),
    getPlaylists: (userId?: number) => client.get('/integrations/spotify/playlists', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/spotify/disconnect'),
};

// YouTube Music
export const youtubeApi = {
    callback: (code: string, redirectUri: string) => client.post('/integrations/youtube/callback', { code, redirect_uri: redirectUri }),
    linkWithToken: (accessToken: string) => client.post('/integrations/youtube/link-token', { access_token: accessToken }),
    getPlaylists: (userId?: number) => client.get('/integrations/youtube/playlists', { params: { user_id: userId }, suppressToast: true }),
    getHistory: (userId?: number) => client.get('/integrations/youtube/history', { params: { user_id: userId }, suppressToast: true }),
    getLiked: (userId?: number) => client.get('/integrations/youtube/liked', { params: { user_id: userId }, suppressToast: true }),
    disconnect: () => client.delete('/integrations/youtube/disconnect'),
};

// Apple Music
export const appleMusicApi = {
    callback: (userToken: string) => client.post('/integrations/apple/callback', { user_token: userToken }),
    getPlaylists: (userId?: number) => client.get('/integrations/apple/playlists', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/apple/disconnect'),
};

// Tidal
export const tidalApi = {
    getAuthUrl: () => client.get('/integrations/tidal/auth-url'),
    callback: (accessToken: string, refreshToken?: string, userId?: string) => 
        client.post('/integrations/tidal/callback', { access_token: accessToken, refresh_token: refreshToken, user_id: userId }),
    getPlaylists: (userId?: number) => client.get('/integrations/tidal/playlists', { params: { user_id: userId } }),
    getFavorites: (userId?: number) => client.get('/integrations/tidal/favorites', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/tidal/disconnect'),
};

// Qobuz
export const qobuzApi = {
    login: (username: string, password: string) => client.post('/integrations/qobuz/login', { username, password }),
    getPlaylists: (userId?: number) => client.get('/integrations/qobuz/playlists', { params: { user_id: userId } }),
    getFavorites: (userId?: number) => client.get('/integrations/qobuz/favorites', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/qobuz/disconnect'),
};

// Deezer
export const deezerApi = {
    callback: (code: string) => client.post('/integrations/deezer/callback', { code }),
    getPlaylists: (userId?: number) => client.get('/integrations/deezer/playlists', { params: { user_id: userId } }),
    getFavorites: (userId?: number) => client.get('/integrations/deezer/favorites', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/deezer/disconnect'),
};

// Music search (iTunes)
export const musicApi = {
    search: (q: string) => client.get<MusicSearchResult[]>(`/music/search?q=${encodeURIComponent(q)}`),
    searchAlbums: (q: string, albumsOnly = false) =>
        client.get<MusicSearchResult[]>(`/music/search_albums?q=${encodeURIComponent(q)}&albums_only=${albumsOnly ? 'true' : 'false'}`),
    searchByBarcode: (barcode: string) => client.get<MusicSearchResult>(`/music/barcode/${barcode}`),
};

// Notifications
export const notificationsApi = {
    getAll: () => client.get<{ notifications: AppNotification[]; unread_count: number }>('/notifications'),
    markRead: (id: number) => client.put(`/notifications/${id}/read`),
    markAllRead: () => client.put('/notifications/read_all'),
    getPreferences: () => client.get<NotificationPreferences>('/notifications/preferences'),
    updatePreferences: (data: Partial<NotificationPreferences>) =>
        client.put<NotificationPreferences>('/notifications/preferences', data),
};

// Listen Later
export const listenLaterApi = {
    getAll: () => client.get<ListenLaterItem[]>('/listen-later'),
    add: (data: Omit<ListenLaterItem, 'id' | 'user_id' | 'added_at'>) => client.post<ListenLaterItem>('/listen-later', data),
    remove: (itemId: number) => client.delete(`/listen-later/${itemId}`),
};

// Collection
export const collectionApi = {
    getCollection: (userId?: number, mediaType?: string) => 
        client.get<CollectionResponse>('/collection', { params: { user_id: userId, type: mediaType } }),
    addItem: (data: Partial<CollectionItem>) => client.post<CollectionItem>('/collection', data),
    updateItem: (id: number, data: Partial<CollectionItem>) => client.put<CollectionItem>(`/collection/${id}`, data),
    removeItem: (id: number) => client.delete(`/collection/${id}`),
    getArtistProgress: (userId?: number, limit = 12) =>
        client.get<ArtistDiscographyProgressSummary[]>('/collection/artist-progress', {
            params: { user_id: userId, limit },
        }),
    getArtistProgressDetails: (artist: string, userId?: number) =>
        client.get<ArtistDiscographyProgressDetail>('/collection/artist-progress/details', {
            params: { artist, user_id: userId },
        }),
};

// Activity Feed
export const activityApi = {
    getFeed: (page = 1) => client.get<PaginatedPosts>('/activity', { params: { page } }),
};

// Weekly Recap
export const recapApi = {
    getLatest: () => client.get<WeeklyRecap>('/recap/latest'),
    getHistory: () => client.get<WeeklyRecap[]>('/recap/history'),
};

// Collaborative Lists
export const collabListsApi = {
    getAll: () => client.get<CollabList[]>('/collab-lists'),
    create: (data: { name: string; description?: string; is_weekly_challenge?: boolean; starts_at?: string; ends_at?: string }) =>
        client.post<CollabList>('/collab-lists', data),
    invite: (listId: number, userId: number) =>
        client.post(`/collab-lists/${listId}/invite`, { user_id: userId }),
    addTrack: (listId: number, data: Omit<CollabListTrack, 'id' | 'list_id' | 'added_by' | 'created_at' | 'added_by_user'>) =>
        client.post<CollabListTrack>(`/collab-lists/${listId}/tracks`, data),
    removeTrack: (listId: number, trackId: number) =>
        client.delete(`/collab-lists/${listId}/tracks/${trackId}`),
};
