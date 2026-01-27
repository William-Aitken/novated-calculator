
  "use client";
  import { useState, useEffect, useRef } from 'react';
  import html2canvas from 'html2canvas';
  import { calculateNovatedLease, calculateEffectiveInterestRate, calculateBYOPayment, pmt, type NovatedLeaseInputs } from '@/utils/leaseMath';

const paymentFrequencies = [
  { label: 'Weekly', value: 52 },
  { label: 'Fortnightly', value: 26 },
  { label: 'Monthly', value: 12 },
  { label: 'Yearly', value: 1 },
];

interface SavedQuote {
  id: string;
  name: string;
  inputs: NovatedLeaseInputs;
  runningCosts: any;
  salary: number | undefined;
  packageCap: number | undefined;
  nlProvider: string;
  selectedFrequency: number;
  createdAt: string;
}

export default function HomePage() {
  // Running costs state
  // Running costs state (fields may be empty/undefined)
  type RunningCosts = {
    managementFee?: number;
    maintenance?: number;
    tyres?: number;
    rego?: number;
    insurance?: number;
    chargingFuel?: number;
    other?: number;
  };

  const defaultRunningCosts: RunningCosts = { managementFee: undefined, maintenance: undefined, tyres: undefined, rego: undefined, insurance: undefined, chargingFuel: undefined, other: undefined };

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseDarkMode');
      return saved ? saved === 'true' : false;
    }
    return false;
  });

  // Menu and quotes state
  const [showMenu, setShowMenu] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseSavedQuotes');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  // Update theme in document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem('novatedLeaseDarkMode', String(isDarkMode));
    }
  }, [isDarkMode]);

  // Helper function to get background color based on theme
  const getBgColor = (lightColor: string, darkColor: string = '#2d2d2d') => {
    return isDarkMode ? darkColor : lightColor;
  };

  // Helper function to get text color based on theme
  const getTextColor = (lightColor: string, darkColor: string = '#e0e0e0') => {
    return isDarkMode ? darkColor : lightColor;
  };

  // Helper function to get border color based on theme
  const getBorderColor = (lightColor: string, darkColor: string = '#555') => {
    return isDarkMode ? darkColor : lightColor;
  };

  // Helper function to calculate payment at 8% effective rate
  const calculatePaymentAt8Percent = () => {
    // Use shared lease math to ensure identical logic to the effective rate calculator
    try {
      const financedAmount = results.financedAmount || 0;
      const residual = results.residualExclGst || 0;
      const paymentsPerYear = inputs.paymentsPerYear || 12;
      const leaseTermYears = inputs.leaseTermYears || 0;
      const monthsDeferred = typeof inputs.monthsDeferred === 'number' ? inputs.monthsDeferred : 2;

      if (financedAmount > 0 && leaseTermYears > 0) {
        let payment = calculateBYOPayment({
          financedAmount,
          residualExclGst: residual,
          paymentsPerYear,
          leaseTermYears,
          monthsDeferred,
          interestRate: 0.08,
        });
        // If running costs include GST, add GST to the payment
        if (runningCostsIncludeGst) {
          payment = payment * 1.1;
        }
        return payment;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Save quote handler
  const handleSaveQuote = () => {
    const quoteName = prompt('Enter a name for this quote:');
    if (!quoteName) return;

    const newQuote: SavedQuote = {
      id: Date.now().toString(),
      name: quoteName,
      inputs,
      runningCosts,
      salary: annualSalary,
      packageCap,
      nlProvider,
      selectedFrequency,
      createdAt: new Date().toLocaleDateString(),
    };

    const updated = [...savedQuotes, newQuote];
    setSavedQuotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseSavedQuotes', JSON.stringify(updated));
    }
    alert(`Quote "${quoteName}" saved!`);
  };

  // Load quote handler
  const handleLoadQuote = (quote: SavedQuote) => {
    setInputs(quote.inputs);
    setRunningCosts(quote.runningCosts);
    setAnnualSalary(quote.salary);
    setPackageCap(quote.packageCap);
    setNlProvider(quote.nlProvider);
    setSelectedFrequency(quote.selectedFrequency);
    setShowMenu(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseInputs', JSON.stringify(quote.inputs));
      localStorage.setItem('novatedLeaseRunningCosts', JSON.stringify(quote.runningCosts));
      if (quote.salary !== undefined) localStorage.setItem('novatedLeaseAnnualSalary', String(quote.salary));
      if (quote.packageCap !== undefined) localStorage.setItem('novatedLeasePackageCap', String(quote.packageCap));
      localStorage.setItem('novatedLeaseNlProvider', quote.nlProvider);
      localStorage.setItem('novatedLeaseSelectedFrequency', String(quote.selectedFrequency));
    }
  };

  // Delete quote handler
  const handleDeleteQuote = (id: string) => {
    const updated = savedQuotes.filter(q => q.id !== id);
    setSavedQuotes(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseSavedQuotes', JSON.stringify(updated));
    }
  };

  // Clear inputs handler
  const handleClearInputs = () => {
    if (!confirm('Clear all inputs? This cannot be undone.')) return;
    
    const defaultInputs: NovatedLeaseInputs = {
      driveawayCost: 0,
      residualExcl: 0,
      residualIncl: 0,
      fbtBaseValue: 0,
      documentationFee: 0,
      leaseTermYears: 5,
      paymentAmount: 0,
      paymentsPerYear: 12,
      monthsDeferred: 2,
    };

    setInputs(defaultInputs);
    setRunningCosts(defaultRunningCosts);
    setAnnualSalary(undefined);
    setPackageCap(undefined);
    setNlProvider('');
    setSelectedFrequency(12);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('novatedLeaseInputs');
      localStorage.removeItem('novatedLeaseRunningCosts');
      localStorage.removeItem('novatedLeaseAnnualSalary');
      localStorage.removeItem('novatedLeasePackageCap');
      localStorage.removeItem('novatedLeaseNlProvider');
      localStorage.removeItem('novatedLeaseSelectedFrequency');
    }
  };

  // Share calculation handler
  // Encode calculation state to URL-safe string
  const encodeCalculationState = () => {
    const state = {
      inputs,
      runningCosts,
      annualSalary,
      packageCap,
      isEv,
    };
    const json = JSON.stringify(state);
    return btoa(json); // Base64 encode
  };

  // Decode calculation state from URL
  const decodeCalculationState = (encoded: string) => {
    try {
      const json = atob(encoded); // Base64 decode
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // Load calculation from URL on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    const sharedState = params.get('calc');
    
    if (sharedState) {
      const decoded = decodeCalculationState(sharedState);
      if (decoded) {
        setInputs(decoded.inputs || inputs);
        setRunningCosts(decoded.runningCosts || runningCosts);
        setAnnualSalary(decoded.annualSalary);
        setPackageCap(decoded.packageCap);
        setIsEv(decoded.isEv ?? false);
        // Restore frequency from shared state
        if (decoded.inputs?.paymentsPerYear) {
          setSelectedFrequency(decoded.inputs.paymentsPerYear);
        }
      }
    }
  }, []); // Run only on mount

  const handleShareCalculation = () => {
    const encoded = encodeCalculationState();
    const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    const shareUrl = `${baseUrl}?calc=${encoded}`;

    const shareData = {
      title: 'Novated Lease Calculator Results',
      text: `Check out my novated lease calculation! Driveaway: $${inputs.driveawayCost}, Lease Term: ${inputs.leaseTermYears} years, FBT Base: $${inputs.fbtBaseValue}`,
      url: shareUrl,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(err => console.log('Share error:', err));
    } else {
      // Fallback: copy to clipboard
      const text = `${shareData.text}\n${shareUrl}`;
      navigator.clipboard.writeText(text).then(() => {
        alert('Calculation link copied to clipboard!');
      });
    }
  };

  const handleExportAsImage = async () => {
    const contentElement = document.getElementById('calculator-content');
    if (!contentElement) return;

    try {
      // Create a wrapper with padding for export
      const wrapper = document.createElement('div');
      wrapper.style.padding = '24px';
      wrapper.style.backgroundColor = isDarkMode ? '#1a1a1a' : '#ffffff';
      wrapper.style.minHeight = '100vh';
      wrapper.style.boxSizing = 'border-box';
      const clonedContent = contentElement.cloneNode(true) as HTMLElement;
      
      // Expand all details elements in the cloned content
      const detailsElements = clonedContent.querySelectorAll('details');
      detailsElements.forEach((details) => {
        details.setAttribute('open', '');
      });
      
      wrapper.appendChild(clonedContent);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      document.body.removeChild(wrapper);

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `novated-lease-calculation-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
    } catch (error) {
      console.error('Error exporting as image:', error);
      alert('Failed to export as image. Please try again.');
    }
  };

  const [runningCosts, setRunningCosts] = useState<RunningCosts>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseRunningCosts');
      if (saved) {
        try {
          const parsed = JSON.parse(saved || '{}');
          const normalized: RunningCosts = { ...defaultRunningCosts };
          Object.keys(normalized).forEach((k) => {
            const val = (parsed as any)[k];
            normalized[k as keyof RunningCosts] = (val === null || val === undefined || val === '') ? undefined : Number(val);
          });
          return normalized;
        } catch {
          return defaultRunningCosts;
        }
      }
    }
    return defaultRunningCosts;
  });

  // Handler for running costs
  // Handler for running costs (allow empty/undefined)
  const handleRunningCostChange = (field: keyof RunningCosts, value: number | undefined) => {
    const updated = { ...runningCosts, [field]: value };
    setRunningCosts(updated);
    if (typeof window !== 'undefined') {
      // Save as JSON; undefined fields will be omitted
      localStorage.setItem('novatedLeaseRunningCosts', JSON.stringify(updated));
    }
  };
  // Is the vehicle an EV? Persisted choice for running costs
  const [isEv, setIsEv] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('novatedLeaseIsEv');
      return v ? v === 'true' : false;
    }
    return false;
  });
  
  // Do running costs include GST? Persisted choice
  const [runningCostsIncludeGst, setRunningCostsIncludeGst] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('novatedLeaseRunningCostsIncludeGst');
      return v ? v === 'true' : false;
    }
    return false;
  });
  
  // GST savings passed on by employer?
  const [gstSavingsPassedOn, setGstSavingsPassedOn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('novatedLeaseGstSavingsPassedOn');
      return v ? v === 'true' : true; // Default to true
    }
    return true;
  });
  
  const [annualSalary, setAnnualSalary] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('novatedLeaseAnnualSalary');
      return v === null || v === '' ? undefined : Number(v);
    }
    return undefined;
  });
  const [packageCap, setPackageCap] = useState<number | undefined>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('novatedLeasePackageCap');
      return v === null || v === '' ? undefined : Number(v);
    }
    return undefined;
  });
  
  // NL Provider state
  const nlProviders = [
    'Maxxia',
    'SG Fleet',
    'FleetPartners',
    'LeasePlan',
    'SmartSalary',
    'Toyota Fleet Management',
    'Orix',
    'LeaseLab',
    'Simplygreen',
    'WhipSmart',
    'Easi / Alliance Leasing',
    'FleetChoice',
    'Autopia',
    'NLA',
    'Paywise',
  ];

  const [nlProvider, setNlProvider] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const v = localStorage.getItem('novatedLeaseNlProvider');
      return v ?? '';
    }
    return '';
  });

  const handleNlProviderChange = (value: string) => {
    setNlProvider(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('novatedLeaseNlProvider', value);
    }
  };

  const defaultInputs: NovatedLeaseInputs = {
    driveawayCost: 0,
    residualExcl: 0,
    residualIncl: 0,
    fbtBaseValue: 0,
    documentationFee: 0,
    leaseTermYears: 5,
    paymentAmount: 0,
    paymentsPerYear: 12,
    monthsDeferred: 2,
  };

  const [inputs, setInputs] = useState<NovatedLeaseInputs>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('novatedLeaseInputs');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const merged: any = { ...defaultInputs, ...parsed };
          const hasVehicleValue = [merged.driveawayCost, merged.financedAmountManual, merged.residualExcl, merged.residualIncl].some(v => typeof v === 'number' && !isNaN(v));
          if (!hasVehicleValue) {
            merged.driveawayCost = defaultInputs.driveawayCost;
          }
          return merged as NovatedLeaseInputs;
        } catch {
          return defaultInputs;
        }
      }
    }
    return defaultInputs;
  });

  const [selectedFrequency, setSelectedFrequency] = useState<number>(12); // Default to Monthly

  // Load saved selected frequency on client only to avoid SSR hydration mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('novatedLeaseSelectedFrequency');
      if (saved) {
        const n = Number(saved);
        if (Number.isFinite(n)) {
          setSelectedFrequency(n);
          setInputs(prev => ({ ...prev, paymentsPerYear: n }));
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const defaultResults = {
    gst: 0,
    driveawayCost: 0,
    financedAmount: 0,
    residualPercent: 0,
    residualExclGst: 0,
    residualInclGst: 0,
  };

  const [results, setResults] = useState(() => {
    try {
      return calculateNovatedLease(inputs);
    } catch (e) {
      return defaultResults;
    }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [fbtError, setFbtError] = useState<string | null>(null);

  // Recalculate when inputs change and validation passes
  useEffect(() => {
    // Validate vehicle group: require at least one of driveawayCost, residualExcl, residualIncl
    const hasVehicleValue = (typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0)
      || (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0)
      || (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0)
      || (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0);

    // Validate FBT Base Value is required
    const hasFbt = typeof inputs.fbtBaseValue === 'number' && inputs.fbtBaseValue > 0;

    // If validation passed, recalculate results
    if (hasVehicleValue && hasFbt) {
      try {
        setResults(calculateNovatedLease(inputs));
      } catch (e) {
        // Silently fail if calculation throws
      }
    }
  }, [inputs]);

  // Comparison controls (persisted per-target)
  const DEFAULT_COMPARISON_RATES: Record<string, number> = {
    offset: 5.0,
    carloan: 6.5,
    hisa: 4.5,
    self: 8.0,
  };

  let initialComparisonTarget = 'offset';
  if (typeof window !== 'undefined') {
    try {
      initialComparisonTarget = localStorage.getItem('novatedLeaseComparisonTarget') || 'offset';
    } catch (e) {
      initialComparisonTarget = 'offset';
    }
  }

  const [comparisonTarget, setComparisonTarget] = useState<string>(initialComparisonTarget);

  const getSavedComparisonRate = (target: string) => {
    try {
      if (typeof window === 'undefined') return DEFAULT_COMPARISON_RATES[target] ?? 3.5;
      const key = `novatedLeaseComparisonInterestRate_${target}`;
      const v = localStorage.getItem(key);
      const n = v ? Number(v) : NaN;
      return Number.isFinite(n) ? n : (DEFAULT_COMPARISON_RATES[target] ?? 3.5);
    } catch (e) {
      return DEFAULT_COMPARISON_RATES[target] ?? 3.5;
    }
  };

  const [comparisonInterestRate, setComparisonInterestRate] = useState<number>(() => getSavedComparisonRate(initialComparisonTarget));

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

  // Adjust payment amount based on GST settings (early calculation for use in interest rate)
  const adjustedPaymentAmount = (() => {
    const baseAmount = Number(inputs.paymentAmount) || 0;
    if (gstSavingsPassedOn && runningCostsIncludeGst) return baseAmount / 1.1;
    if (!gstSavingsPassedOn && !runningCostsIncludeGst) return baseAmount * 1.1;
    return baseAmount;
  })();

  // Effective payment amount that only changes based on runningCostsIncludeGst
  const effectivePaymentAmount = (() => {
    const baseAmount = Number(inputs.paymentAmount) || 0;
    if (runningCostsIncludeGst) return baseAmount / 1.1;
    return baseAmount;
  })();

  const vehicleCalculations: Array<any> = [];
  if (typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0) vehicleCalculations.push(computeFromDriveaway(Number(inputs.driveawayCost)));
  if (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0) vehicleCalculations.push(computeFromResidualExcl(Number(inputs.residualExcl)));
  if (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0) vehicleCalculations.push(computeFromResidualIncl(Number(inputs.residualIncl)));
  if (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) vehicleCalculations.push(computeFromFinanced(Number(inputs.financedAmountManual)));
  if (Number.isFinite(Number(effectivePaymentAmount)) && Number.isFinite(Number(inputs.paymentsPerYear)) && effectivePaymentAmount > 0) {
    // Prefer manual inputs when available for interest rate solving
    const manualFinanced = (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) ? Number(inputs.financedAmountManual) : undefined;
    const manualResidualExcl = (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0) ? Number(inputs.residualExcl) : undefined;
    const manualResidualIncl = (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0) ? Number(inputs.residualIncl) : undefined;

    const financedForEffective = typeof manualFinanced === 'number' ? (manualFinanced - (inputs.documentationFee || 0)) : (results.financedAmount - (inputs.documentationFee || 0));
    const financedForBase = typeof manualFinanced === 'number' ? manualFinanced : results.financedAmount;

    const residualForEffective = typeof manualResidualExcl === 'number' ? manualResidualExcl : (typeof manualResidualIncl === 'number' ? manualResidualIncl / 1.1 : results.residualExclGst);

    effectiveRate = calculateEffectiveInterestRate({
      ...leaseInputs,
      paymentAmount: effectivePaymentAmount,
      financedAmount: financedForEffective,
      residualExclGst: residualForEffective,
    });

    baseRate = calculateEffectiveInterestRate({
      ...leaseInputs,
      paymentAmount: effectivePaymentAmount,
      financedAmount: financedForBase,
      residualExclGst: residualForEffective,
    });

    // Do not set state during render; derive payment error below instead
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
      setVehicleError('Enter at least one vehicle value');
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
    // The useEffect will handle recalculation based on the updated inputs
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

  // Helper to render comparison column value based on comparison type
  const getComparisonValue = (
    selfValue: number | null,
    offsetValue: number | null = null,
    hisaValue: number | null = null,
    carloanValue: number | null = null
  ) => {
    if (comparisonTarget === 'self') {
      return selfValue !== null ? formatCurrency(selfValue) : '--';
    } else if (comparisonTarget === 'offset') {
      return offsetValue !== null ? formatCurrency(offsetValue) : '--';
    } else if (comparisonTarget === 'hisa') {
      const v = hisaValue !== null ? hisaValue : offsetValue;
      return v !== null ? formatCurrency(v) : '--';
    } else if (comparisonTarget === 'carloan') {
      const v = carloanValue !== null ? carloanValue : offsetValue;
      return v !== null ? formatCurrency(v) : '--';
    }
    return '[' + comparisonTarget.charAt(0).toUpperCase() + comparisonTarget.slice(1) + ': --]';
  };

  // Australian resident income tax (2025-26) simple slab calculation
  const calculateAUSIncomeTax = (taxableIncome: number) => {
    const x = Math.max(0, Math.floor(taxableIncome));
    if (x <= 18200) return x * 0.02;
    if (x <= 45000) return 364 + (x - 18200) * 0.18;
    if (x <= 135000) return 5188 + (x - 45000) * 0.32;
    if (x <= 180000) return 33988 + (x - 135000) * 0.39;
    return 55438 + (x - 190000) * 0.47;
  };

  // Consolidated vehicle values for consistency across comparisons
  // Prefer manual inputs; fall back to calculated values
  const comparisonDriveaway = (typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0) ? inputs.driveawayCost : results.driveawayCost || 0;
  const comparisonFinanced = (typeof inputs.financedAmountManual === 'number' && inputs.financedAmountManual > 0) ? inputs.financedAmountManual : results.financedAmount || 0;
  const comparisonResidualExcl = 
    (typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0) ? inputs.residualExcl :
    (typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0) ? inputs.residualIncl / 1.1 :
    results.residualExclGst || 0;
  const comparisonResidualIncl = comparisonResidualExcl * 1.1;

  const annualSalaryNum = Number(annualSalary) || 0;
  const packageCapNum = Number(packageCap)/1.1 || 0;
  const runningCostsFrequencyLabel = paymentFrequencies.find(f => f.value === selectedFrequency)?.label || 'Monthly';
  
  // Adjust running costs based on GST settings
  const adjustedRunningCosts: RunningCosts = (() => {
    const multiplier = (gstSavingsPassedOn && runningCostsIncludeGst) ? 1 / 1.1 : (!gstSavingsPassedOn && !runningCostsIncludeGst) ? 1.1 : 1;
    if (multiplier === 1) return runningCosts;
    return {
      managementFee: runningCosts.managementFee ? runningCosts.managementFee * multiplier : undefined,
      maintenance: runningCosts.maintenance ? runningCosts.maintenance * multiplier : undefined,
      tyres: runningCosts.tyres ? runningCosts.tyres * multiplier : undefined,
      rego: runningCosts.rego ? runningCosts.rego * multiplier : undefined,
      insurance: runningCosts.insurance ? runningCosts.insurance * multiplier : undefined,
      chargingFuel: runningCosts.chargingFuel ? runningCosts.chargingFuel * multiplier : undefined,
      other: runningCosts.other ? runningCosts.other * multiplier : undefined,
    };
  })();
  
  const ecGstPerPeriod = (!isEv && (inputs.fbtBaseValue || 0)) ? ((inputs.fbtBaseValue || 0) * 0.2 - packageCapNum )/ 11 / (inputs.paymentsPerYear || 12) : 0;
  const totalRunningCostsPerPeriod = Object.values(adjustedRunningCosts).reduce((sum: number, v) => sum + (Number(v) || 0), 0) + ecGstPerPeriod;
  const postTaxEcm = !isEv ? Math.max(0, (inputs.fbtBaseValue || 0) * 0.2 - packageCapNum) : 0;
  const normalRunningCostsPerPeriod = (totalRunningCostsPerPeriod - (adjustedRunningCosts.managementFee || 0) - ecGstPerPeriod) * 1.1;
  const totalAnnualRunningCosts = totalRunningCostsPerPeriod * (selectedFrequency || 12);
  const annualPaymentAmount = adjustedPaymentAmount * (inputs.paymentsPerYear || 12);
  const totalAnnualCost = totalAnnualRunningCosts + annualPaymentAmount;
  const preTaxContribution = Math.max(0, totalAnnualCost - postTaxEcm);
  const salaryAfterCap = Math.max(0, annualSalaryNum - packageCapNum);
  const taxBefore = calculateAUSIncomeTax(salaryAfterCap);
  const taxableAfter = Math.max(0, annualSalaryNum - preTaxContribution);
  const taxAfter = calculateAUSIncomeTax(taxableAfter);
  const taxSaved = Math.max(0, taxBefore - taxAfter);
  const payPeriods = Number(inputs.paymentsPerYear || selectedFrequency || 12);
    const payLabel = paymentFrequencies.find(f => f.value === payPeriods)?.label || 'period';
    const outOfPocketPerInterval = (totalAnnualCost - taxSaved) / (payPeriods || 1);

  // Calculate BYO payment
  let byoPaymentPerPeriod: number = 0;
  let byoAnnualPayment: number = 0;
  if (comparisonTarget === 'self') {
    try {
      byoPaymentPerPeriod = calculateBYOPayment({
        financedAmount: comparisonFinanced,
        residualExclGst: comparisonResidualExcl,
        paymentsPerYear: inputs.paymentsPerYear || 12,
        leaseTermYears: inputs.leaseTermYears || 0,
        monthsDeferred: inputs.monthsDeferred,
        interestRate: comparisonInterestRate / 100,
      });

      byoAnnualPayment = byoPaymentPerPeriod * (inputs.paymentsPerYear || 12);
    } catch (e) {
      console.error('BYO calculation error:', e);
    }
  }

  // Calculate BYO tax savings
  let byoPreTaxContribution: number = 0;
  let byoTaxSaved: number = 0;
  if (comparisonTarget === 'self') {
    byoPreTaxContribution = Math.max(0, totalAnnualRunningCosts + byoAnnualPayment - postTaxEcm);
    const byoTaxableAfter = Math.max(0, annualSalaryNum - byoPreTaxContribution);
    const byoTaxAfter = calculateAUSIncomeTax(byoTaxableAfter);
    byoTaxSaved = Math.max(0, taxBefore - byoTaxAfter);
  }

  // Calculate Offset values
  let offsetAnnualFinanceCost: number = 0;
  let offsetAnnualRunningCosts: number = 0;
  let offsetTotalAnnualCost: number = 0;
  let offsetPreTaxContribution: number = 0;
  let offsetPostTaxEcm: number = 0;
  let offsetTaxSaved: number = 0;
  let offsetOutOfPocketAnnually: number = 0;
  let offsetResidual: number = 0;
  if (comparisonTarget === 'offset' || comparisonTarget === 'hisa') {
    offsetAnnualRunningCosts = normalRunningCostsPerPeriod * selectedFrequency;
    offsetOutOfPocketAnnually = totalAnnualCost - taxSaved;  // same as novated lease
    offsetTotalAnnualCost = offsetOutOfPocketAnnually;
    // For offset and HISA comparisons, there is no pre-tax contribution (not salary-sacrificed)
    offsetPreTaxContribution = 0;
    // Leave post-tax ECM as the annual cost for offset/HISA
    offsetPostTaxEcm = offsetOutOfPocketAnnually;
    const interestAmountRunningCosts = offsetAnnualRunningCosts * 0.3 * (comparisonInterestRate / 100); // assume average running cost balance is 30% of annual running costs
    // Calculate offset finance cost and periodic values
    offsetAnnualFinanceCost = offsetTotalAnnualCost - offsetAnnualRunningCosts;
    const paymentsPerYear = inputs.paymentsPerYear || 12;
    const offsetPeriodicPayment = offsetAnnualFinanceCost / paymentsPerYear;
    const offsetPeriodicRate = (comparisonInterestRate / 100) / paymentsPerYear;
    const n = (inputs.leaseTermYears || 0) * paymentsPerYear;
    const pv_payments = offsetPeriodicPayment * (Math.pow(1 + offsetPeriodicRate, n) - 1) / offsetPeriodicRate;
    offsetResidual = comparisonDriveaway * Math.pow(1 + offsetPeriodicRate, n) - pv_payments;

    if (comparisonTarget === 'offset') {
      offsetTaxSaved = interestAmountRunningCosts; // interest saved, not taxed
    } else if (comparisonTarget === 'hisa') {
      // Calculate interest that would have been earned in HISA on the driveaway amount,
      // accounting for periodic withdrawals (payments) and the final residual.
      const totalPayments = offsetPeriodicPayment * n;
      const driveawayInterestEarned = (offsetResidual + totalPayments - comparisonDriveaway) / (inputs.leaseTermYears || 0);
      const taxOnDriveawayInterest = calculateAUSIncomeTax(salaryAfterCap) - calculateAUSIncomeTax(salaryAfterCap - driveawayInterestEarned + interestAmountRunningCosts);
      offsetTaxSaved = taxOnDriveawayInterest ; // interestAmountRunningCosts -  after-tax interest earned on driveaway amount
    }
  }

  // Net cost over lease variables
  const novatedNetCostOverLease = (totalAnnualRunningCosts + annualPaymentAmount - taxSaved) * (inputs.leaseTermYears || 0) + (results.residualInclGst || 0);
  const byoNetCostOverLease = (totalAnnualRunningCosts + byoAnnualPayment - byoTaxSaved) * (inputs.leaseTermYears || 0) + comparisonResidualIncl;
  const offsetNetCostOverLease = (offsetTotalAnnualCost - offsetTaxSaved) * (inputs.leaseTermYears || 0) + offsetResidual;

  // Total excl running costs variables
  const novatedTotalExclRunning = novatedNetCostOverLease - (normalRunningCostsPerPeriod * selectedFrequency * (inputs.leaseTermYears || 0));
  const byoTotalExclRunning = byoNetCostOverLease - (normalRunningCostsPerPeriod * selectedFrequency * (inputs.leaseTermYears || 0));
  const offsetTotalExclRunning = offsetNetCostOverLease - (offsetAnnualRunningCosts * (inputs.leaseTermYears || 0));

  // Car loan comparison values (personal loan to buy the car)
  let carloanPaymentPerPeriod: number = 0;
  let carloanAnnualPayment: number = 0;
  let carloanAnnualRunningCosts: number = normalRunningCostsPerPeriod * selectedFrequency;
  let carloanTotalAnnualCost: number = 0;
  let carloanTaxSaved: number = 0;
  let carloanOutOfPocketAnnually: number = 0;
  let carloanResidual: number = comparisonResidualIncl;
  let carloanNetCostOverLease: number = 0;
  let carloanTotalExclRunning: number = 0;
  // Compute car loan payments using same BYO payment function (finance the financed amount from results)
  try {
    const financedForLoan = comparisonDriveaway;
    // compute periodic payment (reuse BYO payment calc) then treat it as a fixed payment
    carloanPaymentPerPeriod = (totalAnnualCost - taxSaved - carloanAnnualRunningCosts) / (inputs.paymentsPerYear || 12);
    const paymentsPerYear = inputs.paymentsPerYear || 12;
    carloanAnnualPayment = carloanPaymentPerPeriod * paymentsPerYear;
    carloanTotalAnnualCost = carloanAnnualRunningCosts + carloanAnnualPayment;
    carloanOutOfPocketAnnually = carloanTotalAnnualCost;

    // Treat the computed periodic payment as fixed and derive the residual similarly to the offset model
    const periodicRate = (comparisonInterestRate / 100) / paymentsPerYear;
    const n = (inputs.leaseTermYears || 0) * paymentsPerYear;
    let pv_payments = 0;
    if (periodicRate === 0) {
      pv_payments = carloanPaymentPerPeriod * n;
    } else {
      pv_payments = carloanPaymentPerPeriod * (Math.pow(1 + periodicRate, n) - 1) / periodicRate;
    }
    carloanResidual = financedForLoan * Math.pow(1 + periodicRate, n) - pv_payments;

    carloanNetCostOverLease = (carloanTotalAnnualCost - carloanTaxSaved) * (inputs.leaseTermYears || 0) + (carloanResidual || 0);
    carloanTotalExclRunning = carloanNetCostOverLease - (carloanAnnualRunningCosts * (inputs.leaseTermYears || 0));
  } catch (e) {
    // fallback to zeros if calculation fails
  }

  // Diff detection: compare provided inputs to consolidated comparison values
  const DIFF_THRESHOLD = 0.02; // 2%
  const calcDriveaway = comparisonDriveaway;
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
    <main className="app-main" style={{ paddingRight: '32px', position: 'relative' }}>
      {/* Top navigation with buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #e6e9ee',
      }}>
        <div>
          <h1 style={{ margin: '0 0 0 0' }}>Novated Lease Calculator</h1>
          <p style={{ margin: '0px 0 0 0', fontSize: '14px', color: '#666' }}>nl-calc.vercel.app</p>
        </div>
        
        {/* Top right buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleSaveQuote}
            title="Save this quote"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #1976d2',
              background: '#1976d2',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            💾 Save Quote
          </button>

          <button
            onClick={handleClearInputs}
            title="Clear all inputs"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ff9800',
              background: '#ff9800',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🗑️ Clear
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #666',
              background: isDarkMode ? '#333' : '#f5f5f5',
              color: isDarkMode ? '#fff' : '#333',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>

          <button
            onClick={handleShareCalculation}
            title="Share this calculation"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #2e7d32',
              background: '#2e7d32',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            📤 Share
          </button>

          <button
            onClick={handleExportAsImage}
            title="Export as image"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #7b1fa2',
              background: '#7b1fa2',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            🖼️ Export
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            title="Toggle menu"
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #666',
              background: showMenu ? '#1976d2' : '#f5f5f5',
              color: showMenu ? 'white' : '#333',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            ☰ Menu
          </button>
        </div>
      </div>

      {/* Sidebar menu with saved quotes */}
      {showMenu && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '350px',
          height: '100vh',
          background: isDarkMode ? '#1e1e1e' : '#ffffff',
          border: `1px solid #e6e9ee`,
          boxShadow: '-2px 0 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Menu header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e6e9ee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, color: 'var(--primary)' }}>Saved Quotes</h3>
            <button
              onClick={() => setShowMenu(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Quotes list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
          }}>
            {savedQuotes.length === 0 ? (
              <div style={{
                padding: '16px',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: '14px',
              }}>
                No saved quotes yet. Click "Save Quote" to get started!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedQuotes.map(quote => (
                  <div
                    key={quote.id}
                    style={{
                      padding: '12px',
                      background: isDarkMode ? '#2d2d2d' : '#f9f9f9',
                      border: '1px solid #e6e9ee',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = isDarkMode ? '#3d3d3d' : '#f0f0f0')}
                    onMouseLeave={e => (e.currentTarget.style.background = isDarkMode ? '#2d2d2d' : '#f9f9f9')}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          onClick={() => handleLoadQuote(quote)}
                          style={{
                            fontWeight: 600,
                            color: 'var(--primary)',
                            marginBottom: '4px',
                            wordBreak: 'break-word',
                          }}
                        >
                          {quote.name}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--muted)',
                          marginBottom: '6px',
                        }}>
                          {quote.createdAt}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text)',
                          lineHeight: '1.4',
                        }}>
                          <div>Driveaway: ${quote.inputs.driveawayCost?.toLocaleString()}</div>
                          <div>Term: {quote.inputs.leaseTermYears} years</div>
                          <div>FBT: ${quote.inputs.fbtBaseValue?.toLocaleString()}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteQuote(quote.id)}
                        title="Delete this quote"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid #b00020',
                          background: '#fff5f5',
                          color: '#b00020',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          marginTop: '4px',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay when menu is open */}
      {showMenu && (
        <div
          onClick={() => setShowMenu(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999,
          }}
        />
      )}

      <div className="grid grid-2" style={{ marginTop: '32px' }} id="calculator-content">
        {/* Input Section */}
        <div style={{ paddingBottom: '32px' }}>
          <h2>Lease Details</h2>
          <div className="card" style={{ background: getBgColor('#fbfbfb'), border: `1px solid ${getBorderColor('#d0d0d0')}`, padding: '16px' }}>
            <form style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {/* Main Inputs as Tight List with Left Labels */}
            <ul className="form-list" style={{ marginBottom: '12px' }}>
              <li className="form-row">
                <span className="form-label">NL Provider</span>
                <input
                  type="text"
                  list="nlProviderList"
                  value={nlProvider}
                  onChange={e => handleNlProviderChange(e.target.value)}
                  placeholder="Enter or select provider"
                  className="input--compact"
                  style={{ justifySelf: 'end' }}
                />
                <datalist id="nlProviderList">
                  {nlProviders.map(provider => (
                    <option key={provider} value={provider} />
                  ))}
                </datalist>
              </li>
              <li className="form-row">
                <span className="form-label">Vehicle Type</span>
                <select
                  value={isEv ? 'ev' : 'non'}
                  onChange={e => {
                    const v = e.target.value === 'ev';
                    setIsEv(v);
                    if (typeof window !== 'undefined') localStorage.setItem('novatedLeaseIsEv', String(v));
                  }}
                  className="input--compact align-end"
                >
                  <option value="non">Non-EV</option>
                  <option value="ev">EV</option>
                </select>
              </li>

              <li className="form-row">
                <span className="form-label">Lease Term (years)</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={inputs.leaseTermYears || ''}
                  onChange={e => handleInputChange('leaseTermYears', Number(e.target.value))}
                  className="input--compact"
                  style={{ justifySelf: 'end' }}
                />
              </li>

              <li className="form-row">
                <span className="form-label">FBT Base Value*</span>
                <input
                  type="number"
                  value={inputs.fbtBaseValue || ''}
                  onChange={e => handleInputChange('fbtBaseValue', Number(e.target.value))}
                  className="input--compact"
                  style={{ justifySelf: 'end' }}
                />
              </li>
              {fbtError && <li><div className="error-msg">{fbtError}</div></li>}

              <li>
                <div className="divider" />
              </li>

              {vehicleError && <li style={{ paddingLeft: 0 }}><div className="error-msg" style={{ textAlign: 'left' }}>{vehicleError}</div></li>}

              <li className="form-row">
                <span>Driveaway Cost</span>
                <input
                  placeholder="Driveaway Cost"
                  type="number"
                  value={inputs.driveawayCost || ''}
                  onChange={e => handleInputChange('driveawayCost', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="input--compact align-end"
                />
              </li>

              <li className="form-row">
                <span>Financed Amount</span>
                <input
                  placeholder="Financed Amount"
                  type="number"
                  value={inputs.financedAmountManual || ''}
                  onChange={e => handleInputChange('financedAmountManual', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="input--compact align-end"
                />
              </li>

              <li className="form-row">
                <span>Residual (excl GST)</span>
                <input
                  placeholder="Residual (excl GST)"
                  type="number"
                  value={inputs.residualExcl || ''}
                  onChange={e => handleInputChange('residualExcl', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="input--compact align-end"
                />
              </li>

              <li className="form-row">
                <span>Residual (incl GST)</span>
                <input
                  placeholder="Residual (incl GST)"
                  type="number"
                  value={inputs.residualIncl || ''}
                  onChange={e => handleInputChange('residualIncl', e.target.value === '' ? undefined : Number(e.target.value))}
                  className="input--compact align-end"
                />
              </li>
              <li>
                <div className="divider" />
              </li>
              <li className="form-row">
                <span className="form-label">Documentation Fee</span>
                <input
                  type="number"
                  value={inputs.documentationFee || ''}
                  onChange={e => handleInputChange('documentationFee', Number(e.target.value))}
                  className="input--compact align-end"
                />
              </li>
            </ul>
            </form>

              {/* Payment Group (includes advanced options) */}
                <ul className="form-list" style={{ gap: '8px' }}>
                  <li className="form-row">
                    <span className="form-label">Payment Amount</span>
                    <input
                      type="number"
                      value={inputs.paymentAmount || ''}
                      onChange={(e) => handleInputChange('paymentAmount', Number(e.target.value))}
                      className="input--compact"
                      style={{ justifySelf: 'end' }}
                    />
                  </li>
                  <li style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '10px', alignItems: 'center' }}>
                    <div>
                      <select
                        value={selectedFrequency}
                        onChange={handleFrequencyChange}
                        style={{
                          width: '100%',
                          height: '36px',
                          padding: '0 8px',
                          border: '1px solid #e6e9ee',
                          borderRadius: '4px',
                          background: 'transparent',
                          color: 'var(--text)',
                          fontWeight: 500,
                          fontSize: '14px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'end' }}>
                      <label className="form-label" style={{ margin: 0 }}>Includes GST</label>
                      <input
                        type="checkbox"
                        checked={runningCostsIncludeGst}
                        onChange={(e) => {
                          setRunningCostsIncludeGst(e.target.checked);
                          if (typeof window !== 'undefined') localStorage.setItem('novatedLeaseRunningCostsIncludeGst', String(e.target.checked));
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </div>
                  </li>
                </ul>

                <div style={{ marginTop: '8px' }}>
                  {(() => {
                    const paymentAmountNum = Number(inputs.paymentAmount);
                    const paymentsPerYearNum = Number(inputs.paymentsPerYear);
                    const show = Number.isFinite(paymentAmountNum) && paymentAmountNum > 0 && Number.isFinite(paymentsPerYearNum) && effectiveRate === null;
                    return show ? <div className="error-msg" style={{ marginTop: 8 }}>Payment amount too low or payment frequency incorrect</div> : null;
                  })()}
                  <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="btn--link">
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                  </button>
                </div>

                {showAdvanced && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ minWidth: 150 }}>
                          <div className="form-label">Months Deferred</div>
                        </div>
                        <div style={{ maxWidth: '120px' }}>
                          <input
                            type="number"
                            value={inputs.monthsDeferred || 0}
                            min="0"
                            max="12"
                            step="1"
                            onChange={(e) => handleInputChange('monthsDeferred', Number(e.target.value))}
                            className="input--compact"
                            style={{ fontSize: '14px' }}
                          />
                        </div>
                      </div>
                        )}
                  </div>
            {/* Income / Salary Section */}
                  <div className="card card--soft" style={{ marginTop: '12px', background: getBgColor('#fbfbfb'), border: `1px solid ${getBorderColor('#d0d0d0')}`, padding: '16px' }}>
                    <h4 style={{ margin: 0, color: 'var(--primary)', fontSize: '15px' }}>Income</h4>
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '150px auto', gap: '10px', alignItems: 'center' }}>
                <label className="form-label">Annual Salary</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={annualSalary ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    setAnnualSalary(v);
                    if (typeof window !== 'undefined') {
                      if (v === undefined) localStorage.removeItem('novatedLeaseAnnualSalary');
                      else localStorage.setItem('novatedLeaseAnnualSalary', String(v));
                    }
                  }}
                  className="input--compact align-end"
                />

                <label className="form-label">Salary Package Cap</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={packageCap ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    setPackageCap(v);
                    if (typeof window !== 'undefined') {
                      if (v === undefined) localStorage.removeItem('novatedLeasePackageCap');
                      else localStorage.setItem('novatedLeasePackageCap', String(v));
                    }
                  }}
                  className="input--compact align-end"
                />
              </div>
              
            </div>

            {/* Running Costs Section */}
            <div className="card card--accent" style={{ marginTop: '12px', background: getBgColor('#fbfbfb'), border: `1px solid ${getBorderColor('#d0d0d0')}`, padding: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Running Costs ({runningCostsFrequencyLabel}) - {runningCostsIncludeGst ? 'Inc. GST' : 'Ex. GST'}</h3>
              <ul className="form-list">
                <li className="form-row">
                  <span className="form-label">Management Fee</span>
                  <input type="number" min="0" step="1" value={runningCosts.managementFee ?? ''} onChange={e => handleRunningCostChange('managementFee', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                <li className="form-row">
                  <span className="form-label">Maintenance</span>
                  <input type="number" min="0" step="1" value={runningCosts.maintenance ?? ''} onChange={e => handleRunningCostChange('maintenance', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                <li className="form-row">
                  <span className="form-label">Tyres</span>
                  <input type="number" min="0" step="1" value={runningCosts.tyres ?? ''} onChange={e => handleRunningCostChange('tyres', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                <li className="form-row">
                  <span className="form-label">Rego</span>
                  <input type="number" min="0" step="1" value={runningCosts.rego ?? ''} onChange={e => handleRunningCostChange('rego', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                <li className="form-row">
                  <span className="form-label">Insurance</span>
                  <input type="number" min="0" step="1" value={runningCosts.insurance ?? ''} onChange={e => handleRunningCostChange('insurance', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                <li className="form-row">
                  <span className="form-label">Charging/Fuel</span>
                  <input type="number" min="0" step="1" value={runningCosts.chargingFuel ?? ''} onChange={e => handleRunningCostChange('chargingFuel', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                <li className="form-row">
                  <span className="form-label">Other</span>
                  <input type="number" min="0" step="1" value={runningCosts.other ?? ''} onChange={e => handleRunningCostChange('other', e.target.value === '' ? undefined : Number(e.target.value))} className="input--compact" style={{ justifySelf: 'end' }} />
                </li>
                {!isEv && (
                  <li style={{ display: 'grid', gridTemplateColumns: '150px auto', alignItems: 'center', gap: '10px' }}>
                    <span style={{ minWidth: 150, fontWeight: 500, color: getTextColor('#222'), fontSize: '15px' }}>Employee contribution gst</span>
                    <div style={{ justifySelf: 'end', color: getTextColor('#222') }}>{formatCurrency(ecGstPerPeriod)}</div>
                  </li>
                )}
              </ul>
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ minWidth: 150, fontWeight: 600, color: getTextColor('#222'), fontSize: '15px' }}>Total Running Costs </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(totalRunningCostsPerPeriod)} / {runningCostsFrequencyLabel}</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${getBorderColor('#ddd')}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ minWidth: 150, fontWeight: 700, color: getTextColor('#222'), fontSize: '16px' }}>Total Lease</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: getTextColor('#222'), fontSize: '16px' }}>{formatCurrency(totalRunningCostsPerPeriod + adjustedPaymentAmount)} / {runningCostsFrequencyLabel}</div>
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${getBorderColor('#ddd')}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ minWidth: 150, fontWeight: 700, color: '#1976d2', fontSize: '15px' }}>Out of pocket</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#1976d2' }}>{formatCurrency(outOfPocketPerInterval || 0)} / {payLabel}</div>
                </div>
              </div>
            </div>
        </div>

        {/* Results Section */}
        <div style={{ paddingBottom: '32px' }}>
          <h2>Lease Calculation</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Calculation Details and Residual Grouped Section */}
            {/* Financed Amount Section */}
            <div style={{ marginBottom: '10px' }}>
              <details style={{ marginBottom: '4px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', padding: '6px 0' }}>Show Financed Amount Breakdown</summary>
                <div style={{ padding: '10px', backgroundColor: getBgColor('#f9f9f9'), borderRadius: '8px', border: `1px solid ${getBorderColor('#eee')}`, marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingBottom: '6px', borderBottom: `1px solid ${getBorderColor('#ddd')}` }}>
                    <span>Driveaway Cost</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '500' }}>{formatCurrency(comparisonDriveaway)}</div>
                        {typeof inputs.driveawayCost === 'number' && inputs.driveawayCost > 0 ? (
                          <div style={{ color: driveawayDiffPct > DIFF_THRESHOLD ? '#b00020' : getTextColor('#666'), fontSize: '12px' }}>
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
              <div className="card card--info" style={{ display: 'flex', flexDirection: 'column', gap: '6px'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Financed Amount</span>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1976d2' }}>{formatCurrency(results.financedAmount)}</span>
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
              <details style={{ marginBottom: '16px', overflow: 'visible', position: 'relative', zIndex: 1 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', padding: '6px 0' }}>Show Residual Breakdown</summary>
                <div style={{ padding: '10px', backgroundColor: getBgColor('#f5f5f5'), borderRadius: '8px', border: `1px solid ${getBorderColor('#ddd')}`, marginTop: '6px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingBottom: '6px', borderBottom: `1px solid ${getBorderColor('#ddd')}` }}>
                    <span>Residual %</span>
                    <span style={{ fontWeight: '500' }}>{(results.residualPercent * 100).toFixed(2)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Residual Value (excl GST)</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '500' }}>{formatCurrency(results.residualExclGst)}</div>
                      {typeof inputs.residualExcl === 'number' && inputs.residualExcl > 0 ? (
                        <div style={{ color: getTextColor('#666'), fontSize: '12px' }}>from quote {formatCurrency(inputs.residualExcl)}</div>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: getTextColor('#999'), marginBottom: '8px', paddingBottom: '8px', borderBottom: `1px solid ${getBorderColor('#ddd')}` }}>
                    Calculated from financed amount less fees
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Add: GST (10%)</span>
                    <span style={{ fontWeight: '500' }}>+{formatCurrency(results.residualInclGst - results.residualExclGst)}</span>
                  </div>
                </div>
              </details>
              <div className="card card--info" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>Residual Value (incl GST)</span>
                  <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#1976d2' }}>{formatCurrency(results.residualInclGst)}</span>
                </div>
                {typeof inputs.residualIncl === 'number' && inputs.residualIncl > 0 ? (
                  <div style={{ textAlign: 'right', color: residualInclDiffPct > DIFF_THRESHOLD ? '#b00020' : getTextColor('#666'), fontSize: '13px' }}>
                    from quote {formatCurrency(inputs.residualIncl)}{residualInclDiffPct > DIFF_THRESHOLD ? ` — ${(residualInclDiffPct*100).toFixed(1)}% diff` : ''}
                  </div>
                ) : null}
              </div>
            </div>
            {/* Effective Interest Rate Result */}
            {(() => {
              const pct = effectiveRate !== null ? effectiveRate * 100 : null;
              const paymentAmountNum = Number(inputs.paymentAmount);
              const paymentsPerYearNum = Number(inputs.paymentsPerYear);
              const showPaymentError = Number.isFinite(paymentAmountNum) && paymentAmountNum > 0 && Number.isFinite(paymentsPerYearNum) && effectiveRate === null;
              let status = '';
              const containerBase: any = { marginTop: '12px', marginBottom: '12px', padding: '8px 20px', borderRadius: '8px', minHeight: '180px' };
              let containerStyle = { ...containerBase, border: '2px solid #ffb74d', background: '#fffdf2' };
              let pctColor = '#1976d2';

              if (pct === null) {
                status = 'N/A';
                pctColor = '#666';
                containerStyle = { ...containerBase, border: '2px solid #bdbdbd', background: getBgColor('#fbfbfb') };
              } else if (pct < 10) {
                status = 'Competitive';
                pctColor = '#2e7d32';
                containerStyle = { ...containerBase, border: '2px solid #2e7d32', background: getBgColor('#f7fbf7') };
              } else if (pct < 14) {
                status = 'Elevated';
                pctColor = '#ff8f00';
                containerStyle = { ...containerBase, border: '2px solid #ffb300', background: getBgColor('#fffdf2') };
              } else {
                status = 'High';
                pctColor = '#c62828';
                containerStyle = { ...containerBase, border: '2px solid #c62828', background: getBgColor('#fff5f5') };
              }

              return (
                <div className="card" style={containerStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '18px', marginTop: '12px' }}>Effective Interest Rate</div>
                      {showPaymentError ? (
                        <div style={{ marginTop: 12 }}>
                          <div className="error-msg">Payment amount too low or payment frequency incorrect</div>
                        </div>
                      ) : null}
                      <div className="small" style={{ marginTop: '12px', color: getTextColor('#666') }}>
                        Calculated based on values entered
                      </div>
                      {baseRate !== null && (
                        <div className="small" style={{ marginTop: '10px', marginBottom: '12px' , color: getTextColor('#666') }}>
                          <b>Base Rate:</b> {(baseRate * 100).toFixed(2)}% (fees included in finance amount)
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '48px', fontWeight: '800', color: pctColor, textAlign: 'right', lineHeight: '1' }}>
                        {pct !== null ? pct.toFixed(2) + '%' : 'N/A'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                        <div style={{ fontWeight: 700, color: pctColor, fontSize: '14px' }}>{status}</div>
                        <details style={{ fontSize: '12px' }}>
                          <summary style={{ listStyle: 'none', cursor: 'pointer', color: getTextColor('#666'), padding: 0, margin: 0 }}>ⓘ</summary>
                          <div style={{ padding: '8px', background: getBgColor('#ffffff'), border: `1px solid ${getBorderColor('#ddd')}`, borderRadius: '4px', color: getTextColor('#333') }}>
                            <div><b>Competitive:</b> &lt; 10%</div>
                            <div><b>Elevated:</b> 10%–13.99%</div>
                            <div><b>High:</b> ≥ 14%</div>
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                  {pct !== null && (
                    <details style={{ marginTop: '16px', cursor: 'pointer' }}>
                      <summary style={{ fontWeight: 600, color: pctColor, fontSize: '14px', cursor: 'pointer' }}>
                        {status === 'High' && '💡 Your rate is high - here\'s how to reduce it'}
                        {status === 'Elevated' && '💡 Your rate is elevated - consider negotiating'}
                        {status === 'Competitive' && '✨ Your rate is competitive, but you can still negotiate'}
                      </summary>
                      <div style={{ marginTop: '12px', padding: '12px', background: getBgColor('#f8f9fa', '#252525'), borderRadius: '6px', fontSize: '13px', lineHeight: '1.6', color: getTextColor('#333') }}>
                        {status === 'High' && (
                          <>
                            <p style={{ margin: '0 0 8px 0' }}><b>A good effective rate for a novated lease is around 8%.</b> Here's what you could be paying:</p>
                            <div style={{ margin: '12px 0', padding: '8px', background: getBgColor('#ffffff', '#1a1a1a'), border: `1px solid ${getBorderColor('#ddd')}`, borderRadius: '4px' }}>
                              {(() => {
                                const frequencyPayment = calculatePaymentAt8Percent();
                                if (frequencyPayment !== null) {
                                  const paymentsPerYear = inputs.paymentsPerYear || 12;
                                  return (
                                    <div>
                                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#2e7d32' }}>
                                        {formatCurrency(frequencyPayment)} per {paymentFrequencies.find(f => f.value === paymentsPerYear)?.label || 'period'}
                                        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: '12px', color: getTextColor('#777') }}>— vs your current {formatCurrency(inputs.paymentAmount || 0)} per period</span>
                                        {(runningCostsIncludeGst) && (
                                          <span style={{ marginLeft: 8, fontStyle: 'italic', fontSize: '12px', color: getTextColor('#777') }}>(includes GST)</span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                }
                                return <p style={{ margin: 0, color: getTextColor('#999') }}>Enter loan details to calculate</p>;
                              })()}
                            </div>
                            <p style={{ margin: '12px 0 8px 0' }}>Ways to get to 8% or lower:</p>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                              <li>Negotiate with your novated lease provider for a lower interest rate</li>
                              <li>Get quotes from 2-3 competitive providers to use as leverage —
                                <a href="https://www1.my.commbank.com.au/netbank/container/ESD/AssetFinance.Quote/ContainerLaunch?entry=CB&product=nl" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>Commonwealth</a>
                                <a href="https://www.toyotafleetmanagement.com.au/novated-lease/calculator" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>Toyota Fleet</a>
                                <a href="https://millarx.com.au/novated-leasing" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>Millarx</a>
                              </li>
                              <li>Check if your employer has preferred provider agreements with better rates</li>
                              <li>Review all fees - some can be negotiated or removed</li>
                            </ul>
                          </>
                        )}
                        {status === 'Elevated' && (
                          <>
                            <p style={{ margin: '0 0 8px 0' }}><b>A good effective rate for a novated lease is around 8%.</b> Here's what you could be paying:</p>
                            <div style={{ margin: '12px 0', padding: '8px', background: getBgColor('#ffffff', '#1a1a1a'), border: `1px solid ${getBorderColor('#ddd')}`, borderRadius: '4px' }}>
                              {(() => {
                                const frequencyPayment = calculatePaymentAt8Percent();
                                if (frequencyPayment !== null) {
                                  const paymentsPerYear = inputs.paymentsPerYear || 12;
                                  return (
                                    <div>
                                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#2e7d32' }}>
                                        {formatCurrency(frequencyPayment)} per {paymentFrequencies.find(f => f.value === paymentsPerYear)?.label || 'period'}
                                        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: '12px', color: getTextColor('#777') }}>— vs your current {formatCurrency(inputs.paymentAmount || 0)} per period</span>
                                        {(runningCostsIncludeGst) && (
                                          <span style={{ marginLeft: 8, fontStyle: 'italic', fontSize: '12px', color: getTextColor('#777') }}>(includes GST)</span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                }
                                return <p style={{ margin: 0, color: getTextColor('#999') }}>Enter loan details to calculate</p>;
                              })()}
                            </div>
                            <p style={{ margin: '12px 0 8px 0' }}>Ways to get closer to 8%:</p>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                              <li>Negotiate with your current provider</li>
                              <li>Get quotes from competitve providers —
                                <a href="https://www1.my.commbank.com.au/netbank/container/ESD/AssetFinance.Quote/ContainerLaunch?entry=CB&product=nl" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6 }}>Commonwealth</a>
                                <a href="https://www.toyotafleetmanagement.com.au/novated-lease/calculator" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>Toyota Fleet</a>
                                <a href="https://millarx.com.au/novated-leasing" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>Millarx</a>
                              </li>
                              <li>Review all fees - ask which ones can be removed</li>
                              <li>Consider a larger upfront payment</li>
                            </ul>
                          </>
                        )}
                        {status === 'Competitive' && (
                          <>
                            <p style={{ margin: '0 0 8px 0' }}><b>A good effective rate for a novated lease is around 8%.</b> You're already competitive:</p>
                            <div style={{ margin: '12px 0', padding: '8px', background: getBgColor('#ffffff', '#1a1a1a'), border: `1px solid ${getBorderColor('#ddd')}`, borderRadius: '4px' }}>
                              {(() => {
                                const frequencyPayment = calculatePaymentAt8Percent();
                                if (frequencyPayment !== null) {
                                  const paymentsPerYear = inputs.paymentsPerYear || 12;
                                  return (
                                    <div>
                                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#2e7d32' }}>
                                        {formatCurrency(frequencyPayment)} per {paymentFrequencies.find(f => f.value === paymentsPerYear)?.label || 'period'}
                                        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: '12px', color: getTextColor('#777') }}>— vs your current {formatCurrency(inputs.paymentAmount || 0)} per period</span>
                                        {(runningCostsIncludeGst) && (
                                          <span style={{ marginLeft: 8, fontStyle: 'italic', fontSize: '12px', color: getTextColor('#777') }}>(includes GST)</span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                }
                                return <p style={{ margin: 0, color: getTextColor('#999') }}>Enter loan details to calculate</p>;
                              })()}
                            </div>
                            <p style={{ margin: '12px 0 8px 0' }}>Still room to negotiate:</p>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                              <li>Even competitive rates can be negotiated - it never hurts to ask</li>
                              <li>Mention you're comparing multiple providers</li>
                              <li>Review all fees to ensure you're getting the best overall deal</li>
                            </ul>
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })()}

            {/* Offset Account Comparison Section (moved to right column) */}
            <div className="card" style={{ marginTop: '12px', padding: '16px', border: '2px solid #1976d2', background: getBgColor('#fcfcfd') }}>
              
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#1976d2', fontSize: '20px', fontWeight: 700 }}>Novated Lease Comparison</h3>
                <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
                  <button
                    onClick={() => {
                      setGstSavingsPassedOn(false);
                      if (typeof window !== 'undefined') localStorage.setItem('novatedLeaseGstSavingsPassedOn', 'false');
                    }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: `1px solid ${getBorderColor('#d0d0d0')}`,
                      borderRadius: '4px',
                      background: !gstSavingsPassedOn ? '#1976d2' : getBgColor('#fff'),
                      color: !gstSavingsPassedOn ? '#fff' : '#1976d2',
                      cursor: 'pointer',
                    }}
                  >
                    GST Included
                  </button>
                  <button
                    onClick={() => {
                      setGstSavingsPassedOn(true);
                      if (typeof window !== 'undefined') localStorage.setItem('novatedLeaseGstSavingsPassedOn', 'true');
                    }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      border: `1px solid ${getBorderColor('#d0d0d0')}`,
                      borderRadius: '4px',
                      background: gstSavingsPassedOn ? '#1976d2' : getBgColor('#fff'),
                      color: gstSavingsPassedOn ? '#fff' : '#1976d2',
                      cursor: 'pointer',
                    }}
                  >
                    GST Refunded
                  </button>
                </div>
              </div>
              
              <table className="comparison-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', tableLayout: 'fixed', textAlign: 'right' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontWeight: 700, color: '#1976d2', padding: '8px 0' }}>
                      <span>Details</span>
                    </th>
                    <th style={{ textAlign: 'left', fontWeight: 700, color: '#1976d2', padding: '1px 0', width: '100px'  }}>Novated<br/>Lease</th>
                    <th style={{ textAlign: 'center', padding: '1px 0', width: '100px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={comparisonTarget}
                          onChange={e => {
                            const newTarget = e.target.value;
                            setComparisonTarget(newTarget);
                            if (typeof window !== 'undefined') localStorage.setItem('novatedLeaseComparisonTarget', newTarget);
                            const saved = getSavedComparisonRate(newTarget);
                            setComparisonInterestRate(saved);
                          }}
                          style={{
                            width: '90%',
                            height: '24px',
                            padding: '0 8px',
                            lineHeight: '20px',
                            border: '1px solid #e6e9ee',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#1976d2',
                            fontWeight: 700,
                            fontSize: '14px',
                            appearance: 'auto',
                          }}
                        >
                          <option value="offset">Offset</option>
                          <option value="carloan">Loan</option>
                          <option value="hisa">HISA</option>
                          <option value="self">BYO</option>
                        </select>
                        <div style={{ display: 'flex', justifyContent: 'right', gap: '6px', alignItems: 'center', width: '100%' }}>
                          <input
                            type="number"
                            step="0.01"
                            value={comparisonInterestRate === 0 ? '' : comparisonInterestRate}
                            onChange={e => {
                              const v = e.target.value === '' ? 0 : Number(e.target.value);
                              setComparisonInterestRate(v);
                              if (typeof window !== 'undefined') {
                                const key = `novatedLeaseComparisonInterestRate_${comparisonTarget}`;
                                localStorage.setItem(key, String(v));
                              }
                            }}
                            placeholder="0.00"
                            aria-label="Comparison interest rate"
                            style={{ width: '70%', height: '20px', padding: '4px', borderRadius: '4px', textAlign: 'right', fontSize: '14px', fontWeight: 700, color: '#1976d2' }}
                          />
                          <span style={{ color: '#1976d2', fontWeight: 700, fontSize: '14px' }}>%</span>
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Annual finance cost</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(annualPaymentAmount)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(byoAnnualPayment, offsetAnnualFinanceCost, null, carloanAnnualPayment)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Annual running costs</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(totalAnnualRunningCosts)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(totalAnnualRunningCosts, offsetAnnualRunningCosts, null, carloanAnnualRunningCosts)}</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #ddd', borderBottom: '1px solid #ddd' }}>
                    <td style={{ fontWeight: 700, padding: '8px 0', textAlign: 'left' }}>Total Annual cost</td>
                    <td className="center-col" style={{ padding: '8px 0', fontWeight: 700 }}>{formatCurrency(totalAnnualRunningCosts+annualPaymentAmount)}</td>
                    <td className="center-col" style={{ padding: '8px 0', fontWeight: 700, color: '#222' }}>{getComparisonValue(totalAnnualRunningCosts + byoAnnualPayment, offsetTotalAnnualCost, null, carloanTotalAnnualCost)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Pre-tax contribution</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(preTaxContribution)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(Math.max(0, totalAnnualRunningCosts + byoAnnualPayment - postTaxEcm), offsetPreTaxContribution, null, 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Post-tax Contribution</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(postTaxEcm)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(postTaxEcm, offsetPostTaxEcm, null, 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Tax savings</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(taxSaved)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>
                      {comparisonTarget === 'offset' ? (
                        <>
                          {formatCurrency(offsetTaxSaved)}
                          <span title="Interest saved on running costs (30% avg balance)" onClick={() => alert('Interest saved on running costs (30% avg balance)')} style={{ cursor: 'help', fontSize: '12px', color: '#666', marginLeft: '4px', userSelect: 'none' }}>ⓘ</span>
                        </>
                      ) : comparisonTarget === 'hisa' ? (
                        <>
                          {formatCurrency(offsetTaxSaved)}
                          <span title="Tax saved on previous HISA interest earnings (30% avg balance)" onClick={() => alert('Tax on HISA interest earnings (30% avg balance)')} style={{ cursor: 'help', fontSize: '12px', color: '#666', marginLeft: '4px', userSelect: 'none' }}>ⓘ</span>
                        </>
                      ) : getComparisonValue(byoTaxSaved, offsetTaxSaved, null, carloanTaxSaved)}
                    </td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #ddd' }}>
                    <td style={{ fontWeight: 700, padding: '8px 0', textAlign: 'left' }}>Out of pocket annually</td>
                    <td className="center-col" style={{ padding: '8px 0', fontWeight: 700 }}>{formatCurrency((totalAnnualRunningCosts + annualPaymentAmount) - taxSaved)}</td>
                    <td className="center-col" style={{ padding: '8px 0', fontWeight: 700, color: '#222' }}>{getComparisonValue(totalAnnualRunningCosts + byoAnnualPayment - byoTaxSaved, offsetOutOfPocketAnnually, null, carloanOutOfPocketAnnually)}</td>
                  </tr>
                  <tr style={{ borderTop: '2px solid #1976d2' }}>
                    <td colSpan={3} style={{ fontWeight: 700, padding: '12px 0 8px 0', color: '#1976d2', fontSize: '16px', textAlign: 'left' }}>
                      Costs over {inputs.leaseTermYears || 0} year lease
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Total finance cost</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(annualPaymentAmount * (inputs.leaseTermYears || 0))}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(byoAnnualPayment * (inputs.leaseTermYears || 0), offsetAnnualFinanceCost * (inputs.leaseTermYears || 0), null, carloanAnnualPayment * (inputs.leaseTermYears || 0))}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Total running costs</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(totalAnnualRunningCosts * (inputs.leaseTermYears || 0))}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(totalAnnualRunningCosts * (inputs.leaseTermYears || 0), offsetAnnualRunningCosts * (inputs.leaseTermYears || 0), null, carloanAnnualRunningCosts * (inputs.leaseTermYears || 0))}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Total tax savings</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(taxSaved * (inputs.leaseTermYears || 0))}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(byoTaxSaved * (inputs.leaseTermYears || 0), offsetTaxSaved * (inputs.leaseTermYears || 0), null, carloanTaxSaved * (inputs.leaseTermYears || 0))}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Residual value</td>
                    <td className="center-col" style={{ padding: '8px 0' }}>{formatCurrency(comparisonResidualIncl)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222' }}>{getComparisonValue(comparisonResidualIncl, offsetResidual, null, carloanResidual)}</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #ddd' }}>
                    <td style={{ fontWeight: 700, padding: '8px 0', textAlign: 'left' }}>Net cost over lease</td>
                    <td className="center-col" style={{ padding: '8px 0', fontWeight: 700 }}>{formatCurrency(novatedNetCostOverLease)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222', fontWeight: 700 }}>{getComparisonValue(byoNetCostOverLease, offsetNetCostOverLease, null, carloanNetCostOverLease)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Total excl running costs</td>
                    <td className="center-col" style={{ padding: '8px 0', fontWeight: 700, fontSize: '16px' }}>{formatCurrency(novatedTotalExclRunning)}</td>
                    <td className="center-col" style={{ padding: '8px 0', color: '#222', fontWeight: 700, fontSize: '16px' }}>{getComparisonValue(byoTotalExclRunning, offsetTotalExclRunning, null, carloanTotalExclRunning)}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 500, padding: '8px 0', textAlign: 'left' }}>Difference to driveaway price</td>
                    <td className="center-col" style={{ 
                      padding: '8px 0', 
                      fontWeight: 700, 
                      fontSize: '16px',
                      color: (novatedTotalExclRunning - comparisonDriveaway) < 0 ? '#2e7d32' : '#c62828'
                    }}>
                      {formatCurrency(novatedTotalExclRunning - comparisonDriveaway)}
                    </td>
                    <td className="center-col" style={{ padding: '8px 0', color: comparisonTarget === 'self' ? '#222' : '#888', fontWeight: 700, fontSize: '16px' }}>
                      {comparisonTarget === 'self' ? (() => {
                        const diff = byoTotalExclRunning - comparisonDriveaway;
                        return (
                          <span style={{ color: diff < 0 ? '#2e7d32' : '#c62828' }}>
                            {formatCurrency(diff)}
                          </span>
                        );
                      })() : comparisonTarget === 'offset' ? (() => {
                        const diff = offsetTotalExclRunning - comparisonDriveaway;
                        return (
                          <span style={{ color: diff < 0 ? '#2e7d32' : '#c62828' }}>
                            {formatCurrency(diff)}
                          </span>
                        );
                      })() : comparisonTarget === 'hisa' ? (() => {
                        const diff = offsetTotalExclRunning - comparisonDriveaway;
                        return (
                          <span style={{ color: diff < 0 ? '#2e7d32' : '#c62828' }}>
                            {formatCurrency(diff)}
                          </span>
                        );
                      })() : comparisonTarget === 'carloan' ? (() => {
                        const diff = carloanTotalExclRunning - comparisonDriveaway;
                        return (
                          <span style={{ color: diff < 0 ? '#2e7d32' : '#c62828' }}>
                            {formatCurrency(diff)}
                          </span>
                        );
                      })() : getComparisonValue(null)}
                    </td>
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