import type { Logger } from 'winston';
import { logger as defaultLogger } from './logger';

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  logger?: Logger;
  operationName?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryWithExponentialBackoff<T>(
  task: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 500,
    maxDelayMs,
    logger = defaultLogger,
    operationName = 'operation',
  } = options;

  let delay = baseDelayMs;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      const delayMs = Math.min(delay, maxDelayMs ?? delay);
      logger.warn(`Retrying operation ${operationName}`, {
        attempt: attempt + 1,
        delayMs,
      });

      await sleep(delayMs);

      delay = maxDelayMs ? Math.min(delay * 2, maxDelayMs) : delay * 2;
    }
  }

  throw new Error(`Retry logic exited unexpectedly for ${operationName}`);
}
