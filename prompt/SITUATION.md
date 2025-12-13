# Situation Overview

## Current Status
- **PubSubHubbub service** is fully implemented and unit‑tested (119 tests passing).
- **WebhookServer** is running on port `3000` and reachable via ngrok (`https://majuscular-nontreasonable-dario.ngrok-free.dev`).
- Docker `docker‑compose.yml` now includes `ports: "3000:3000"`, so the webhook endpoint is accessible from the host and ngrok.
- Adding a YouTube channel via `/notify add` creates a PubSubHubbub subscription and stores a **streamer record** in the database.
- Verification (`GET /callback?hub.challenge=…`) works – ngrok returns `200 OK`.

## Problem / Root Cause
- The **YouTube streamer record** stores the **handle** (e.g. `@cnbc`) in the `channel_id` column, while the `streamer_id` column correctly holds the YouTube **channel ID** (`UCvJJ_dzjViJCoLf5uKUTwoA`).
- The **polling service** and **PubSubHubbub notification handling** look up streamers by `channel_id`. Because the stored value is a handle, the YouTube API is queried with the wrong identifier, resulting in **no live‑stream detection**.
- Consequently, even though the PubSubHubbub subscription is active, the bot never emits a Discord notification for an ongoing live stream (e.g., CNBC).

## Known Facts
- The YouTube API call `search?eventType=live` returns a live video for the correct channel ID (`UCvJJ_dzjViJCoLf5uKUTwoA`).
- Database query shows the streamer entry:
  ```
  username | platform | channel_id | last_status | server_id
  ---------+----------+------------+-------------+---------------------
   CNBC   | YouTube  | @cnbc      | Live        | 1397396548039479356
  ```
- `streamer_id` is correct (`UCvJJ_dzjViJCoLf5uKUTwoA`).
- The `/notify add` command already obtains `user.id` (the channel ID) from `YouTubeApiClient.getUser`.

## What Needs to Be Done
1. **Update `src/bot/commands/notify/add.ts`**:
   - When creating a new streamer record for YouTube, store `channelId: user.id` (the channel ID) **or** add a separate field for the handle if needed.
   - Adjust the lookup to use `streamer_id` (or both) when fetching a streamer for YouTube.
2. **Add a migration / data‑fix** for existing records that have a handle in `channel_id` (e.g., update CNBC entry to the proper channel ID).
3. **Update repository methods** (`findByPlatformAndChannelId`) to optionally search by `streamer_id` for YouTube.
4. **Add/adjust tests** to verify that a YouTube streamer is stored with the correct channel ID and that the polling service detects a live stream.
5. **Manual verification**:
   - Add a fresh YouTube channel via `/notify add`.
   - Start a live stream on that channel.
   - Confirm the bot posts a Discord notification.

## Next Steps
- Implement the code changes in `add.ts` and `StreamerRepository`.
- Run a migration script to fix existing records.
- Re‑run the test suite (should still pass).
- Perform the manual end‑to‑end test described above.

---
*Generated on 2025‑11‑21 by Antigravity.*
