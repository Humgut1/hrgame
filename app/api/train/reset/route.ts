import { NextResponse } from "next/server";

import { resetCompany } from "@/lib/train/company";

export async function POST() {
  return NextResponse.json(await resetCompany());
}
