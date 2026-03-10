import client from './client';
import { PaginatedPosts, User, Comment, MusicSearchResult, CollectionItem, CollectionResponse } from '../types';

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
    addComment: (postId: number, text: string) => client.post(`/posts/${postId}/comments`, { text }),
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
    getPlaylists: (userId?: number) => client.get('/integrations/youtube/playlists', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/youtube/disconnect'),
};

// Apple Music
export const appleMusicApi = {
    callback: (userToken: string) => client.post('/integrations/apple/callback', { user_token: userToken }),
    getPlaylists: (userId?: number) => client.get('/integrations/apple/playlists', { params: { user_id: userId } }),
    disconnect: () => client.delete('/integrations/apple/disconnect'),
};

// Music search (iTunes)
export const musicApi = {
    search: (q: string) => client.get<MusicSearchResult[]>(`/music/search?q=${encodeURIComponent(q)}`),
};

// Notifications
export const notificationsApi = {
    getAll: () => client.get<{ notifications: any[], unread_count: number }>('/notifications'),
    markRead: (id: number) => client.put(`/notifications/${id}/read`),
    markAllRead: () => client.put('/notifications/read_all'),
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
