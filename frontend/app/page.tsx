'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { calculatePrice, calculatePriceBySku, PricingData, CalculationResult } from '../lib/pricing';
import { fetchPricingData } from '../lib/rules_storage';

export default function Home() {
  const [cost, setCost] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [itemType, setItemType] = useState<string>(''); 
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);

  useEffect(() => {
    const load = async () => {
        try {
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
            const data = await fetchPricingData(basePath);
            setPricingData(data);
        } catch (e) {
            console.error("Failed to load data", e);
        }
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    if (!itemType) {
        setError('Please select an Item Type');
        setLoading(false);
        return;
    }

    if (!pricingData) {
        setError('Pricing data is still loading... please wait.');
        setLoading(false);
        return;
    }

    try {
      // Re-merge rules just in case they changed in another tab (though requires refresh usually)
      // Ideally we rely on initial load unless we listen to storage events. 
      // For now, let's use the state.
      
      let res: CalculationResult;

      if (sku.trim()) {
        res = calculatePriceBySku(sku.trim(), pricingData, itemType);
      } else if (cost) {
        res = calculatePrice(parseFloat(cost), pricingData, itemType);
      } else {
        throw new Error('Please enter a Cost or SKU');
      }

      setResult(res);
    } catch (err: any) {
      setError(err.message);
      setResult(null); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 bg-gray-900 text-gray-100 w-full">
      <div className="w-full max-w-sm mb-8 flex justify-between items-center">
         <h1 className="text-4xl font-bold text-white">Pottery Calculator</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="sku">
            SKU
          </label>
          <input
            id="sku"
            type="text"
            value={sku}
            onChange={(e) => {
                setSku(e.target.value);
                if(e.target.value) setCost(''); // Clear cost if SKU is entered
            }}
            className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:border-blue-500"
            placeholder="Enter SKU (e.g. DB38110)"
          />
        </div>

        <div className="flex items-center justify-between mb-4">
            <hr className="w-full border-gray-600" />
            <span className="px-2 text-gray-500 text-sm">OR</span>
            <hr className="w-full border-gray-600" />
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="cost">
            Cost ($)
          </label>
          <input
            id="cost"
            type="number"
            step="0.01"
            value={cost}
            onChange={(e) => {
                setCost(e.target.value);
                if(e.target.value) setSku(''); // Clear SKU if cost is entered
            }}
            className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:border-blue-500"
            placeholder="Enter cost (e.g. 2.00)"
          />
        </div>

        <div className="mb-6">
            <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="itemType">
                Item Type
            </label>
            <select
                id="itemType"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="shadow appearance-none border border-gray-600 rounded w-full py-2 px-3 bg-gray-700 text-white leading-tight focus:outline-none focus:border-blue-500"
            >
                <option value="" disabled>Select Item Type</option>
                <option value="cups/mugs">Cups/Mugs</option>
                <option value="figurines">Figurines</option>
                <option value="small-figurines">Small Figurines (Tiny Tots)</option>
                <option value="plates/bowls">Plates/Bowls</option>
                <option value="vases">Vases</option>
                <option value="other">Other</option>
            </select>
        </div>
        
        <button
          type="submit"
          disabled={loading || !pricingData}
          className={`font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full transition-colors ${
              (loading || !pricingData)
                ? 'bg-blue-800 text-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {loading ? 'Calculating...' : (!pricingData ? 'Loading Data...' : 'Calculate')}
        </button>
      </form>

      {error && <p className="text-red-400 mt-4">{error}</p>}

      {result && (
        <div className="mt-8 p-6 bg-gray-800 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
          <div className="text-center mb-4">
             {result.productName && (
                 <h2 className="text-xl font-bold text-blue-300 mb-2">{result.productName}</h2>
             )}
             <p className="text-gray-400 mb-1">Base Multiplier: <span className="font-bold text-white">{result.multiplier}</span></p>
             <p className="text-gray-400">Base Price: <span className="font-bold text-white">${result.basePrice}</span></p>
          </div>
          
          {result.appliedRules && result.appliedRules.length > 0 && (
             <div className="mb-4 border-t border-b border-gray-700 py-2">
                <p className="text-sm text-gray-500 mb-2">Applied Rules:</p>
                {result.appliedRules.map((rule, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-300">{rule.name} {rule.label}</span>
                        <span className={`font-medium ${rule.addedAmount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {rule.addedAmount < 0 ? '-' : '+'}${Math.abs(rule.addedAmount).toFixed(2)}
                        </span>
                    </div>
                ))}
             </div>
          )}

          <div className="text-center">
            <div className="text-sm text-gray-500 uppercase tracking-wide font-semibold mt-2">Final Price</div>
            <div className="text-3xl font-bold text-green-400">
                ${result.finalPrice.toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
