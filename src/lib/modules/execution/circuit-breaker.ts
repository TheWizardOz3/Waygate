/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by tracking error rates and temporarily
 * blocking requests to unhealthy services.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail fast
 * - HALF-OPEN: Testing recovery, allows limited requests
 */

import type { CircuitBreakerConfig, CircuitState } from './execution.schemas';
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, mergeCircuitBreakerConfig } from './execution.schemas';
import { CircuitOpenError } from './errors';

// =============================================================================
// Types
// =============================================================================

/**
 * Internal state for a single circuit
 */
interface CircuitInternalState {
  /** Current circuit state */
  state: CircuitState;
  /** Timestamps of recent failures (within failure window) */
  failures: number[];
  /** When the circuit was opened (for reset timeout calculation) */
  openedAt?: number;
  /** Number of successful requests in half-open state */
  halfOpenSuccesses: number;
}

/**
 * Public circuit status for monitoring
 */
export interface CircuitStatus {
  /** Circuit identifier */
  circuitId: string;
  /** Current state */
  state: CircuitState;
  /** Number of failures in current window */
  failureCount: number;
  /** Time until circuit attempts to close (if open), in ms */
  timeUntilResetMs?: number;
  /** Number of successes needed to close (if half-open) */
  successesUntilClosed?: number;
}

// =============================================================================
// Circuit Breaker Class
// =============================================================================

