import type { Logger } from 'winston';
import { logger as defaultLogger } from './logger';

export type ExitFunction = (code: number) => void;

export interface GlobalErrorHandler {
  handleUnhandledRejection: (reason: unknown) => void;
  handleUncaughtException: (error: Error) => void;
}

export function createGlobalErrorHandler(
  customLogger: Logger = defaultLogger,
  exitFn: ExitFunction = process.exit.bind(process)
): GlobalErrorHandler {
  return {
    handleUnhandledRejection: (reason: unknown) => {
      customLogger.error('Unhandled promise rejection', { reason });
      exitFn(1);
    },
    handleUncaughtException: (error: Error) => {
      customLogger.error('Uncaught exception', { error });
      exitFn(1);
    },
  };
}

export function registerGlobalErrorHandlers() {
  const handler = createGlobalErrorHandler();

  const unhandledRejectionListener = (reason: unknown) => handler.handleUnhandledRejection(reason);
  const uncaughtExceptionListener = (error: Error) => handler.handleUncaughtException(error);

  process.on('unhandledRejection', unhandledRejectionListener);
  process.on('uncaughtException', uncaughtExceptionListener);

  return {
    ...handler,
    dispose: () => {
      process.off('unhandledRejection', unhandledRejectionListener);
      process.off('uncaughtException', uncaughtExceptionListener);
    },
  };
}
