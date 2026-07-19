// CloudMailin inbound webhook (#69, provider swap): the active email
// mouth. Postmark's signup requires a private-domain address the
// household doesn't have; CloudMailin's does not, and its free tier
// (10k/month) dwarfs household volume. Same spine either way — see
// docs/runbooks/cloudmailin-inbound.md.

import { validateCloudMailinPayload } from "@/lib/ingestion/inbound";
import { handleInboundRequest } from "@/lib/ingestion/inbound-route";

export async function POST(request: Request) {
  return handleInboundRequest(request, validateCloudMailinPayload);
}
