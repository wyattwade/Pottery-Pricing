'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredRules, saveRules, fetchPricingData } from '../../lib/rules_storage';
import { Rule } from '../../lib/pricing';

export default function ConfigPage() {
  const [rules, setRules] = useState<Rule[]>([]);
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
              return `$${rule.value}`;
          case 'FIXED_DEDUCTION':
              return `-$${rule.value}`;
          default:
              return `${rule.value}`;
      }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-24 bg-gray-900 text-gray-100">
      <div className="w-full max-w-4xl mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white">Configuration</h1>
        <Link href="/" className="text-blue-400 hover:text-blue-300 font-semibold">
          ← Back to Calculator
        </Link>
      </div>

      <div className="w-full max-w-4xl bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-gray-200">Pricing Rules</h2>
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
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`px-2 py-1 leading-none rounded-full font-semibold ${
                        rule.isActive
                          ? 'bg-green-900 text-green-200'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm font-medium text-gray-200">
                    {rule.name}
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
                    {editingId === rule.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => saveEdit(rule.id)}
                          className="text-green-400 hover:text-green-300 font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-gray-400 hover:text-gray-300 font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(rule)}
                        className="text-blue-400 hover:text-blue-300 font-semibold"
                      >
                        Edit
                      </button>
                    )}
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
