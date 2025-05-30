// __tests__/modulink.test.js

import { jest } from '@jest/globals';
import { Modulink } from '../modulink/modulink.js';

describe('Modulink', () => {
  let appMock;
  let modu;

  beforeEach(() => {
    // Suppress deprecation warnings during tests
    process.env.MODULINK_SUPPRESS_DEPRECATION_WARNINGS = 'true';
    
    appMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      route: jest.fn().mockReturnThis(),
    };
    modu = new Modulink(appMock);
  });

  afterEach(() => {
    delete process.env.MODULINK_SUPPRESS_DEPRECATION_WARNINGS;
  });

  describe('constructor', () => {
    test('should initialize with an Express app', () => {
      expect(modu.app).toBe(appMock);
      expect(modu.middleware).toEqual([]);
      expect(modu.when).toBeDefined();
      expect(modu.when.http).toBeInstanceOf(Function);
      expect(modu.when.cron).toBeInstanceOf(Function);
      expect(modu.when.message).toBeInstanceOf(Function);
      expect(modu.when.cli).toBeInstanceOf(Function);
    });
  });

  describe('use', () => {
    test('should add middleware to the stack', () => {
      const middleware1 = jest.fn();
      const middleware2 = jest.fn();
      modu.use(middleware1);
      modu.use(middleware2);
      expect(modu.middleware).toContain(middleware1);
      expect(modu.middleware).toContain(middleware2);
      expect(modu.middleware).toHaveLength(2);
    });
  });

  describe('chain', () => {
    test('should chain synchronous steps', async () => {
      const step1 = jest.fn(ctx => ({ ...ctx, step1: true }));
      const step2 = jest.fn(ctx => ({ ...ctx, step2: true }));
      const steps = [step1, step2];
      const context = { initial: true };

      const result = await modu.chain(steps, context);

      expect(step1).toHaveBeenCalledWith({ initial: true });
      expect(step2).toHaveBeenCalledWith({ initial: true, step1: true });
      expect(result).toEqual({ initial: true, step1: true, step2: true });
    });

    test('should chain asynchronous steps', async () => {
      const step1 = jest.fn(async ctx => ({ ...ctx, step1: true }));
      const step2 = jest.fn(async ctx => ({ ...ctx, step2: true }));
      const steps = [step1, step2];
      const context = { initial: true };

      const result = await modu.chain(steps, context);

      expect(step1).toHaveBeenCalledWith({ initial: true });
      expect(step2).toHaveBeenCalledWith({ initial: true, step1: true });
      expect(result).toEqual({ initial: true, step1: true, step2: true });
    });

    test('should apply middleware to chained steps', async () => {
      const middleware1 = jest.fn(async ctx => ({ ...ctx, middleware1: true }));
      const middleware2 = jest.fn(async ctx => ({ ...ctx, middleware2: true }));
      modu.use(middleware1);
      modu.use(middleware2);

      const step1 = jest.fn(ctx => ({ ...ctx, step1: true }));
      const steps = [step1];
      const context = { initial: true };

      const result = await modu.chain(steps, context);

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(step1).toHaveBeenCalled();
      expect(result).toMatchObject({ initial: true, step1: true });
    });
  });

  describe('_route', () => {
    test('should register a route for given methods', () => {
      const handler = jest.fn();
      const path = '/test';
      const methods = ['GET', 'POST'];
      modu._route(path, methods, handler);

      expect(appMock.get).toHaveBeenCalledWith(path, expect.any(Function));
      expect(appMock.post).toHaveBeenCalledWith(path, expect.any(Function));
    });

    test('should throw error if Express app is not provided for _route', () => {
      const moduWithoutApp = new Modulink();
      const handler = jest.fn();
      expect(() => {
        moduWithoutApp._route('/test', ['GET'], handler);
      }).toThrow('Express app is required for HTTP routes');
    });
  });

  describe('_schedule', () => {
    test('should schedule a cron job', () => {
      const handler = jest.fn();
      const cronExpr = '* * * * *';
      
      expect(() => {
        modu.when.cron(cronExpr, handler);
      }).not.toThrow();
      
      expect(handler).toBeDefined();
    });
  });

  describe('_consume', () => {
    test('should warn that message consumption is not implemented', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const handler = jest.fn();
      const topic = 'test-topic';
      modu._consume(topic, handler);
      expect(consoleSpy).toHaveBeenCalledWith('Message consumption not yet implemented');
      consoleSpy.mockRestore();
    });
  });

  describe('_command', () => {
    test('should register a CLI command', () => {
      const handler = jest.fn(ctx => ({ ...ctx, cliHandled: true }));
      const commandName = 'mycommand';
      
      expect(() => {
        modu.when.cli(commandName, handler);
      }).not.toThrow();
      
      expect(handler).toBeDefined();
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
