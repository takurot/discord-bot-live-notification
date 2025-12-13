export interface StreamProviderUser {
    id: string;
    name: string;
    displayName: string;
    url: string;
    thumbnailUrl: string;
}

export interface StreamProviderStream {
    id: string;
    userId: string;
    userDisplayName: string;
    title: string;
    gameName: string | null;
    viewerCount: number;
    startedAt: string;
    thumbnailUrl: string;
}

export interface StreamProvider {
    /**
     * Get user information by ID or name (e.g. username, handle)
     */
    getUser(idOrName: string): Promise<StreamProviderUser | null>;

    /**
     * Get current stream status for a user
     */
    getStream(userId: string): Promise<StreamProviderStream | null>;
}
