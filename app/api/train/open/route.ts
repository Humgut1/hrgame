import { NextResponse } from "next/server";

import { openCompany } from "@/lib/train/company";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { next?: string };
  return NextResponse.json(await openCompany(body.next));
}
