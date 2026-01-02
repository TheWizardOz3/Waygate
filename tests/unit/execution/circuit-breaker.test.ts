import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, createCircuitBreaker, CircuitOpenError } from '@/lib/modules/execution';

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = createCircuitBreaker({
      failureThreshold: 3,
      failureWindowMs: 10000,
      resetTimeoutMs: 5000,
      successThreshold: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState('test-circuit')).toBe('closed');
    });

    it('should allow execution in closed state', () => {
      expect(circuitBreaker.canExecute('test-circuit')).toBe(true);
    });
  });

  describe('closed → open transition', () => {
    it('should open after reaching failure threshold', () => {
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      expect(circuitBreaker.getState('test-circuit')).toBe('closed');

      circuitBreaker.recordFailure('test-circuit');
      expect(circuitBreaker.getState('test-circuit')).toBe('open');
    });

    it('should block execution when open', () => {
      // Trigger circuit open
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      expect(circuitBreaker.canExecute('test-circuit')).toBe(false);
    });

    it('should only count failures within the window', () => {
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      // Advance time past failure window
      vi.advanceTimersByTime(11000);

      // Old failures should be pruned, this should not open
      circuitBreaker.recordFailure('test-circuit');
      expect(circuitBreaker.getState('test-circuit')).toBe('closed');
    });
  });

  describe('open → half-open transition', () => {
    it('should transition to half-open after reset timeout', () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      expect(circuitBreaker.getState('test-circuit')).toBe('open');

      // Advance time past reset timeout
      vi.advanceTimersByTime(6000);

      // Should now be half-open (getState triggers transition check)
      expect(circuitBreaker.getState('test-circuit')).toBe('half-open');
    });

    it('should allow execution in half-open state', () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      // Advance past reset timeout
      vi.advanceTimersByTime(6000);

      expect(circuitBreaker.canExecute('test-circuit')).toBe(true);
    });
  });

  describe('half-open → closed transition', () => {
    it('should close after success threshold met', () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      // Advance past reset timeout (half-open)
      vi.advanceTimersByTime(6000);
      circuitBreaker.canExecute('test-circuit'); // Trigger transition

      // Record success
      circuitBreaker.recordSuccess('test-circuit');

      expect(circuitBreaker.getState('test-circuit')).toBe('closed');
    });
  });

  describe('half-open → open transition', () => {
    it('should re-open on failure in half-open state', () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      // Advance past reset timeout (half-open)
      vi.advanceTimersByTime(6000);
      circuitBreaker.canExecute('test-circuit'); // Trigger transition

      // Record failure - should re-open
      circuitBreaker.recordFailure('test-circuit');

      expect(circuitBreaker.getState('test-circuit')).toBe('open');
    });
  });

  describe('success in closed state', () => {
    it('should clear old failures on success', () => {
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      // Success should help clear old failures
      circuitBreaker.recordSuccess('test-circuit');

      const status = circuitBreaker.getStatus('test-circuit');
      expect(status.state).toBe('closed');
    });
  });

  describe('multiple circuits', () => {
    it('should track circuits independently', () => {
      // Open circuit A
      circuitBreaker.recordFailure('circuit-a');
      circuitBreaker.recordFailure('circuit-a');
      circuitBreaker.recordFailure('circuit-a');

      // Circuit B should still be closed
      expect(circuitBreaker.getState('circuit-a')).toBe('open');
      expect(circuitBreaker.getState('circuit-b')).toBe('closed');
      expect(circuitBreaker.canExecute('circuit-b')).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return detailed status', () => {
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      const status = circuitBreaker.getStatus('test-circuit');

      expect(status.circuitId).toBe('test-circuit');
      expect(status.state).toBe('closed');
      expect(status.failureCount).toBe(2);
    });

    it('should include timeUntilResetMs when open', () => {
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      const status = circuitBreaker.getStatus('test-circuit');

      expect(status.state).toBe('open');
      expect(status.timeUntilResetMs).toBeDefined();
      expect(status.timeUntilResetMs).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should manually reset to closed state', () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      expect(circuitBreaker.getState('test-circuit')).toBe('open');

      // Manual reset
      circuitBreaker.reset('test-circuit');

      expect(circuitBreaker.getState('test-circuit')).toBe('closed');
      expect(circuitBreaker.canExecute('test-circuit')).toBe(true);
    });
  });

  describe('execute helper', () => {
    it('should execute function and record success', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result = await circuitBreaker.execute('test-circuit', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });

    it('should throw CircuitOpenError when circuit is open', async () => {
      // Open the circuit
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');
      circuitBreaker.recordFailure('test-circuit');

      const fn = vi.fn().mockResolvedValue('result');

      await expect(circuitBreaker.execute('test-circuit', fn)).rejects.toThrow(CircuitOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('should record failure when function throws', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(circuitBreaker.execute('test-circuit', fn)).rejects.toThrow('test error');

      const status = circuitBreaker.getStatus('test-circuit');
      expect(status.failureCount).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all circuit states', () => {
      circuitBreaker.recordFailure('circuit-a');
      circuitBreaker.recordFailure('circuit-b');

      circuitBreaker.clearAll();

      expect(circuitBreaker.getCircuitIds()).toEqual([]);
      expect(circuitBreaker.getState('circuit-a')).toBe('closed');
    });
  });
});
