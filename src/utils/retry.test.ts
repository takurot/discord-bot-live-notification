import { retryWithExponentialBackoff } from './retry';

describe('retryWithExponentialBackoff', () => {
  const mockLogger = {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should retry failed operations and eventually resolve', async () => {
    const task = jest
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce('success');

    const expectation = expect(
      retryWithExponentialBackoff(task, {
        baseDelayMs: 100,
        retries: 2,
        logger: mockLogger as any,
        operationName: 'test-operation',
      })
    ).resolves.toBe('success');

    await jest.advanceTimersByTimeAsync(100);

    await expectation;
    expect(task).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Retrying operation test-operation',
      expect.objectContaining({ attempt: 1, delayMs: 100 })
    );
  });

  it('should throw when retries are exhausted', async () => {
    const task = jest.fn().mockRejectedValue(new Error('permanent failure'));

    const expectation = expect(
      retryWithExponentialBackoff(task, {
        baseDelayMs: 50,
        retries: 2,
        logger: mockLogger as any,
        operationName: 'failing-operation',
      })
    ).rejects.toThrow('permanent failure');

    await jest.runAllTimersAsync();

    await expectation;
    expect(task).toHaveBeenCalledTimes(3);
  });
});
