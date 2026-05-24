// src/core/server/signal-bus.ts
//
// Push-based signal stream. A single background poller compares current data
// (funding rates, whale trades) to its last-seen state. On state changes it
// emits events that any number of SSE-subscribed clients receive in real time.
//
// Why a singleton: polling external APIs once per cycle and fanning out to N
// clients is much cheaper than each client polling independently.

import { EventEmitter } from 'node:events';
import { createLogger } from '../logger.js';

const log = createLogger('signal-bus');

export type SignalEvent =
  | {
      type: 'funding_outlier_new';
      coin: string;
      funding_rate: number;
      baseline_abs: number;
      z_score: number;
      direction: 'longs_pay' | 'shorts_pay';
      detected_at: string;
    }
  | {
      type: 'whale_trade';
      coin: string;
      side: 'B' | 'S';
      notional_usdc: number;
      px: number;
      sz: number;
      detected_at: string;
    }
  | {
      type: 'oi_cap_reached';
      coin: string;
      oi_usd: number;
      detected_at: string;
    }
  | {
      type: 'liquidity_cluster_break';
      coin: string;
      cluster_price: number;
      mark_price: number;
      detected_at: string;
    };

class SignalBus extends EventEmitter {
  private state = new Map<string, number | string>();
  private started = false;

  setLast(key: string, value: number | string): void {
    this.state.set(key, value);
  }

  getLast(key: string): number | string | undefined {
    return this.state.get(key);
  }

  emitSignal(ev: SignalEvent): void {
    log.debug('emitSignal');
    super.emit('signal', ev);
  }

  markStarted(): boolean {
    if (this.started) return false;
    this.started = true;
    return true;
  }
}

export const signalBus = new SignalBus();
