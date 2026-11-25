import { protectedResource } from "../../../lib/discovery";

export function GET() {
  return Response.json(protectedResource());
}
