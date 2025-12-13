describe('logger configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('defaults to debug level in development', () => {
    process.env.NODE_ENV = 'development';

    jest.isolateModules(() => {
      const { logger } = require('./logger');
      expect(logger.level).toBe('debug');
    });
  });

  it('respects LOG_LEVEL override', () => {
    process.env.LOG_LEVEL = 'warn';

    jest.isolateModules(() => {
      const { logger } = require('./logger');
      expect(logger.level).toBe('warn');
    });
  });
});
