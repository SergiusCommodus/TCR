import type { Fleet } from './types';

/** Whole days remaining before an in transit fleet reaches its destination. */
export function daysOut(fleet: Fleet, daysElapsed: number): number {
  return Math.max(0, Math.ceil(fleet.arrivalDay - daysElapsed));
}
