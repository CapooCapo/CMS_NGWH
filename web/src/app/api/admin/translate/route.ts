import { handleAdminTranslation } from "@/server/api/adminTranslation";
import { routeHandler } from "@/server/http/routeHandler";
import { errorResponse } from "@/server/http/errors";

export async function POST(request: Request) {
  return routeHandler("admin translation", async () => {
    const response = await handleAdminTranslation(request);
    if (response.ok) return response;
    if (response.status === 401) return errorResponse(401, "UNAUTHENTICATED");
    if (response.status === 403) return errorResponse(403, "FORBIDDEN");
    if (response.status === 400) return errorResponse(400, "INVALID_INPUT");
    if (response.status === 503) return errorResponse(503, "SERVICE_UNAVAILABLE");
    return errorResponse(500, "INTERNAL_ERROR");
  });
}
