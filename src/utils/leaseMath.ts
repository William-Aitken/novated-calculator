export interface NovatedLeaseInputs {
      leaseTermYears: number;
      fbtBaseValue: number;
      driveawayCost?: number; // Always the main input, can be calculated from residual
      residualExcl?: number;
      residualIncl?: number;
      documentationFee?: number;
      financedAmountManual?: number;
      paymentAmount?: number;
      paymentsPerYear?: number;
      monthsDeferred?: number;
}

export interface NovatedLeaseResults {
      gst: number;
      driveawayCost: number;
      financedAmount: number;
      residualPercent: number;
      residualExclGst: number;
      residualInclGst: number;
}

export function calculateNovatedLease(inputs: NovatedLeaseInputs): NovatedLeaseResults {
      // Make inputs resilient to string or number types
      const toNum = (v: any): number | undefined => {
            if (v === undefined || v === null) return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
      };

      const fbtBaseValueNum = toNum(inputs.fbtBaseValue) || 0;
      const gst = fbtBaseValueNum / 11;
      const documentationFee = toNum(inputs.documentationFee) || 0;
      const leaseTermYears = toNum(inputs.leaseTermYears) || 0;
      const residualPercent = Math.round((0.6563 / 7) * (8 - leaseTermYears) * 10000) / 10000;
      const minValue = Math.min(gst, 6334);

      const driveawayNum = toNum(inputs.driveawayCost);
      const financedManualNum = toNum(inputs.financedAmountManual);
      const residualExclNum = toNum(inputs.residualExcl);
      const residualInclNum = toNum(inputs.residualIncl);

      let financedAmount: number | undefined;

      if (typeof driveawayNum === 'number' && driveawayNum > 0) {
            financedAmount = driveawayNum - minValue + documentationFee;
      } else if (typeof financedManualNum === 'number' && financedManualNum > 0) {
            financedAmount = financedManualNum;
      } else if (typeof residualExclNum === 'number' && residualExclNum > 0) {
            if (!residualPercent) throw new Error('Cannot derive financed amount: residual percent is zero');
            financedAmount = residualExclNum / residualPercent + documentationFee;
      } else if (typeof residualInclNum === 'number' && residualInclNum > 0) {
            if (!residualPercent) throw new Error('Cannot derive financed amount: residual percent is zero');
            const resExcl = residualInclNum / 1.1;
            financedAmount = resExcl / residualPercent + documentationFee;
      }

      if (typeof financedAmount !== 'number') {
            throw new Error('At least one vehicle input (driveawayCost, financedAmountManual, residualExcl, residualIncl) must be provided');
      }

      const residualExclGst = residualPercent * (financedAmount - documentationFee);
      const residualInclGst = residualExclGst * 1.1;
      const driveawayCost = financedAmount + minValue - documentationFee;
      return {
            gst: gst,
            driveawayCost,
            financedAmount,
            residualPercent,
            residualExclGst,
            residualInclGst,
      };
}

// Calculate payment using PMT formula
function pmt(rate: number, nper: number, pv: number, fv: number, type: number): number {
      if (rate === 0) {
            return -(pv + fv) / nper;
      }
      const pvif = Math.pow(1 + rate, nper);
      let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
      if (type === 1) {
            pmt /= (1 + rate);
      }
      return pmt;
}

// Iteratively solve for the effective interest rate that matches the payment amount
export function calculateEffectiveInterestRate({
      paymentAmount,
      paymentsPerYear,
      leaseTermYears,
      financedAmount,
      residualExclGst,
      monthsDeferred,
      ...rest
}: NovatedLeaseInputs & { financedAmount: number, residualExclGst: number, monthsDeferred?: number }): number | null {
      // Require numeric inputs (allow zero where meaningful) and guard against non-finite values
      if (!Number.isFinite(Number(paymentAmount)) || !Number.isFinite(Number(paymentsPerYear)) || !Number.isFinite(Number(leaseTermYears)) || !Number.isFinite(Number(financedAmount)) || !Number.isFinite(Number(residualExclGst))) {
            return null;
      }
      // Ensure monthsDeferred is always a number
      const deferred = typeof monthsDeferred === 'number' ? monthsDeferred : 2;
      const leaseTermYearsNum = Number(leaseTermYears);
      const n = leaseTermYearsNum * 12 - deferred;
      const pv = -(financedAmount);
      const fv = residualExclGst;
      const type = 1;
      // Convert payment to equivalent monthly payment that is two months deferred
      const paymentAmountNum = Number(paymentAmount);
      const paymentsPerYearNum = Number(paymentsPerYear);
      const targetPayment = paymentAmountNum * (paymentsPerYearNum * leaseTermYearsNum) / (12 * leaseTermYearsNum - deferred);

      

      // Use bisection method to solve for rate
      let lower = 0.00001;
      let upper = 0.5;
      let guess = 0;
      let iterations = 0;
      const maxIterations = 100;
      const tolerance = 1e-4;
      while (iterations < maxIterations) {
            guess = (lower + upper) / 2;
            const calcPayment = pmt(
        guess / 12,
        n,
        pv * Math.pow(1 + guess / 12, deferred),
        fv,
        type
      );
            if (Math.abs(calcPayment - targetPayment) < tolerance) {
                  return guess;
            }
            if (calcPayment > targetPayment) {
                  upper = guess;
            } else {
                  lower = guess;
            }
            iterations++;
      }
      return null; // No solution found
}

// Calculate BYO (Bring Your Own) payments using PMT formula
export function calculateBYOPayment({
      financedAmount,
      residualExclGst,
      paymentsPerYear,
      leaseTermYears,
      monthsDeferred,
      interestRate,
}: {
      financedAmount: number;
      residualExclGst: number;
      paymentsPerYear: number;
      leaseTermYears: number;
      monthsDeferred?: number;
      interestRate: number;
}): number {
      const deferred = typeof monthsDeferred === 'number' ? monthsDeferred : 2;
      const n = leaseTermYears * 12 - deferred;
      const pv = -(financedAmount);
      const fv = residualExclGst;
      const type = 1;
      
      // Monthly interest rate
      const monthlyRate = interestRate / 12;
      
      // Calculate monthly payment
      const monthlyPayment = pmt(monthlyRate, n, pv * Math.pow(1 + monthlyRate, deferred), fv, type);
      
      // Convert monthly payment to payment frequency using the same formula as effective interest rate
      // The effective interest rate converts period payment to monthly: paymentAmount * (paymentsPerYear * leaseTermYears) / (12 * leaseTermYears - deferred)
      // So to reverse it: monthlyPayment * (12 * leaseTermYears - deferred) / (paymentsPerYear * leaseTermYears)
      const paymentPerPeriod = monthlyPayment * (12 * leaseTermYears - deferred) / (paymentsPerYear * leaseTermYears);
      
      return paymentPerPeriod;
}