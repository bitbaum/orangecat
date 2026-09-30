import { describe, expect, it } from 'vitest';
import { validatedLocationCoordinates } from '@/components/ui/locationInputHelpers';

describe('validatedLocationCoordinates', () => {
  it('preserves valid zero coordinates instead of treating them as missing', () => {
    expect(validatedLocationCoordinates(0, 0, 47.37, 8.54)).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });

  it('uses the fallback only when the primary pair is invalid', () => {
    expect(validatedLocationCoordinates(91, 8.54, 47.37, 8.54)).toEqual({
      latitude: 47.37,
      longitude: 8.54,
    });
  });

  it('never returns a partial or out-of-range WGS84 pair', () => {
    expect(validatedLocationCoordinates(47.37, undefined, 90.01, 8.54)).toEqual({});
  });
});
