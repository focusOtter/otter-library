import { agentMetadata } from "../../lib/discovery";

export function GET() {
  return Response.json(agentMetadata());
}
