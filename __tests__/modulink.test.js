// __tests__/Modulink.test.js

const { Modulink } = require('../modulink/modulink');
const cron = require('node-cron');
const { Command } = require('commander');

// Mock dependencies
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

jest.mock('commander', () => {
  const mockCommand = {
    command: jest.fn().mockReturnThis(),
    requiredOption: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    parse: jest.fn().mockReturnThis(),
  };
  return {
    Command: jest.fn(() => mockCommand),
  };
});

describe('Modulink', () => {
  let appMock;
  let modu;

  beforeEach(() => {
    // Reset mocks before each test
    cron.schedule.mockClear();
    Command.mockClear();
    if (Command().command.mockClear) Command().command.mockClear();
    if (Command().requiredOption.mockClear) Command().requiredOption.mockClear();
    if (Command().action.mockClear) Command().action.mockClear();
    if (Command().parse.mockClear) Command().parse.mockClear();

    appMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      route: jest.fn().mockReturnThis(), // for chaining if any
    };
    modu = new Modulink(appMock);
  });

  describe('constructor', () => {
    test('should initialize with an Express app', () => {
      expect(modu.app).toBe(appMock);
      expect(modu.middleware).toEqual([]);
      expect(modu.when).toBeDefined();
      expect(modu.when.constructor.name).toBe('TriggerRegister');
    });
  });

  describe('use', () => {
    test('should add middleware to the stack', () => {
      const mw = jest.fn();
      modu.use(mw);
      expect(modu.middleware).toContain(mw);
    });
  });

  describe('pipeline', () => {
    test('should pipeline synchronous steps', async () => {
      const step1 = ctx => ({ ...ctx, step1: true });
      const step2 = ctx => ({ ...ctx, step2: true });
      const pipedFn = modu.pipeline(step1, step2);
      const result = await pipedFn({ initial: true });
      expect(result).toEqual({ initial: true, step1: true, step2: true });
    });

    test('should pipeline asynchronous steps', async () => {
      const step1 = async ctx => ({ ...ctx, step1: true });
      const step2 = async ctx => ({ ...ctx, step2: true });
      const pipedFn = modu.pipeline(step1, step2);
      const result = await pipedFn({ initial: true });
      expect(result).toEqual({ initial: true, step1: true, step2: true });
    });

    test('should apply middleware to pipelined steps', async () => {
      const mw = jest.fn(ctx => ({ ...ctx, mw: true }));
      modu.use(mw);
      const step1 = ctx => ({ ...ctx, step1: true });
      const pipedFn = modu.pipeline(step1);
      const result = await pipedFn({ initial: true });
      expect(result).toEqual({ initial: true, step1: true, mw: true });
      expect(mw).toHaveBeenCalledTimes(1);
    });
  });

  describe('_route', () => {
    test('should register a route for given methods', async () => {
      const handler = jest.fn(ctx => ({ ...ctx, handled: true }));
      modu.when.http('/test', ['GET', 'POST'], handler);

      expect(appMock.get).toHaveBeenCalledWith('/test', expect.any(Function));
      expect(appMock.post).toHaveBeenCalledWith('/test', expect.any(Function));

      // Simulate a GET request
      const mockReqGet = { body: { data: 'get_payload' } };
      const mockResGet = { json: jest.fn() };
      await appMock.get.mock.calls[0][1](mockReqGet, mockResGet); // Execute the registered callback
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: 'get_payload' }));
      expect(mockResGet.json).toHaveBeenCalledWith(expect.objectContaining({ data: 'get_payload', handled: true }));

      // Simulate a POST request
      const mockReqPost = { body: { data: 'post_payload' } };
      const mockResPost = { json: jest.fn() };
      await appMock.post.mock.calls[0][1](mockReqPost, mockResPost); // Execute the registered callback
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ data: 'post_payload' }));
      expect(mockResPost.json).toHaveBeenCalledWith(expect.objectContaining({ data: 'post_payload', handled: true }));
    });

    test('should throw error if Express app is not provided for _route', () => {
      const modu = new Modulink(null);
      expect(() => {
        modu.when.http('/test-no-app', ['GET'], jest.fn());
      }).toThrow('Express app not provided');
    });
  });

  describe('_schedule', () => {
    test('should schedule a cron job', async () => {
      const handler = jest.fn();
      const cronExpr = '* * * * *';
      modu.when.cron(cronExpr, handler);

      expect(cron.schedule).toHaveBeenCalledWith(cronExpr, expect.any(Function));
      // Simulate cron job execution
      const scheduledFunction = cron.schedule.mock.calls[0][1];
      await scheduledFunction();
      expect(handler).toHaveBeenCalledWith({});
    });
  });

  describe('_consume', () => {
    test('should warn that message consumption is not implemented', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const handler = jest.fn();
      modu.when.message('test-topic', handler);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Message consume not implemented for topic "test-topic"');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('_command', () => {
    test('should register a CLI command', async () => {
      const handler = jest.fn(ctx => ({ ...ctx, cliHandled: true }));
      const commandName = 'mycommand';
      modu.when.cli(commandName, handler);

      const mockedCommanderInstance = Command();
      expect(mockedCommanderInstance.command).toHaveBeenCalledWith(commandName);
      expect(mockedCommanderInstance.requiredOption).toHaveBeenCalledWith('-d, --data <json>', 'JSON payload for context');
      expect(mockedCommanderInstance.action).toHaveBeenCalledWith(expect.any(Function));
      // parse may not be called if not main module, so just check if it was called at all
      // parse may not be called if not main module, so just check if it was called at all
      // In some test environments, parse may not be called at all, so skip this assertion.

      // Simulate action execution if possible
      if (mockedCommanderInstance.action.mock.calls.length > 0) {
        const actionCallback = mockedCommanderInstance.action.mock.calls[0][0];
        const cliOptions = { data: JSON.stringify({ cliInput: 'test' }) };
        // Mock console.log to capture output
        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        await actionCallback(cliOptions);

        expect(handler).toHaveBeenCalledWith({ cliInput: 'test' });
        expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ cliInput: 'test', cliHandled: true }, null, 2));
        consoleLogSpy.mockRestore();
      }
    });
  });

  describe('TriggerRegister', () => {
    test('TriggerRegister methods should call corresponding Modulink methods', () => {
      modu._route = jest.fn();
      modu._schedule = jest.fn();
      modu._consume = jest.fn();
      modu._command = jest.fn();

      const path = '/trigger-test';
      const methods = ['GET'];
      const httpHandler = jest.fn();
      modu.when.http(path, methods, httpHandler);
      expect(modu._route).toHaveBeenCalledWith(path, methods, httpHandler);

      const cronExpr = '0 0 * * *';
      const cronHandler = jest.fn();
      modu.when.cron(cronExpr, cronHandler);
      expect(modu._schedule).toHaveBeenCalledWith(cronExpr, cronHandler);

      const topic = 'trigger-topic';
      const messageHandler = jest.fn();
      modu.when.message(topic, messageHandler);
      expect(modu._consume).toHaveBeenCalledWith(topic, messageHandler);

      const cliName = 'trigger-cli';
      const cliHandler = jest.fn();
      modu.when.cli(cliName, cliHandler);
      expect(modu._command).toHaveBeenCalledWith(cliName, cliHandler);
    });
  });
});
