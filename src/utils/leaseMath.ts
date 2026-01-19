export interface NovatedLeaseInputs {
      leaseTermYears: number; // Required: Lease term in years
      fbtBaseValue: number; // Required: FBT base value
      driveawayCost?: number; // Optional: Either driveawayCost or residual value
      residualValue?: number; // Optional: Residual value (excl GST if residualIncludesGst is false)
      residualIncludesGst?: boolean; // Optional: Whether residual value includes GST (default: false)
      documentationFee?: number; // Optional: Documentation fee (default: 0)
      financedAmountManual?: number; // Optional: Manual override for financed amount
      residualValueManual?: number; // Optional: Manual override for residual value
      paymentAmount?: number; // Optional: Payment amount for effective interest rate calculation
      paymentsPerYear?: number; // Optional: Number of payments per year
      monthsDeferred?: number; // Optional: Number of months deferred
}

export interface NovatedLeaseResults {
      gst: number;
      financedAmount: number;
      residualPercent: number;
      residualExclGst: number;
      residualInclGst: number;
}

export function calculateNovatedLease(inputs: NovatedLeaseInputs): NovatedLeaseResults {
      if (!inputs.driveawayCost && !inputs.residualValue) {
            throw new Error('Either driveawayCost or residualValue must be provided');
      }
      // Use manual overrides if provided
      const hasManualFinanced = typeof inputs.financedAmountManual === 'number' && !isNaN(inputs.financedAmountManual);
      const hasManualResidual = typeof inputs.residualValueManual === 'number' && !isNaN(inputs.residualValueManual);

      if (!inputs.driveawayCost && !inputs.residualValue && !hasManualFinanced && !hasManualResidual) {
            throw new Error('Either driveawayCost, residualValue, or manual override must be provided');
      }

      const gst = inputs.fbtBaseValue / 11; // 10% FBT on base value
      const documentationFee = inputs.documentationFee || 0;
      const residualIncludesGst = inputs.residualIncludesGst || false;

      // Residual % = round(65.63%/7*(8-leaseTermYears),4)
      const residualPercent = Math.round((0.6563 / 7) * (8 - inputs.leaseTermYears) * 10000) / 10000;

      let financedAmount: number = 0;
      let residualExclGst: number = 0;

      if (inputs.driveawayCost !== undefined) {
            // Calculate from driveawayCost
            // Financed amount = driveawayCost - min(fbtBaseValue/11, 6334) + documentationFee
            const minValue = Math.min(inputs.fbtBaseValue / 11, 6334);
            financedAmount = inputs.driveawayCost - minValue + documentationFee;
            // Residual (excl gst) = residualPercent * (financedAmount - documentationFee)
            residualExclGst = residualPercent * (financedAmount - documentationFee);
      } else {
            // Calculate from residual value
            residualExclGst = residualIncludesGst
                  ? inputs.residualValue! / 1.1
                  : inputs.residualValue!;
            // Work backwards to find driveawayCost
            // residualExclGst = residualPercent * (financedAmount - documentationFee)
            // financedAmount = (residualExclGst / residualPercent) + documentationFee
            financedAmount = residualExclGst / residualPercent + documentationFee;
      }
      if (hasManualFinanced) {
            financedAmount = inputs.financedAmountManual!;
            // Residual (excl gst) = residualPercent * (financedAmount - documentationFee)
            residualExclGst = residualPercent * (financedAmount - documentationFee);
      } else if (hasManualResidual) {
            residualExclGst = residualIncludesGst
                  ? inputs.residualValueManual! / 1.1
                  : inputs.residualValueManual!;
            financedAmount = residualExclGst / residualPercent + documentationFee;
      }
      // Residual incl gst = residualExclGst * 1.1
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