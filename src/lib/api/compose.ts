import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ctx is an open bag each middleware extends (requestId, zod body) on top of the route context; typing it needs an accumulating compose
export type Handler<Ctx = any> = (
  req: NextRequest,
  ctx: Ctx
) => Promise<NextResponse> | NextResponse;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see Handler above
export type Middleware<Ctx = any> = (
  req: NextRequest,
  ctx: Ctx,
  next: Handler<Ctx>
) => Promise<NextResponse> | NextResponse;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see Handler above
export function compose<Ctx = any>(...middlewares: Middleware<Ctx>[]) {
  return function wrap(handler: Handler<Ctx>): Handler<Ctx> {
    return async function composed(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
      let index = -1;
      const run = async (i: number, r: NextRequest, c: Ctx): Promise<NextResponse> => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;
        const mw = middlewares[i];
        if (!mw) {
          return handler(r, c);
        }
        return mw(r, c, (nr = r, nc = c) => run(i + 1, nr, nc));
      };
      return run(0, req, ctx);
    };
  };
}
