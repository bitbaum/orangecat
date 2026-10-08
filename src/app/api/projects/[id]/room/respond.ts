import {
  apiForbidden,
  apiInternalError,
  apiNotFound,
  apiSuccess,
  apiValidationError,
} from '@/lib/api/standardResponse';
import type { RoomResult } from '@/domain/projectRooms/types';

/** One mapping from a room result to an HTTP answer, for every room route. */
export function roomResponse<T>(result: RoomResult<T>, status = 200) {
  if (result.ok) {
    return apiSuccess(result.data, { status });
  }
  switch (result.code) {
    case 'invalid':
      return apiValidationError(result.message);
    case 'forbidden':
      return apiForbidden(result.message);
    case 'not_found':
    case 'revoked':
      return apiNotFound(result.message);
    default:
      return apiInternalError(result.message);
  }
}
