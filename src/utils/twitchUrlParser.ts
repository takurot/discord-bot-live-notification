/**
 * Twitch URLからチャンネル名（ログイン名）を抽出する
 * @param url Twitch URL (例: https://www.twitch.tv/ninja)
 * @returns チャンネル名（例: ninja）
 * @throws {Error} URLが無効な場合
 */
export function parseTwitchUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid Twitch URL');
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // twitch.tv ドメインかチェック
    if (!hostname.includes('twitch.tv')) {
      throw new Error('Invalid Twitch URL');
    }

    // パスからチャンネル名を抽出
    const pathParts = urlObj.pathname.split('/').filter((part) => part.length > 0);

    if (pathParts.length === 0) {
      throw new Error('Invalid Twitch URL: channel name not found');
    }

    // 最初のパスセグメントがチャンネル名
    const channelName = pathParts[0].toLowerCase();

    if (!channelName || channelName.length === 0) {
      throw new Error('Invalid Twitch URL: channel name is empty');
    }

    return channelName;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid Twitch URL')) {
      throw error;
    }
    throw new Error('Invalid Twitch URL');
  }
}
