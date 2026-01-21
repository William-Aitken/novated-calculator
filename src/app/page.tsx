
  "use client";
  import { useState, useEffect } from 'react';
  import { calculateNovatedLease, calculateEffectiveInterestRate, type NovatedLeaseInputs } from '@/utils/leaseMath';

const paymentFrequencies = [
  { label: 'Weekly', value: 52 },
  { label: 'Fortnightly', value: 26 },
  { label: 'Monthly', value: 12 },
  { label: 'Yearly', value: 1 },
];



export default function HomePage() {
  // Running costs state
  const [runningCosts, setRunningCosts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseRunningCosts');
      if (saved) {
        try {
          return { managementFee: 0, maintenance: 0, tyres: 0, rego: 0, insurance: 0, chargingFuel: 0, other: 0, ...JSON.parse(saved) };
        } catch {
          return { managementFee: 0, maintenance: 0, tyres: 0, rego: 0, insurance: 0, chargingFuel: 0, other: 0 };
        }
      }
    }
    return { managementFee: 0, maintenance: 0, tyres: 0, rego: 0, insurance: 0, chargingFuel: 0, other: 0 };
  });

  // Sum of running cost inputs (treated as amounts per selected payment period)
  const totalRunningCostsPerPeriod = Object.values(runningCosts).reduce((sum: number, v) => sum + (Number(v) || 0), 0);

  // Handler for running costs
  const handleRunningCostChange = (field: keyof typeof runningCosts, value: number) => {
    const updated = { ...runningCosts, [field]: value };
    setRunningCosts(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseRunningCosts', JSON.stringify(updated));
    }
  };
  const defaultInputs: NovatedLeaseInputs = {
    driveawayCost: 50000,
    residualExcl: 0,
    residualIncl: 0,
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

  const [selectedFrequency, setSelectedFrequency] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseSelectedFrequency');
      if (saved) return Number(saved);
    }
    return 12;
  }); // Default to Monthly

  const [results, setResults] = useState(() => calculateNovatedLease(inputs));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [fbtError, setFbtError] = useState<string | null>(null);

  // Calculate effective interest rate if paymentAmount and paymentsPerYear are provided
  let effectiveRate: number | null = null;
  let baseRate: number | null = null;
  // Use whichever input is non-zero, prioritizing driveawayCost, then residualExcl, then residualIncl
  let leaseInputs = { ...inputs };
  if (typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0) {
    leaseInputs.driveawayCost = inputs.driveawayCost;
    leaseInputs.residualExcl = undefined;
    leaseInputs.residualIncl = undefined;
  } else if (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) {
    leaseInputs.driveawayCost = undefined;
    leaseInputs.residualExcl = undefined;
    leaseInputs.residualIncl = undefined;
    leaseInputs.financedAmountManual = inputs.financedAmountManual;
  } else if (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0) {
    leaseInputs.driveawayCost = undefined;
    leaseInputs.residualIncl = undefined;
    leaseInputs.residualExcl = inputs.residualExcl;
  } else if (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0) {
    leaseInputs.driveawayCost = undefined;
    leaseInputs.residualExcl = undefined;
    leaseInputs.residualIncl = inputs.residualIncl;
  }
  // Helper: compute vehicle-derived values from any one provided input
  const residualPercent = Math.round((0.6563 / 7) * (8 - (inputs.leaseTermYears || 0)) * 10000) / 10000;
  const minValue = Math.min((inputs.fbtBaseValue || 0) / 11, 6334);

  const computeFromDriveaway = (driveaway: number) => {
    const financedAmount = driveaway - minValue + (inputs.documentationFee || 0);
    const residualExclGst = residualPercent * (financedAmount - (inputs.documentationFee || 0));
    return {
      source: 'Driveaway',
      driveawayCost: driveaway,
      financedAmount,
      residualExclGst,
      residualInclGst: residualExclGst * 1.1,
      residualPercent,
    };
  };

  const computeFromResidualExcl = (resExcl: number) => {
    const financedAmount = resExcl / residualPercent + (inputs.documentationFee || 0);
    const driveaway = Math.round(financedAmount + minValue - (inputs.documentationFee || 0));
    return {
      source: 'Residual (excl)',
      driveawayCost: driveaway,
      financedAmount,
      residualExclGst: resExcl,
      residualInclGst: resExcl * 1.1,
      residualPercent,
    };
  };

  const computeFromResidualIncl = (resIncl: number) => {
    const resExcl = resIncl / 1.1;
    return { ...computeFromResidualExcl(resExcl), source: 'Residual (incl)' };
  };

  const computeFromFinanced = (financed: number) => {
    const driveaway = Math.round(financed + minValue - (inputs.documentationFee || 0));
    const residualExclGst = residualPercent * (financed - (inputs.documentationFee || 0));
    return {
      source: 'Financed',
      driveawayCost: driveaway,
      financedAmount: financed,
      residualExclGst,
      residualInclGst: residualExclGst * 1.1,
      residualPercent,
    };
  };

  const vehicleCalculations: Array<any> = [];
  if (typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0) vehicleCalculations.push(computeFromDriveaway(Number(inputs.driveawayCost)));
  if (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0) vehicleCalculations.push(computeFromResidualExcl(Number(inputs.residualExcl)));
  if (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0) vehicleCalculations.push(computeFromResidualIncl(Number(inputs.residualIncl)));
  if (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) vehicleCalculations.push(computeFromFinanced(Number(inputs.financedAmountManual)));
  if (inputs.paymentAmount && inputs.paymentsPerYear) {
    // Prefer manual inputs when available for interest rate solving
    const manualFinanced = (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) ? Number(inputs.financedAmountManual) : undefined;
    const manualResidualExcl = (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0) ? Number(inputs.residualExcl) : undefined;
    const manualResidualIncl = (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0) ? Number(inputs.residualIncl) : undefined;

    const financedForEffective = typeof manualFinanced === 'number' ? (manualFinanced - (inputs.documentationFee || 0)) : (results.financedAmount - (inputs.documentationFee || 0));
    const financedForBase = typeof manualFinanced === 'number' ? manualFinanced : results.financedAmount;

    const residualForEffective = typeof manualResidualExcl === 'number' ? manualResidualExcl : (typeof manualResidualIncl === 'number' ? manualResidualIncl / 1.1 : results.residualExclGst);

    effectiveRate = calculateEffectiveInterestRate({
      ...leaseInputs,
      financedAmount: financedForEffective,
      residualExclGst: residualForEffective,
    });

    baseRate = calculateEffectiveInterestRate({
      ...leaseInputs,
      financedAmount: financedForBase,
      residualExclGst: residualForEffective,
    });
  }

  const handleInputChange = (field: keyof NovatedLeaseInputs, value: number | boolean | undefined) => {
    let updatedInputs = { ...inputs, [field]: value };
    // Do not auto-update `driveawayCost` when residual values change.
    // Prefer using values provided directly by the user (driveawayCost, residualExcl, residualIncl)
    // Calculations will pick whichever input is present without mutating the other fields.

    setInputs(updatedInputs);
    // Persist inputs
    if (typeof window !== 'undefined') {
      const saveCopy: Record<string, any> = { ...updatedInputs };
      Object.keys(saveCopy).forEach(k => {
        if (saveCopy[k] === undefined) saveCopy[k] = null;
      });
      localStorage.setItem('novatedLeaseInputs', JSON.stringify(saveCopy));
    }

    // Validate vehicle group: require at least one of driveawayCost, residualExcl, residualIncl
    const hasVehicleValue = (typeof updatedInputs.driveawayCost === 'number' && updatedInputs.driveawayCost > 0)
      || (typeof updatedInputs.financedAmountManual === 'number' && updatedInputs.financedAmountManual > 0)
      || (typeof updatedInputs.residualExcl === 'number' && updatedInputs.residualExcl > 0)
      || (typeof updatedInputs.residualIncl === 'number' && updatedInputs.residualIncl > 0);
    if (!hasVehicleValue) {
      setVehicleError('Enter at least Driveaway cost or a Residual value');
    } else {
      setVehicleError(null);
    }

    // Validate FBT Base Value is required
    const hasFbt = typeof updatedInputs.fbtBaseValue === 'number' && updatedInputs.fbtBaseValue > 0;
    if (!hasFbt) {
      setFbtError('FBT Base Value is required');
    } else {
      setFbtError(null);
    }

    // If any validation failed, do not proceed to calculations
    if (!hasVehicleValue || !hasFbt) return;

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



  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const runningCostsFrequencyLabel = paymentFrequencies.find(f => f.value === selectedFrequency)?.label || 'Monthly';
  const totalPerPeriod = totalRunningCostsPerPeriod;
  const totalAnnualRunningCosts = totalPerPeriod * (selectedFrequency || 12);
  const annualPaymentAmount = (Number(inputs.paymentAmount) || 0) * (inputs.paymentsPerYear || 12);

  // Diff detection: compare provided inputs to calculated results
  const DIFF_THRESHOLD = 0.05; // 5%
  const calcDriveaway = results.driveawayCost || 0;
  const inputDriveaway = typeof inputs.driveawayCost === 'number' ? inputs.driveawayCost : undefined;
  const driveawayDiffPct = inputDriveaway ? Math.abs(inputDriveaway - calcDriveaway) / (calcDriveaway || 1) : 0;

  const calcFinanced = results.financedAmount || 0;
  const inputFinanced = typeof inputs.financedAmountManual === 'number' ? inputs.financedAmountManual : undefined;
  const financedDiffPct = inputFinanced ? Math.abs(inputFinanced - calcFinanced) / (calcFinanced || 1) : 0;

  const calcResidualExcl = results.residualExclGst || 0;
  const inputResidualExcl = typeof inputs.residualExcl === 'number' ? inputs.residualExcl : undefined;
  const residualDiffPct = inputResidualExcl ? Math.abs(inputResidualExcl - calcResidualExcl) / (calcResidualExcl || 1) : 0;
  const calcResidualIncl = results.residualInclGst || 0;
  const inputResidualIncl = typeof inputs.residualIncl === 'number' ? inputs.residualIncl : undefined;
  const residualInclDiffPct = inputResidualIncl ? Math.abs(inputResidualIncl - calcResidualIncl) / (calcResidualIncl || 1) : 0;



  return (
    <main style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Novated Lease Calculator</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '32px' }}>
        {/* Input Section */}
        <div>
          <h2>Lease Details</h2>
          <div style={{ padding: '0 20px', border: '1px solid #eee', borderRadius: '12px', background: '#fff' }}>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Main Inputs as Tight List with Left Labels */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Lease Term (years)</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={inputs.leaseTermYears || ''}
                  onChange={e => handleInputChange('leaseTermYears', Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>

              <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>FBT Base Value*</span>
                <input
                  type="number"
                  value={inputs.fbtBaseValue || ''}
                  onChange={e => handleInputChange('fbtBaseValue', Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>
              {fbtError && <li><div style={{ color: '#b00020', fontSize: '12px', marginLeft: 150 }}>{fbtError}</div></li>}

              <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 500, color: '#222', fontSize: '15px', minWidth: 150 }}>Vehicle Values</span>
                <small style={{ color: '#666', fontSize: '12px' }}>At least one required</small>
              </li>

              <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150 }}>Driveaway Cost</span>
                <input
                  placeholder="Driveaway Cost"
                  type="number"
                  value={inputs.driveawayCost || ''}
                  onChange={e => handleInputChange('driveawayCost', e.target.value === '' ? undefined : Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>

              <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150 }}>Financed Amount</span>
                <input
                  placeholder="Financed Amount"
                  type="number"
                  value={inputs.financedAmountManual || ''}
                  onChange={e => handleInputChange('financedAmountManual', e.target.value === '' ? undefined : Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>

              <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150 }}>Residual (excl GST)</span>
                <input
                  placeholder="Residual (excl GST)"
                  type="number"
                  value={inputs.residualExcl || ''}
                  onChange={e => handleInputChange('residualExcl', e.target.value === '' ? undefined : Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>

              <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150 }}>Residual (incl GST)</span>
                <input
                  placeholder="Residual (incl GST)"
                  type="number"
                  value={inputs.residualIncl || ''}
                  onChange={e => handleInputChange('residualIncl', e.target.value === '' ? undefined : Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>
              {vehicleError && <li><div style={{ color: '#b00020', fontSize: '12px', marginLeft: 150 }}>{vehicleError}</div></li>}

              <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Documentation Fee</span>
                <input
                  type="number"
                  value={inputs.documentationFee || ''}
                  onChange={e => handleInputChange('documentationFee', Number(e.target.value))}
                  style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                />
              </li>
            </ul>
            </form>

              {/* Payment Group (includes advanced options) */}
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center', gap: '10px' }}>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>Payment Amount</div>
                      <div style={{ marginTop: '6px' }}>
                        <select
                          value={selectedFrequency}
                          onChange={handleFrequencyChange}
                          style={{
                            width: '100%',
                            height: '18px',
                            padding: '0 8px',
                            lineHeight: '18px',
                            border: '1px solid #e6e9ee',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: '#222',
                            fontWeight: 500,
                            fontSize: '13px',
                            appearance: 'auto',
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = '#1565c0')}
                          onBlur={e => (e.currentTarget.style.borderColor = '#1976d2')}
                        >
                          {paymentFrequencies.map((freq) => (
                            <option key={freq.value} value={freq.value}>{freq.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <input
                      type="number"
                      value={inputs.paymentAmount || ''}
                      onChange={(e) => handleInputChange('paymentAmount', Number(e.target.value))}
                      style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }}
                    />
                  </li>
                </ul>

                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', padding: 0, fontSize: '14px', textDecoration: 'underline' }}
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </button>
                </div>

                {showAdvanced && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 150 }}>
                      <div style={{ fontWeight: 500, color: '#222', fontSize: '15px' }}>Months Deferred</div>
                    </div>
                    <div style={{ maxWidth: '120px' }}>
                      <input
                        type="number"
                        value={inputs.monthsDeferred || 0}
                        min="0"
                        max="12"
                        step="1"
                        onChange={(e) => handleInputChange('monthsDeferred', Number(e.target.value))}
                        style={{ width: '12ch', padding: '8px', fontSize: '14px', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                    )}
                  </div>
            {/* Running Costs Section */}
            <div style={{ marginTop: '32px', padding: '20px', border: '1.5px solid #1976d2', borderRadius: '12px', background: '#f7faff' }}>
              <h3 style={{ marginBottom: '16px', color: '#1976d2' }}>Running Costs ({runningCostsFrequencyLabel})</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Management Fee</span>
                  <input type="number" min="0" step="1" value={runningCosts.managementFee} onChange={e => handleRunningCostChange('managementFee', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Maintenance</span>
                  <input type="number" min="0" step="1" value={runningCosts.maintenance} onChange={e => handleRunningCostChange('maintenance', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Tyres</span>
                  <input type="number" min="0" step="1" value={runningCosts.tyres} onChange={e => handleRunningCostChange('tyres', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Rego</span>
                  <input type="number" min="0" step="1" value={runningCosts.rego} onChange={e => handleRunningCostChange('rego', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Insurance</span>
                  <input type="number" min="0" step="1" value={runningCosts.insurance} onChange={e => handleRunningCostChange('insurance', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Charging/Fuel</span>
                  <input type="number" min="0" step="1" value={runningCosts.chargingFuel} onChange={e => handleRunningCostChange('chargingFuel', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
                <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                  <span style={{ minWidth: 150, fontWeight: 500, color: '#222', fontSize: '15px' }}>Other</span>
                  <input type="number" min="0" step="1" value={runningCosts.other} onChange={e => handleRunningCostChange('other', Number(e.target.value))} style={{ width: '12ch', padding: '8px', borderRadius: '8px', justifySelf: 'end' }} />
                </li>
              </ul>
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ minWidth: 150, fontWeight: 600, color: '#222', fontSize: '15px' }}>Total Running Costs </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(totalPerPeriod)} / {runningCostsFrequencyLabel}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{formatCurrency(totalAnnualRunningCosts)} pa</div>
                </div>
              </div>
            </div>
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
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '500' }}>{formatCurrency(results.driveawayCost || 0)}</div>
                        {typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0 ? (
                          <div style={{ color: driveawayDiffPct > DIFF_THRESHOLD ? '#b00020' : '#666', fontSize: '12px' }}>
                            from quote {formatCurrency(inputs.driveawayCost)}{driveawayDiffPct > DIFF_THRESHOLD ? ` — ${(driveawayDiffPct*100).toFixed(1)}% diff` : ''}
                          </div>
                        ) : null}
                      </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Less: GST</span>
                    <span style={{ fontWeight: '500' }}>-{formatCurrency(minValue)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Add: Documentation Fee</span>
                    <span style={{ fontWeight: '500' }}>+{formatCurrency(inputs.documentationFee || 0)}</span>
                  </div>
                </div>
              </details>
              <div style={{ padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '2px solid #2e7d32', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Financed Amount</span>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#2e7d32' }}>{formatCurrency(results.financedAmount)}</span>
                </div>
                {(typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) ? (
                  <div style={{ textAlign: 'right', color: financedDiffPct > DIFF_THRESHOLD ? '#b00020' : '#666', fontSize: '13px' }}>
                    from quote {formatCurrency(inputs.financedAmountManual)}{financedDiffPct > DIFF_THRESHOLD ? ` — ${(financedDiffPct*100).toFixed(1)}% diff` : ''}
                  </div>
                ) : null}
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
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '500' }}>{formatCurrency(results.residualExclGst)}</div>
                      {typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0 ? (
                        <div style={{ color: '#666', fontSize: '12px' }}>from quote {formatCurrency(inputs.residualExcl)}</div>
                      ) : null}
                    </div>
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
              <div style={{ padding: '10px', backgroundColor: '#f6fafd', borderRadius: '4px', border: '2px solid #1976d2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Residual Value (incl GST)</span>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1976d2' }}>{formatCurrency(results.residualInclGst)}</span>
                </div>
                {typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0 ? (
                  <div style={{ textAlign: 'right', color: residualInclDiffPct > DIFF_THRESHOLD ? '#b00020' : '#666', fontSize: '13px' }}>
                    from quote {formatCurrency(inputs.residualIncl)}{residualInclDiffPct > DIFF_THRESHOLD ? ` — ${(residualInclDiffPct*100).toFixed(1)}% diff` : ''}
                  </div>
                ) : null}
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

            {/* Offset Account Comparison Section (moved to right column) */}
            <div style={{ marginTop: '40px', padding: '24px', border: '2px solid #bdbdbd', borderRadius: '12px', background: '#f8f9fa' }}>
              <h2 style={{ color: '#1976d2', marginBottom: '18px' }}>Novated Lease vs Offset Account</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0' }}>Annual finance cost</td>
                    <td style={{ textAlign: 'right', padding: '8px 0' }}>{formatCurrency(annualPaymentAmount)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#888' }}>[Offset: --]</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0' }}>Annual running costs</td>
                    <td style={{ textAlign: 'right', padding: '8px 0' }}>{formatCurrency(totalAnnualRunningCosts)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#888' }}>[Offset: --]</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #ddd' }}>
                    <td style={{ fontWeight: 700, padding: '8px 0' }}>Total Annual cost</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700 }}>{formatCurrency(totalAnnualRunningCosts+annualPaymentAmount)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#888', fontWeight: 700 }}>[Offset: --]</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0' }}>Pre-tax contribution</td>
                    <td style={{ textAlign: 'right', padding: '8px 0' }}>--</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#888' }}>[Offset: --]</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0' }}>Post-tax ECM</td>
                    <td style={{ textAlign: 'right', padding: '8px 0' }}>--</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#888' }}>[Offset: --]</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0' }}>Out of pocket per pay</td>
                    <td style={{ textAlign: 'right', padding: '8px 0' }}>--</td>
                    <td style={{ textAlign: 'right', padding: '8px 0', color: '#888' }}>[Offset: --]</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}