// __tests__/business_logic.test.js

import { entry, increment, double, respond } from '../example/business_logic.js';

describe('Business Logic Tests', () => {
  describe('entry', () => {
    test('should return the initial context object', () => {
      const ctx = { data: 'test' };
      expect(entry(ctx)).toBe(ctx);
    });

    test('should return an empty object if context is empty', () => {
      const ctx = {};
      expect(entry(ctx)).toEqual({});
    });
  });

  describe('increment', () => {
    test('should increment the value in context by 1', () => {
      const ctx = { value: 5 };
      expect(increment(ctx)).toEqual({ value: 6 });
    });

    test('should initialize value to 1 if not present', () => {
      const ctx = {};
      expect(increment(ctx)).toEqual({ value: 1 });
    });

    test('should handle existing value of 0', () => {
      const ctx = { value: 0 };
      expect(increment(ctx)).toEqual({ value: 1 });
    });
  });

  describe('double', () => {
    test('should double the value in context', () => {
      const ctx = { value: 5 };
      expect(double(ctx)).toEqual({ value: 10 });
    });

    test('should result in 0 if value is 0', () => {
      const ctx = { value: 0 };
      expect(double(ctx)).toEqual({ value: 0 });
    });

    test('should handle negative numbers', () => {
      const ctx = { value: -3 };
      expect(double(ctx)).toEqual({ value: -6 });
    });

    test('should not change context if value is not a number (or handle as error, current behavior is NaN)', () => {
      // Current implementation will result in NaN if value is not a number.
      // Depending on desired behavior, this could be an error case.
      const ctx = { value: 'abc' };
      expect(double(ctx).value).toBeNaN();
    });

     test('should not modify context if value is undefined (current behavior is NaN)', () => {
      const ctx = {};
      expect(double(ctx).value).toBeNaN();
    });
  });

  describe('respond', () => {
    test('should return an object with the value under the "result" key', () => {
      const ctx = { value: 42 };
      expect(respond(ctx)).toEqual({ result: 42 });
    });

    test('should return result as undefined if value is not in context', () => {
      const ctx = {};
      expect(respond(ctx)).toEqual({ result: undefined });
    });

    test('should handle various types of values', () => {
      const ctx1 = { value: 'hello' };
      expect(respond(ctx1)).toEqual({ result: 'hello' });

      const ctx2 = { value: null };
      expect(respond(ctx2)).toEqual({ result: null });
    });
  });
});
