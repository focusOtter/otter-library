import { poppyDiscovery } from "../../../lib/discovery";

export function GET() {
  return Response.json(poppyDiscovery());
}
