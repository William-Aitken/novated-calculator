import { NextResponse } from "next/server";
import { exampleCalculation } from "@utils/leaseMath";

export function GET() {
  const result = exampleCalculation(5, 7);
    return NextResponse.json({ result });
    }
    