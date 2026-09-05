import { handleAdminTranslation } from "@/server/api/adminTranslation";

export async function POST(request: Request) {
  return handleAdminTranslation(request);
}
