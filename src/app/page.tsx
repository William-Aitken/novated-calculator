'use client';

import { useState, useEffect } from 'react';
import { calculateNovatedLease, calculateEffectiveInterestRate, type NovatedLeaseInputs } from '@/utils/leaseMath';

const paymentFrequencies = [
  { label: 'Weekly', value: 52 },
  { label: 'Fortnightly', value: 26 },
  { label: 'Monthly', value: 12 },
  { label: 'Yearly', value: 1 },
];

const calculationBases = [
  { label: 'Driveaway Price', value: 'driveaway' },
  { label: 'Residual Value (excl GST)', value: 'residualExcl' },
  { label: 'Residual Value (incl GST)', value: 'residualIncl' },
];

export default function HomePage() {
  const [useResidual, setUseResidual] = useState(false);
  const defaultInputs: NovatedLeaseInputs = {
    driveawayCost: 50000,
    fbtBaseValue: 47527,
    documentationFee: 0,
    leaseTermYears: 2,
    residualIncludesGst: false,
    paymentAmount: 0,
    paymentsPerYear: 12,
    monthsDeferred: 2,
  };
  const [inputs, setInputs] = useState<NovatedLeaseInputs>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseInputs');
      if (saved) {
        try {
          return { ...defaultInputs, ...JSON.parse(saved) };
        } catch {
          return defaultInputs;
        }
      }
    }
    return defaultInputs;
  });
  const [selectedFrequency, setSelectedFrequency] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseSelectedFrequency');
      if (saved) return Number(saved);
    }
    return 12;
  }); // Default to Monthly
  // Calculation basis dropdown state
  const [calcBasis, setCalcBasis] = useState<'driveaway' | 'residualExcl' | 'residualIncl'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseCalcBasis');
      if (saved === 'driveaway' || saved === 'residualExcl' || saved === 'residualIncl') return saved;
    }
    return 'driveaway';
  });

  const [results, setResults] = useState(calculateNovatedLease(inputs));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate effective interest rate if paymentAmount and paymentsPerYear are provided
  let effectiveRate: number | null = null;
  if (inputs.paymentAmount && inputs.paymentsPerYear) {
    effectiveRate = calculateEffectiveInterestRate({
      ...inputs,
      financedAmount: results.financedAmount - (inputs.documentationFee || 0),
      residualExclGst: results.residualExclGst,
    });
  }

  // Calculate base rate: same as effective rate, but include fees in finance amount
  let baseRate: number | null = null;
  if (inputs.paymentAmount && inputs.paymentsPerYear) {
    baseRate = calculateEffectiveInterestRate({
      ...inputs,
      financedAmount: results.financedAmount,
      residualExclGst: results.residualExclGst,
    });
  }

  const handleInputChange = (field: keyof NovatedLeaseInputs, value: number | boolean) => {
    const updatedInputs = { ...inputs, [field]: value };
    setInputs(updatedInputs);
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseInputs', JSON.stringify(updatedInputs));
    }
    // If manual override fields are set, use them for calculation
    let calcInputs = { ...updatedInputs };
    if (
      field === 'financedAmountManual' && typeof value === 'number' && !isNaN(value)
    ) {
      calcInputs.financedAmountManual = value as number;
    }
    if (
      field === 'residualValueManual' && typeof value === 'number' && !isNaN(value)
    ) {
      calcInputs.residualValueManual = value as number;
    }
    setResults(calculateNovatedLease(calcInputs));
  };

  const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const freq = Number(e.target.value);
    setSelectedFrequency(freq);
    setInputs(prev => {
      const updated = { ...prev, paymentsPerYear: freq };
      if (typeof window !== 'undefined') {
        localStorage.setItem('novatedLeaseInputs', JSON.stringify(updated));
        localStorage.setItem('novatedLeaseSelectedFrequency', String(freq));
      }
      return updated;
    });
  };

  const handleToggleMode = (useRes: boolean) => {
    setUseResidual(useRes);
    const updatedInputs = { ...inputs };
    if (useRes) {
      // Switching to residual mode - calculate residual from current driveaway cost
      if (updatedInputs.driveawayCost !== undefined) {
        // Use current results to set residual value
        updatedInputs.residualValue = Math.round(results.residualExclGst * 100) / 100; // Use excl GST value
        updatedInputs.residualIncludesGst = false;
      }
      delete updatedInputs.driveawayCost;
    } else {
      // Switching to driveaway mode - calculate driveaway from current residual
      if (updatedInputs.residualValue !== undefined) {
        // Work backwards from residual to get a reasonable driveaway cost estimate
        const residualExcl = updatedInputs.residualIncludesGst
          ? updatedInputs.residualValue / 1.1
          : updatedInputs.residualValue;
        const residualPercent = Math.round((0.6563 / 7) * (8 - updatedInputs.leaseTermYears) * 10000) / 10000;
        const gst = updatedInputs.fbtBaseValue / 11;
        const estimatedDriveaway = (residualExcl / residualPercent) + gst;
        updatedInputs.driveawayCost = Math.round(estimatedDriveaway);
      }
      delete updatedInputs.residualValue;
      updatedInputs.residualIncludesGst = false;
    }
    setInputs(updatedInputs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseInputs', JSON.stringify(updatedInputs));
    }
    try {
      setResults(calculateNovatedLease(updatedInputs));
    } catch (error) {
      console.error('Calculation error:', error);
    }
  };

  // Update driveawayCost if user selects a residual basis and enters a value
  const handleBasisInputChange = (value: number) => {
    let updatedInputs = { ...inputs };
    if (calcBasis === 'driveaway') {
      updatedInputs.driveawayCost = value;
    } else {
      // Calculate driveawayCost from residual value
      const documentationFee = updatedInputs.documentationFee || 0;
      const leaseTermYears = updatedInputs.leaseTermYears;
      const fbtBaseValue = updatedInputs.fbtBaseValue;
      const gst = fbtBaseValue / 11;
      const residualPercent = Math.round((0.6563 / 7) * (8 - leaseTermYears) * 10000) / 10000;
      let residualExcl = value;
      if (calcBasis === 'residualIncl') {
        residualExcl = value / 1.1;
      }
      // driveawayCost = (residualExcl / residualPercent) + gst
      updatedInputs.driveawayCost = Math.round((residualExcl / residualPercent) + gst);
      updatedInputs.residualValue = calcBasis === 'residualIncl' ? residualExcl : value;
      updatedInputs.residualIncludesGst = calcBasis === 'residualIncl';
    }
    setInputs(updatedInputs);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseInputs', JSON.stringify(updatedInputs));
    }
    setResults(calculateNovatedLease(updatedInputs));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Persist calcBasis changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseCalcBasis', calcBasis);
    }
  }, [calcBasis]);

  return (
    <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Novated Lease Calculator</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px' }}>
        {/* Input Section */}
        <div>
          <h2>Vehicle Details</h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* FBT Base Value at the top */}
            <div>
              <label>
                FBT Base Value (excl on-roads) (AUD) *
                <input
                  type="number"
                  value={inputs.fbtBaseValue}
                  onChange={(e) => handleInputChange('fbtBaseValue', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </label>
            </div>
            {/* Lease Term */}
            <div>
              <label>
                Lease Term (Years) *
                <input
                  type="number"
                  value={inputs.leaseTermYears}
                  onChange={(e) => handleInputChange('leaseTermYears', Number(e.target.value))}
                  min="1"
                  max="7"
                  step="1"
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </label>
            </div>
            {/* Calculation Basis Dropdown and Inputs */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <label style={{ flex: 1 }}>
                <span>Calculate using</span>
                <select
                  value={calcBasis}
                  onChange={e => setCalcBasis(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                >
                  {calculationBases.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              {calcBasis === 'driveaway' && (
                <label style={{ flex: 1 }}>
                  Driveaway Cost (AUD) *
                  <input
                    type="number"
                    value={inputs.driveawayCost || ''}
                    onChange={e => handleBasisInputChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </label>
              )}
              {calcBasis === 'residualExcl' && (
                <label style={{ flex: 1 }}>
                  Residual Value (excl GST) *
                  <input
                    type="number"
                    value={inputs.residualValue || ''}
                    onChange={e => handleBasisInputChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </label>
              )}
              {calcBasis === 'residualIncl' && (
                <label style={{ flex: 1 }}>
                  Residual Value (incl GST) *
                  <input
                    type="number"
                    value={inputs.residualValue ? (inputs.residualValue * 1.1).toFixed(2) : ''}
                    onChange={e => handleBasisInputChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </label>
              )}
            </div>
            {/* Optional Documentation Fee */}
            <div>
              <label>
                Documentation Fee (AUD)
                <input
                  type="number"
                  value={inputs.documentationFee || 0}
                  onChange={(e) => handleInputChange('documentationFee', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </label>
            </div>
            {/* Payment Amount and Frequency (side by side) */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label>
                  Payment Amount (AUD)
                  <input
                    type="number"
                    value={inputs.paymentAmount || ''}
                    onChange={(e) => handleInputChange('paymentAmount', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label>
                  Frequency
                  <select
                    value={selectedFrequency}
                    onChange={handleFrequencyChange}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  >
                    {paymentFrequencies.map((freq) => (
                      <option key={freq.value} value={freq.value}>{freq.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {/* Advanced Options Toggle */}
            <div style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0, fontSize: '14px', textDecoration: 'underline' }}
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>
            </div>
            {/* Months Deferred (advanced, hidden by default) */}
            {showAdvanced && (
              <div style={{ maxWidth: '120px', marginTop: '8px' }}>
                <label>
                  Months Deferred
                  <input
                    type="number"
                    value={inputs.monthsDeferred || 0}
                    min="0"
                    max="12"
                    step="1"
                    onChange={(e) => handleInputChange('monthsDeferred', Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '4px', fontSize: '14px' }}
                  />
                </label>
              </div>
            )}
          </form>
        </div>
        {/* Results Section */}
        <div>
          <h2>Lease Calculation</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Financed Amount Summary (green box) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '2px solid #2e7d32', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Financed Amount</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#2e7d32' }}>{formatCurrency(results.financedAmount)}</span>
            </div>
            {/* Breakdown to Financed Amount (collapsible) */}
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', padding: '8px 0' }}>Show calculation details</summary>
              <div style={{ padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #ddd' }}>
                  <span>Driveaway Cost</span>
                  <span style={{ fontWeight: '500' }}>{formatCurrency(inputs.driveawayCost || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Less: GST</span>
                  <span style={{ fontWeight: '500' }}>-{formatCurrency(results.gst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Add: Documentation Fee</span>
                  <span style={{ fontWeight: '500' }}>+{formatCurrency(inputs.documentationFee || 0)}</span>
                </div>
              </div>
            </details>
            {/* Residual Value Summary (blue box) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '4px', border: '2px solid #1976d2', marginBottom: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Residual Value (incl GST)</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#1976d2' }}>{formatCurrency(results.residualInclGst)}</span>
            </div>
            {/* Residual Values (collapsible) */}
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', padding: '8px 0' }}>Show calculation details</summary>
              <div style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px', border: '1px solid #ddd', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #ddd' }}>
                  <span>Residual %</span>
                  <span style={{ fontWeight: '500' }}>{(results.residualPercent * 100).toFixed(2)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Residual Value (excl GST)</span>
                  <span style={{ fontWeight: '500' }}>{formatCurrency(results.residualExclGst)}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #ddd' }}>
                  Calculated from financed amount less fees
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Add: GST (10%)</span>
                  <span style={{ fontWeight: '500' }}>+{formatCurrency(results.residualInclGst - results.residualExclGst)}</span>
                </div>
              </div>
            </details>
            {/* Effective Interest Rate Result */}
            {inputs.paymentAmount && inputs.paymentsPerYear && (
              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fffde7', borderRadius: '8px', border: '1px solid #ffe082' }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#ff8f00' }}>Effective Interest Rate</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff8f00', marginTop: '8px' }}>
                  {effectiveRate !== null ? (effectiveRate * 100).toFixed(2) + '%' : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  Calculated to match the entered payment amount and frequency
                </div>
                {baseRate !== null && (
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                    <b>Base Rate:</b> {(baseRate * 100).toFixed(2)}% (fees included in finance amount)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}