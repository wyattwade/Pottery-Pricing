'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredRules, saveRules, fetchPricingData } from '../../lib/rules_storage';
import { Rule, Product } from '../../lib/pricing';

export default function ConfigPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const data = await fetchPricingData(basePath);
        setRules(data.rules);
        setProducts(data.products);
    } catch (e) {
        console.error("Failed to load rules", e);
    } finally {
        setLoading(false);
    }
  };

  const updateRules = (newRules: Rule[]) => {
      setRules(newRules);
      saveRules(newRules);
  };

  const toggleActive = (rule: Rule) => {
    const newRules = rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r);
    updateRules(newRules);
  };

  const startEditing = (rule: Rule) => {
    setEditingId(rule.id);
    setEditValue(rule.value.toString());
  };

  const saveEdit = (id: number) => {
    const val = parseFloat(editValue);
    if (isNaN(val)) return;

    const newRules = rules.map(r => r.id === id ? { ...r, value: val } : r);
    updateRules(newRules);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const formatValue = (rule: Rule) => {
      switch (rule.type) {
          case 'PERCENTAGE_ADD':
              return `+${rule.value}%`;
          case 'ROUND_NEAREST':
              return `Nearest $${rule.value}`;
          case 'MIN_FIXED':
              return `Minimum $${rule.value}`;
          case 'FIXED_DEDUCTION':
              return `-$${rule.value}`;
          case 'ADJUST_MULTIPLE_10':
              return `-$${rule.value} if mult of 10`;
          case 'MIN_FIXED_MUG':
              return `Mug Min $${rule.value}`;
      case 'MIN_FIXED_PLATE':
              return `Plate Min $${rule.value}`;
      case 'MAX_MARKUP_CAP':
              return `Max Markup $${rule.value}`;
      default:
              return `${rule.value}`;
      }
  };

  /* 
   * Calculate SKU counts per vendor
   * The Product interface now supports 'vendor' property which comes from data.json
   */
  const gareSkus = products.filter(p => (p.vendor || p.vendorName)?.toLowerCase() === 'gare').length;
  const chesapeakeSkus = products.filter(p => (p.vendor || p.vendorName)?.toLowerCase() === 'chesapeake').length;
  const bisqueImportsSkus = products.filter(p => (p.vendor || p.vendorName)?.toLowerCase() === 'bisque imports').length;

  const ruleDescriptions: Record<string, string> = {
    'addedMultiplier': "Adds a percentage markup to the base price.",
    'roundToDollar': "Rounds the price to the nearest dollar amount.",
    'maxMarkupAmount': "Maximum dollar amount allowed above cost (Markup Cap).",
    'roundMultiple10Minus1': "Subtracts $1 if the final rounded price is a multiple of $10 (e.g., $20 -> $19).",
    'mugMinPrice': "Enforces a minimum price for items identified as Mugs.",
    'smallFigurineDiscount': "Applies a discount to small figurines.",
    'smallFigurineMinPrice': "Enforces a minimum price after discount for small figurines.",
    'minPriceRule': "Ensures no item is sold below this price.",
    'plateMinPrice': "Enforces a minimum price for items of type 'Plate'."
  };

  const getRuleDescription = (ruleName: string) => {
      // Handle generic names or exact matches
      if (ruleDescriptions[ruleName]) return ruleDescriptions[ruleName];
      if (ruleName === 'minPriceRule') return ruleDescriptions['minPriceRule']; 
      // Fallback for known types if name varies? 
      // For now, rely on name matching.
      return "No description available.";
  };

  return (
    <div className="flex flex-1 flex-col items-center p-8 bg-gray-900 text-gray-100 w-full">
      <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white">Configuration</h1>
      </div>

      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 mb-8">
         <h2 className="text-2xl font-bold mb-4 text-gray-200">SKU Information</h2>
         {loading ? (
             <p>Loading counts...</p>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm mb-1">Gare SKUs</p>
                    <p className="text-3xl font-bold text-white">{gareSkus}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm mb-1">Chesapeake SKUs</p>
                    <p className="text-3xl font-bold text-white">{chesapeakeSkus}</p>
                </div>
                 <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-gray-400 text-sm mb-1">Bisque Imports SKUs</p>
                    <p className="text-3xl font-bold text-white">{bisqueImportsSkus}</p>
                </div>
             </div>
         )}
      </div>

      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 mb-8">
        <h2 className="text-2xl font-bold mb-2 text-gray-200">Pricing Rules</h2>
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-6">
            <p className="text-yellow-200 text-sm">
                <strong>Read-Only:</strong> Configuration is currently managed directly in the codebase to ensure consistency across all devices.
            </p>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm">
                    <div
                      className={`inline-block px-2 py-1 leading-none rounded-full font-semibold ${
                        rule.isActive
                          ? 'bg-green-900 text-green-200'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm font-medium text-gray-200">
                    <div className="flex items-center">
                        <span>{rule.name}</span>
                        <div className="group relative ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-xs text-gray-100 rounded shadow-lg border border-gray-700 hidden group-hover:block z-10 text-center">
                                {getRuleDescription(rule.name)}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
                            </div>
                        </div>
                    </div>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm text-gray-200">
                    {editingId === rule.id ? (
                      <input
                        type="number"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-20 px-2 py-1 text-black rounded border border-gray-500 focus:outline-none focus:border-blue-500"
                        autoFocus
                      />
                    ) : (
                      formatValue(rule)
                    )}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm">
                    <span className="text-gray-500 italic">Locked</span>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm text-center text-gray-500">
                    No rules defined.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
