import { NextResponse } from "next/server";

export function sameOriginRedirect(
  path: string,
  status: 303 | 307 = 303,
): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new TypeError("Redirect path must be same-origin");
  }

  return new NextResponse(null, {
    status,
    headers: { Location: path },
  });
}
