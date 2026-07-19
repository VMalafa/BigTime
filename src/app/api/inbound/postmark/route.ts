// Postmark inbound webhook (#69): kept wired — the spine is provider-
// agnostic — but the ACTIVE provider is CloudMailin (Postmark signup
// needs a private-domain address; see docs/runbooks/cloudmailin-inbound.md).

import { validateInboundPayload } from "@/lib/ingestion/inbound";
import { handleInboundRequest } from "@/lib/ingestion/inbound-route";

export async function POST(request: Request) {
  return handleInboundRequest(request, validateInboundPayload);
}
