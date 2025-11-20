import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js';
import { YouTubeApiClient } from '../../../services/youtube/YouTubeApiClient';

export async function handleYoutubeCheckCommand(
    interaction: ChatInputCommandInteraction,
    youtubeApiClient: YouTubeApiClient
): Promise<void> {
    const url = interaction.options.getString('url', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        // 1. URLからハンドルまたはIDを抽出 (簡易的な実装)
        let handleOrId = url;
        if (url.includes('youtube.com/')) {
            const parts = url.split('/');
            const lastPart = parts[parts.length - 1];
            handleOrId = lastPart;
            if (url.includes('@')) {
                handleOrId = parts.find(p => p.startsWith('@')) || lastPart;
            }
        }

        // 2. チャンネル情報取得
        const channel = await youtubeApiClient.getChannel(handleOrId);

        if (!channel) {
            await interaction.editReply(`❌ チャンネルが見つかりませんでした: ${handleOrId}`);
            return;
        }

        // 3. 配信ステータス取得
        const streamStatus = await youtubeApiClient.getStreamStatus(channel.id);

        // 4. 結果表示
        const embed = new EmbedBuilder()
            .setTitle('📺 YouTube API Verification')
            .setColor('#FF0000')
            .setThumbnail(channel.thumbnailUrl)
            .addFields(
                { name: 'Channel Name', value: channel.title, inline: true },
                { name: 'Channel ID', value: channel.id, inline: true },
                { name: 'Custom URL', value: channel.customUrl || 'N/A', inline: true },
                { name: 'Status', value: streamStatus.isLive ? '🔴 LIVE' : '⚫ Offline', inline: false }
            );

        if (streamStatus.isLive) {
            embed.addFields(
                { name: 'Stream Title', value: streamStatus.title || 'Unknown', inline: false },
                { name: 'Video ID', value: streamStatus.videoId || 'Unknown', inline: true },
                { name: 'Started At', value: streamStatus.startedAt || 'Unknown', inline: true }
            );
            if (streamStatus.thumbnailUrl) {
                embed.setImage(streamStatus.thumbnailUrl);
            }
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error(error);
        await interaction.editReply(`❌ エラーが発生しました: ${(error as Error).message}`);
    }
}
