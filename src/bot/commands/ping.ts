import { ChatInputCommandInteraction } from 'discord.js';

export async function handlePingCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const latency = interaction.client.ws.ping;
  await interaction.reply({
    content: `Pong! Latency: ${latency}ms`,
  });
}

