import { NextResponse } from "next/server";
import { calculateNovatedLease, type NovatedLeaseInputs } from "@utils/leaseMath";

export function GET() {
  const inputs: NovatedLeaseInputs = {
    driveawayCost: 45000,
    fbtBaseValue: 40000,
    documentationFee: 500,
    leaseTermYears: 3,
  };
  const result = calculateNovatedLease(inputs);
  return NextResponse.json({ result });
}