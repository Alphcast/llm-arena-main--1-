import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

import { guardThreadRequest } from "@/features/threads/thread-protection";
import { publicEnv } from "@/infrastructure/public-env";

/**
 * Next 16 renamed the middleware entry point from `middleware.ts` to
 * `proxy.ts`. The file name is the only thing that changed.
 */
const hasClerkSecret = Boolean(publicEnv.hasClerkSecret);

const baseHandler = async (request: Request) => {
  if (new URL(request.url).pathname.startsWith("/t/")) {
    const denied = await guardThreadRequest(request);
    if (denied) return denied;
  }
  return NextResponse.next();
};

export default hasClerkSecret
  ? clerkMiddleware(async (_auth, request) => {
      if (request.nextUrl.pathname.startsWith("/t/")) {
        const denied = await guardThreadRequest(request);
        if (denied) return denied;
      }
      return NextResponse.next();
    })
  : async function middleware(request: NextRequest) {
      return baseHandler(request);
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest))(?:.*)|api|trpc)(.*)",
  ],
};
