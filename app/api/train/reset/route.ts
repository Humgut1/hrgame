import { NextResponse } from "next/server";

import { needLogin } from "@/lib/auth/guard";
import { resetCompany } from "@/lib/train/company";

export async function POST() {
  const no = await needLogin();
  if (no) return no;
  return NextResponse.json(await resetCompany());
}
