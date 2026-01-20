
  "use client";
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
  // Local state for editable residual value inputs
  const [residualExclInput, setResidualExclInput] = useState<string>('');
  const [residualInclInput, setResidualInclInput] = useState<string>('');
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

  // Helper to get calculated values for each basis
  const getCalculatedBasisValue = (basis: 'driveaway' | 'residualExcl' | 'residualIncl') => {
    const leaseTermYears = inputs.leaseTermYears;
    const fbtBaseValue = inputs.fbtBaseValue;
    const gst = fbtBaseValue / 11;
    const documentationFee = inputs.documentationFee || 0;
    const minValue = Math.min(fbtBaseValue / 11, 6334);
    const financedAmount = (inputs.driveawayCost || 0) - minValue + documentationFee;
    const residualPercent = Math.round((0.6563 / 7) * (8 - leaseTermYears) * 10000) / 10000;
    if (basis === 'driveaway') {
      return inputs.driveawayCost || '';
    } else if (basis === 'residualExcl') {
      return (residualPercent * (financedAmount - documentationFee)).toFixed(2);
    } else if (basis === 'residualIncl') {
      const residualExcl = residualPercent * (financedAmount - documentationFee);
      return (residualExcl * 1.1).toFixed(2);
    }
    return '';
  };

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

  // handleToggleMode is no longer needed and can be removed

  // Update driveawayCost if user enters a value in any basis
  const handleBasisInputChange = (value: number) => {
    let updatedInputs = { ...inputs };
    const leaseTermYears = updatedInputs.leaseTermYears;
    const fbtBaseValue = updatedInputs.fbtBaseValue;
    const gst = fbtBaseValue / 11;
    const residualPercent = Math.round((0.6563 / 7) * (8 - leaseTermYears) * 10000) / 10000;
    if (calcBasis === 'driveaway') {
      updatedInputs.driveawayCost = value;
    } else if (calcBasis === 'residualExcl') {
      setResidualExclInput(value ? String(value) : '');
      updatedInputs.driveawayCost = Math.round((value / residualPercent) + gst);
    } else if (calcBasis === 'residualIncl') {
      setResidualInclInput(value ? String(value) : '');
      updatedInputs.driveawayCost = Math.round(((value / 1.1) / residualPercent) + gst);
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
          <h2>Lease Details</h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Lease Term at the top */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>
                Lease Term (Years) *
                <input
                  type="number"
                  value={inputs.leaseTermYears}
                  onChange={(e) => handleInputChange('leaseTermYears', Number(e.target.value))}
                  min="1"
                  max="7"
                  step="1"
                  style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                />
              </label>
            </div>
            {/* Vehicle Value Section */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>
                FBT Base Value (excl on-roads) (AUD) *
                <input
                  type="number"
                  value={inputs.fbtBaseValue}
                  onChange={(e) => handleInputChange('fbtBaseValue', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                />
              </label>
            </div>
            {/* Calculation Basis Dropdown and Inputs */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label htmlFor="calc-basis-select" style={{ fontWeight: 500, color: '#222', marginBottom: '2px', fontSize: '15px' }}>Calculate using</label>
                <select
                  id="calc-basis-select"
                  value={calcBasis}
                  onChange={e => {
                    const newBasis = e.target.value as 'driveaway' | 'residualExcl' | 'residualIncl';
                    setCalcBasis(newBasis);
                    // Set the input field to the calculated value for the new basis
                    if (newBasis === 'residualExcl') {
                      setResidualExclInput(getCalculatedBasisValue('residualExcl'));
                    } else if (newBasis === 'residualIncl') {
                      setResidualInclInput(getCalculatedBasisValue('residualIncl'));
                    }
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('novatedLeaseCalcBasis', newBasis);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1.5px solid #1976d2',
                    borderRadius: '8px',
                    background: '#fff',
                    color: 'inherit',
                    fontWeight: 500,
                    fontSize: '15px',
                    appearance: 'auto',
                    outline: 'none',
                    boxShadow: '0 1px 4px rgba(25, 118, 210, 0.07)',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#1565c0')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#1976d2')}
                >
                  {calculationBases.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {calcBasis === 'driveaway' && (
                <label style={{ flex: 1, fontWeight: 500, color: '#222', fontSize: '15px' }}>
                  Driveaway Cost (AUD) *
                  <input
                    type="number"
                    value={inputs.driveawayCost || ''}
                    onChange={e => handleBasisInputChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                  />
                </label>
              )}
              {calcBasis === 'residualExcl' && (
                <label style={{ flex: 1, fontWeight: 500, color: '#222', fontSize: '15px' }}>
                  Residual Value (excl GST) *
                  <input
                    type="number"
                    value={residualExclInput}
                    onChange={e => handleBasisInputChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                  />
                </label>
              )}
              {calcBasis === 'residualIncl' && (
                <label style={{ flex: 1, fontWeight: 500, color: '#222', fontSize: '15px' }}>
                  Residual Value (incl GST) *
                  <input
                    type="number"
                    value={residualInclInput}
                    onChange={e => handleBasisInputChange(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                  />
                </label>
              )}

            </div>
            {/* Documentation Fee Section */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>
                Documentation Fee (AUD)
                <input
                  type="number"
                  value={inputs.documentationFee || 0}
                  onChange={(e) => handleInputChange('documentationFee', Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                />
              </label>
            </div>
            {/* Payment Section */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>
                  Payment Amount (AUD)
                  <input
                    type="number"
                    value={inputs.paymentAmount || ''}
                    onChange={(e) => handleInputChange('paymentAmount', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '8px' }}
                  />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>
                  Frequency
                  <select
                    value={selectedFrequency}
                    onChange={handleFrequencyChange}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      marginTop: '4px',
                      border: '1.5px solid #1976d2',
                      borderRadius: '8px',
                      background: '#fff',
                      color: 'inherit',
                      fontWeight: 500,
                      fontSize: '15px',
                      appearance: 'auto',
                      outline: 'none',
                      boxShadow: '0 1px 4px rgba(25, 118, 210, 0.07)',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#1565c0')}
                    onBlur={e => (e.currentTarget.style.borderColor = '#1976d2')}
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
                <label style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>
                  Months Deferred
                  <input
                    type="number"
                    value={inputs.monthsDeferred || 0}
                    min="0"
                    max="12"
                    step="1"
                    onChange={(e) => handleInputChange('monthsDeferred', Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', marginTop: '4px', fontSize: '14px', borderRadius: '8px' }}
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
            {/* Calculation Details and Residual Grouped Section */}
            {/* Financed Amount Section */}
            <div style={{ marginBottom: '10px' }}>
              <details style={{ marginBottom: '4px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', padding: '6px 0' }}>Show Financed Amount Breakdown</summary>
                <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #ddd' }}>
                    <span>Driveaway Cost</span>
                    <span style={{ fontWeight: '500' }}>{formatCurrency(inputs.driveawayCost || 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Less: GST</span>
                    <span style={{ fontWeight: '500' }}>-{formatCurrency(results.gst)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Add: Documentation Fee</span>
                    <span style={{ fontWeight: '500' }}>+{formatCurrency(inputs.documentationFee || 0)}</span>
                  </div>
                </div>
              </details>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '2px solid #2e7d32' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Financed Amount</span>
                <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#2e7d32' }}>{formatCurrency(results.financedAmount)}</span>
              </div>
            </div>
            {/* Residual Calculation Grouped Section (matches Financed Amount style) */}
            <div style={{ marginBottom: '10px' }}>
              <details style={{ marginBottom: '4px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', padding: '6px 0' }}>Show Residual Breakdown</summary>
                <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '8px', border: '1px solid #ddd', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #ddd' }}>
                    <span>Residual %</span>
                    <span style={{ fontWeight: '500' }}>{(results.residualPercent * 100).toFixed(2)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Residual Value (excl GST)</span>
                    <span style={{ fontWeight: '500' }}>{formatCurrency(results.residualExclGst)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #ddd' }}>
                    Calculated from financed amount less fees
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Add: GST (10%)</span>
                    <span style={{ fontWeight: '500' }}>+{formatCurrency(results.residualInclGst - results.residualExclGst)}</span>
                  </div>
                </div>
              </details>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f6fafd', borderRadius: '4px', border: '2px solid #1976d2' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Residual Value (incl GST)</span>
                <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1976d2' }}>{formatCurrency(results.residualInclGst)}</span>
              </div>
            </div>
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