export type Platform = 'Twitch' | 'YouTube';

export function detectPlatform(url: string): Platform | null {
  if (url.includes('twitch.tv')) {
    return 'Twitch';
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return 'YouTube';
  }
  return null;
}

export function parseTwitchUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('twitch.tv')) {
      return null;
    }
    const pathParts = parsedUrl.pathname.split('/').filter((part) => part.length > 0);
    if (pathParts.length === 0) {
      return null;
    }
    return pathParts[0];
  } catch {
    return null;
  }
}

export function parseYoutubeUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    // Handle youtube.com/channel/ID
    if (parsedUrl.pathname.startsWith('/channel/')) {
      return parsedUrl.pathname.split('/')[2];
    }
    // Handle youtube.com/@handle
    if (parsedUrl.pathname.startsWith('/@')) {
      return parsedUrl.pathname.substring(1); // Remove leading /
    }
    // Handle youtube.com/c/CustomURL or youtube.com/user/User
    if (parsedUrl.pathname.startsWith('/c/') || parsedUrl.pathname.startsWith('/user/')) {
      return parsedUrl.pathname.split('/')[2];
    }
    // Handle simple youtube.com/Handle (if supported?) or just return null for now if unsure
    // YouTube handles are usually with @.

    return null;
  } catch {
    return null;
  }
}
