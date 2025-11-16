import { createGlobalErrorHandler, registerGlobalErrorHandlers } from './globalErrorHandler';

describe('createGlobalErrorHandler', () => {
  it('logs and exits on unhandled rejection', () => {
    const mockLogger = { error: jest.fn() } as any;
    const mockExit = jest.fn();

    const handler = createGlobalErrorHandler(mockLogger, mockExit);
    const reason = new Error('test rejection');

    handler.handleUnhandledRejection(reason);

    expect(mockLogger.error).toHaveBeenCalledWith('Unhandled promise rejection', { reason });
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('logs and exits on uncaught exception', () => {
    const mockLogger = { error: jest.fn() } as any;
    const mockExit = jest.fn();

    const handler = createGlobalErrorHandler(mockLogger, mockExit);
    const error = new Error('uncaught');

    handler.handleUncaughtException(error);

    expect(mockLogger.error).toHaveBeenCalledWith('Uncaught exception', { error });
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

describe('registerGlobalErrorHandlers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers process listeners and can dispose them', () => {
    const onSpy = jest.spyOn(process, 'on').mockReturnValue(process);
    const offSpy = jest.spyOn(process, 'off').mockReturnValue(process);

    const registered = registerGlobalErrorHandlers();

    expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));

    registered.dispose();

    expect(offSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
  });
});

