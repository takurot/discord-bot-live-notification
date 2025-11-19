import { EmbedBuilder } from 'discord.js';

export interface MockMessagePayload {
  content?: string;
  embeds?: EmbedBuilder[];
}

export class MockDiscordMessage {
  public content?: string;
  public embeds: EmbedBuilder[] = [];

  constructor(public readonly id: string, payload: MockMessagePayload) {
    this.content = payload.content;
    this.embeds = payload.embeds ?? [];
  }

  async edit(payload: MockMessagePayload): Promise<this> {
    if (payload.content !== undefined) {
      this.content = payload.content;
    }
    if (payload.embeds) {
      this.embeds = payload.embeds;
    }
    return this;
  }
}

export class MockTextChannel {
  private messageCounter = 0;
  private messageMap = new Map<string, MockDiscordMessage>();

  async send(payload: MockMessagePayload): Promise<MockDiscordMessage> {
    const messageId = `mock-message-${++this.messageCounter}`;
    const message = new MockDiscordMessage(messageId, payload);
    this.messageMap.set(messageId, message);
    return message;
  }

  public messages = {
    fetch: async (messageId: string): Promise<MockDiscordMessage> => {
      const message = this.messageMap.get(messageId);
      if (!message) {
        throw new Error(`Message ${messageId} not found`);
      }
      return message;
    },
  };

  getLastMessage(): MockDiscordMessage | undefined {
    const messages = Array.from(this.messageMap.values());
    return messages[messages.length - 1];
  }

  getSentCount(): number {
    return this.messageMap.size;
  }
}

export class MockDiscordClient {
  private channelsMap = new Map<string, MockTextChannel>();

  constructor(initialChannels: Record<string, MockTextChannel> = {}) {
    for (const [channelId, channel] of Object.entries(initialChannels)) {
      this.channelsMap.set(channelId, channel);
    }
  }

  public channels = {
    fetch: async (channelId: string): Promise<MockTextChannel> => {
      if (!this.channelsMap.has(channelId)) {
        this.channelsMap.set(channelId, new MockTextChannel());
      }
      return this.channelsMap.get(channelId)!;
    },
  };

  getChannel(channelId: string): MockTextChannel | undefined {
    return this.channelsMap.get(channelId);
  }
}
