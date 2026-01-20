export interface NovatedLeaseInputs {
      leaseTermYears: number;
      fbtBaseValue: number;
      driveawayCost?: number; // Always the main input, can be calculated from residual
      documentationFee?: number;
      financedAmountManual?: number;
      paymentAmount?: number;
      paymentsPerYear?: number;
      monthsDeferred?: number;
}

export interface NovatedLeaseResults {
      gst: number;
      financedAmount: number;
      residualPercent: number;
      residualExclGst: number;
      residualInclGst: number;
}

export function calculateNovatedLease(inputs: NovatedLeaseInputs): NovatedLeaseResults {
  if (typeof inputs.driveawayCost !== 'number' || isNaN(inputs.driveawayCost)) {
    throw new Error('driveawayCost must be provided');
  }
  const gst = inputs.fbtBaseValue / 11;
  const documentationFee = inputs.documentationFee || 0;
  const residualPercent = Math.round((0.6563 / 7) * (8 - inputs.leaseTermYears) * 10000) / 10000;
  // Financed amount = driveawayCost - min(fbtBaseValue/11, 6334) + documentationFee
  const minValue = Math.min(inputs.fbtBaseValue / 11, 6334);
  const financedAmount = inputs.driveawayCost - minValue + documentationFee;
  // Residual (excl gst) = residualPercent * (financedAmount - documentationFee)
  const residualExclGst = residualPercent * (financedAmount - documentationFee);
  const residualInclGst = residualExclGst * 1.1;
  return {
    gst,
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
      if (!paymentAmount || !paymentsPerYear || !leaseTermYears || !financedAmount || !residualExclGst) {
            return null;
      }
      // Ensure monthsDeferred is always a number
      const deferred = typeof monthsDeferred === 'number' ? monthsDeferred : 2;
      const n = leaseTermYears * 12 - deferred;
      const pv = -(financedAmount); 
      const fv = residualExclGst;
      const type = 1;
      // Convert payment to equivalent monthly payment that is two months deferred
      const targetPayment = paymentAmount * (paymentsPerYear * leaseTermYears) / (12 * leaseTermYears - deferred);

      

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