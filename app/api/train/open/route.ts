import { NextResponse } from "next/server";

import { needLogin } from "@/lib/auth/guard";
import { openCompany } from "@/lib/train/company";

export async function POST(req: Request) {
  const no = await needLogin();
  if (no) return no;
  const body = (await req.json().catch(() => ({}))) as { next?: string };
  return NextResponse.json(await openCompany(body.next));
}
