import client from './client';
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
} from '../types';

// Auth
export const authApi = {
    register: (data: { username: string; email: string; password: string; display_name: string; bio?: string; favorite_genres?: string }) =>
        client.post('/auth/register', data),
    login: (username: string, password: string) =>
        client.post('/auth/login', { username, password }),
    getMe: () => client.get('/auth/me'),
};

// Users
export const usersApi = {
    getUser: (userId: number) => client.get<User>(`/users/${userId}`),
    search: (q: string) => client.get<User[]>(`/users/search?q=${encodeURIComponent(q)}`),
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
};

// Spotify
export const spotifyApi = {
    callback: (code: string, redirectUri: string) => client.post('/integrations/spotify/callback', { code, redirect_uri: redirectUri }),
    getLive: (userId?: number) => client.get('/integrations/spotify/live', { params: { user_id: userId } }),
    getRecent: (userId?: number) => client.get('/integrations/spotify/recent', { params: { user_id: userId } }),
    getTopArtists: (userId?: number) => client.get('/integrations/spotify/top-artists', { params: { user_id: userId } }),
    getPlaylists: (userId?: number) => client.get('/integrations/spotify/playlists', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/spotify/disconnect'),
};

// YouTube Music
export const youtubeApi = {
    callback: (code: string, redirectUri: string) => client.post('/integrations/youtube/callback', { code, redirect_uri: redirectUri }),
    linkWithToken: (accessToken: string) => client.post('/integrations/youtube/link-token', { access_token: accessToken }),
    getPlaylists: (userId?: number) => client.get('/integrations/youtube/playlists', { params: { user_id: userId } }),
    getHistory: (userId?: number) => client.get('/integrations/youtube/history', { params: { user_id: userId } }),
    getLiked: (userId?: number) => client.get('/integrations/youtube/liked', { params: { user_id: userId } }),
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
    searchAlbums: (q: string) => client.get<MusicSearchResult[]>(`/music/search_albums?q=${encodeURIComponent(q)}`),
    searchByBarcode: (barcode: string) => client.get<any>(`/music/barcode/${barcode}`),
};

// Notifications
export const notificationsApi = {
    getAll: () => client.get<{ notifications: any[], unread_count: number }>('/notifications'),
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
};

// Activity Feed
export const activityApi = {
    getFeed: (page = 1) => client.get<PaginatedPosts>('/activity', { params: { page } }),
};
