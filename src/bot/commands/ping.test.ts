import { ChatInputCommandInteraction, Client } from 'discord.js';
import { handlePingCommand } from './ping';

// Mock discord.js
jest.mock('discord.js');

describe('Ping Command', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockClient = {
      ws: {
        ping: 50,
      },
    } as unknown as jest.Mocked<Client>;

    mockInteraction = {
      reply: jest.fn().mockResolvedValue(undefined),
      client: mockClient,
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should reply with pong and latency', async () => {
    await handlePingCommand(mockInteraction);

    expect(mockInteraction.reply).toHaveBeenCalledTimes(1);
    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('Pong!'),
    });
  });

  it('should include latency in response', async () => {
    await handlePingCommand(mockInteraction);

    const replyCall = mockInteraction.reply.mock.calls[0][0];
    if (typeof replyCall === 'object' && replyCall !== null && 'content' in replyCall) {
      expect(replyCall.content).toMatch(/Latency: \d+ms/);
    }
  });
});