/**
 * Circuit Breaker implementation
 *
 * Tracks failures per circuit ID (e.g., per integration) and implements
 * the circuit breaker pattern to prevent cascading failures.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker();
 *
 * // Before making a request
 * if (!breaker.canExecute('slack-integration')) {
 *   throw new CircuitOpenError('slack-integration');
 * }
 *
 * try {
 *   await makeRequest();
 *   breaker.recordSuccess('slack-integration');
 * } catch (error) {
 *   breaker.recordFailure('slack-integration');
 *   throw error;
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly circuits: Map<string, CircuitInternalState> = new Map();

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = mergeCircuitBreakerConfig(config);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Check if a request can be executed for the given circuit
   *
   * @param circuitId - Unique identifier for the circuit (e.g., integration ID)
   * @returns true if the request can proceed, false if circuit is open
   */
  canExecute(circuitId: string): boolean {
    const circuit = this.getOrCreateCircuit(circuitId);
    const now = Date.now();

    switch (circuit.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if we should transition to half-open
        if (this.shouldAttemptReset(circuit, now)) {
          this.transitionToHalfOpen(circuit);
          return true;
        }
        return false;

      case 'half-open':
        // Allow requests in half-open state to test recovery
        return true;

      default:
        return true;
    }
  }

  /**
   * Record a successful request for the given circuit
   *
   * In half-open state, successes move toward closing the circuit.
   * In closed state, this clears any recorded failures.
   *
   * @param circuitId - Unique identifier for the circuit
   */
  recordSuccess(circuitId: string): void {
    const circuit = this.getOrCreateCircuit(circuitId);

    switch (circuit.state) {
      case 'half-open':
        circuit.halfOpenSuccesses++;
        if (circuit.halfOpenSuccesses >= this.config.successThreshold) {
          this.transitionToClosed(circuit);
        }
        break;

      case 'closed':
        // Clear old failures on success
        this.pruneOldFailures(circuit, Date.now());
        break;

      case 'open':
        // Shouldn't happen, but handle gracefully
        break;
    }
  }

  /**
   * Record a failed request for the given circuit
   *
   * In closed state, failures accumulate and may open the circuit.
   * In half-open state, a single failure re-opens the circuit.
   *
   * @param circuitId - Unique identifier for the circuit
   */
  recordFailure(circuitId: string): void {
    const circuit = this.getOrCreateCircuit(circuitId);
    const now = Date.now();

    switch (circuit.state) {
      case 'closed':
        // Add failure and check threshold
        circuit.failures.push(now);
        this.pruneOldFailures(circuit, now);

        if (circuit.failures.length >= this.config.failureThreshold) {
          this.transitionToOpen(circuit, now);
        }
        break;

      case 'half-open':
        // Any failure in half-open immediately re-opens
        this.transitionToOpen(circuit, now);
        break;

      case 'open':
        // Already open, just update the timestamp
        circuit.failures.push(now);
        break;
    }
  }

  /**
   * Get the current state of a circuit
   *
   * @param circuitId - Unique identifier for the circuit
   * @returns Current circuit state
   */
  getState(circuitId: string): CircuitState {
    const circuit = this.circuits.get(circuitId);
    if (!circuit) {
      return 'closed';
    }

    // Check if open circuit should transition to half-open
    if (circuit.state === 'open' && this.shouldAttemptReset(circuit, Date.now())) {
      return 'half-open';
    }

    return circuit.state;
  }

  /**
   * Get detailed status of a circuit for monitoring
   *
   * @param circuitId - Unique identifier for the circuit
   * @returns Detailed circuit status
   */
  getStatus(circuitId: string): CircuitStatus {
    const circuit = this.circuits.get(circuitId);
    const now = Date.now();

    if (!circuit) {
      return {
        circuitId,
        state: 'closed',
        failureCount: 0,
      };
    }

    // Prune old failures for accurate count
    this.pruneOldFailures(circuit, now);

    const status: CircuitStatus = {
      circuitId,
      state: this.getState(circuitId), // Use getState to handle auto-transition
      failureCount: circuit.failures.length,
    };

    if (circuit.state === 'open' && circuit.openedAt) {
      const elapsed = now - circuit.openedAt;
      status.timeUntilResetMs = Math.max(0, this.config.resetTimeoutMs - elapsed);
    }

    if (circuit.state === 'half-open') {
      status.successesUntilClosed = this.config.successThreshold - circuit.halfOpenSuccesses;
    }

    return status;
  }

  /**
   * Manually reset a circuit to closed state
   *
   * @param circuitId - Unique identifier for the circuit
   */
  reset(circuitId: string): void {
    const circuit = this.circuits.get(circuitId);
    if (circuit) {
      this.transitionToClosed(circuit);
    }
  }

  /**
   * Clear all circuit states (useful for testing)
   */
  clearAll(): void {
    this.circuits.clear();
  }

  /**
   * Get all circuit IDs currently tracked
   */
  getCircuitIds(): string[] {
    return Array.from(this.circuits.keys());
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param circuitId - Circuit identifier
   * @param fn - Function to execute
   * @returns Result of the function
   * @throws CircuitOpenError if circuit is open
   */
  async execute<T>(circuitId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute(circuitId)) {
      const status = this.getStatus(circuitId);
      throw new CircuitOpenError(circuitId, status.timeUntilResetMs);
    }

    try {
      const result = await fn();
      this.recordSuccess(circuitId);
      return result;
    } catch (error) {
      this.recordFailure(circuitId);
      throw error;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get or create internal state for a circuit
   */
  private getOrCreateCircuit(circuitId: string): CircuitInternalState {
    let circuit = this.circuits.get(circuitId);
    if (!circuit) {
      circuit = {
        state: 'closed',
        failures: [],
        halfOpenSuccesses: 0,
      };
      this.circuits.set(circuitId, circuit);
    }
    return circuit;
  }

  /**
   * Remove failures outside the failure window
   */
  private pruneOldFailures(circuit: CircuitInternalState, now: number): void {
    const cutoff = now - this.config.failureWindowMs;
    circuit.failures = circuit.failures.filter((timestamp) => timestamp > cutoff);
  }

  /**
   * Check if enough time has passed to attempt closing the circuit
   */
  private shouldAttemptReset(circuit: CircuitInternalState, now: number): boolean {
    if (circuit.state !== 'open' || !circuit.openedAt) {
      return false;
    }
    return now - circuit.openedAt >= this.config.resetTimeoutMs;
  }

  /**
   * Transition circuit to closed state
   */
  private transitionToClosed(circuit: CircuitInternalState): void {
    circuit.state = 'closed';
    circuit.failures = [];
    circuit.openedAt = undefined;
    circuit.halfOpenSuccesses = 0;
  }

  /**
   * Transition circuit to open state
   */
  private transitionToOpen(circuit: CircuitInternalState, now: number): void {
    circuit.state = 'open';
    circuit.openedAt = now;
    circuit.halfOpenSuccesses = 0;
  }

  /**
   * Transition circuit to half-open state
   */
  private transitionToHalfOpen(circuit: CircuitInternalState): void {
    circuit.state = 'half-open';
    circuit.halfOpenSuccesses = 0;
  }
}

// =============================================================================
// Default Instance
// =============================================================================

/**
 * Default global circuit breaker instance
 *
 * Use this for simple cases where you don't need custom configuration.
 * For more control, create your own CircuitBreaker instance.
 */
export const defaultCircuitBreaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a circuit breaker with custom configuration
 */
export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * Execute with circuit breaker using the default instance
 */
export async function withCircuitBreaker<T>(circuitId: string, fn: () => Promise<T>): Promise<T> {
  return defaultCircuitBreaker.execute(circuitId, fn);
}
