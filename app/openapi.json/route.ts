import { openapi } from "../../lib/discovery";

export function GET() {
  return Response.json(openapi());
}
