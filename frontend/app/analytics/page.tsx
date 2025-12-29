'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { fetchPricingData } from '../../lib/rules_storage';
import { calculatePriceBySku, PricingData, CalculationResult, Product } from '../../lib/pricing';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AnalyticsPage() {
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
        try {
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
            const data = await fetchPricingData(basePath);
            setPricingData(data);

            if (data.products) {
                const calculated = data.products.map((p: Product) => {
                    // Simple heuristic for item type based on name key words
                    let type = 'other';
                    const name = p.name ? p.name.toLowerCase() : '';
                    if (name.includes('mug') || name.includes('cup') || name.includes('stein')) type = 'cups/mugs';
                    else if (name.includes('plate') || name.includes('bowl') || name.includes('dish')) type = 'plates/bowls';
                    else if (name.includes('vase')) type = 'vases';
                    else if (name.includes('bank') || name.includes('figurine') || name.includes('animal')) type = 'figurines';
                    
                    try {
                        const res = calculatePriceBySku(p.sku, data, type);
                        return {
                            ...p,
                            calculatedPrice: res.finalPrice,
                            typeUsed: type
                        };
                    } catch (e) {
                        return {
                            ...p,
                            calculatedPrice: 0,
                            typeUsed: type,
                            error: 'Error'
                        };
                    }
                });
                setTableData(calculated);
            }

        } catch (e) {
            console.error("Failed to load data", e);
        } finally {
            setLoading(false);
        }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    if (tableData.length === 0) return null;
    const prices = tableData.map(r => r.calculatedPrice).filter(p => !isNaN(p)).sort((a,b) => a - b);
    if(prices.length === 0) return null;

    const overallMean = prices.reduce((a,b) => a + b, 0) / prices.length;
    const overallMedian = prices[Math.floor(prices.length / 2)];
    
    // Group by category
    const byCategory: Record<string, number[]> = {};
    tableData.forEach(r => {
        if(!byCategory[r.typeUsed]) byCategory[r.typeUsed] = [];
        byCategory[r.typeUsed].push(r.calculatedPrice);
    });
    
    const categoryStats = Object.keys(byCategory).map(cat => {
        const p = byCategory[cat].sort((a,b) => a - b);
        if (p.length === 0) return { category: cat, mean: 0, median: 0, count: 0 };
        return {
            category: cat,
            mean: p.reduce((a,b) => a + b, 0) / p.length,
            median: p[Math.floor(p.length / 2)],
            count: p.length
        };
    });

    return { overallMean, overallMedian, categoryStats, allPrices: prices };
}, [tableData]);

const chartData = useMemo(() => {
    if (!stats || !stats.allPrices.length) return [];
    
    const prices = stats.allPrices;
    const min = Math.floor(prices[0]);
    const max = Math.ceil(prices[prices.length - 1]);
    
    // Create ~20 buckets or fewer if range is small
    const range = max - min;
    const targetBuckets = 20;
    const bucketSize = Math.max(1, Math.ceil(range / targetBuckets)); 
    const bucketCount = Math.ceil(range / bucketSize) + 1;

    const buckets = Array.from({length: bucketCount}, (_, i) => {
       const start = min + (i * bucketSize);
       const end = start + bucketSize;
       return { 
          range: `$${start}-${end}`, 
          rangeLabel: `$${start}`, // Simplified label
          count: 0,
          min: start,
          max: end
       };
    });
    
    prices.forEach(p => {
        let bucketIndex = Math.floor((p - min) / bucketSize);
        if(bucketIndex >= buckets.length) bucketIndex = buckets.length - 1;
        if(bucketIndex < 0) bucketIndex = 0;
        buckets[bucketIndex].count++;
    });
    
    return buckets.filter(b => b.count > 0); // Optional: filter empty buckets for cleaner chart? Or keep for distribution shape. 
    // Keeping empty buckets usually better for "Bell Curve" shape visualization.
    // Let's return all buckets.
    return buckets;
}, [stats]);


  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-gray-900 text-gray-100">
      <div className="w-full max-w-7xl mb-8 flex justify-between items-center">
        <h1 className="text-4xl font-bold text-white">Analytics</h1>
        <div className="space-x-4">
             <Link href="/" className="text-blue-400 hover:text-blue-300 font-semibold">
               ← Calculator
             </Link>
             <Link href="/config" className="text-blue-400 hover:text-blue-300 font-semibold">
               Configuration →
             </Link>
        </div>
      </div>

      {/* Stats Summary */}
      {!loading && stats && (
         <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
                <h2 className="text-2xl font-bold mb-4 text-blue-300">Price Distribution</h2>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="rangeLabel" stroke="#9CA3AF" tick={{fontSize: 12}} />
                            <YAxis stroke="#9CA3AF" />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6'}} 
                                cursor={{fill: '#374151', opacity: 0.5}}
                            />
                            <Bar dataKey="count" fill="#60A5FA" radius={[4, 4, 0, 0]} name="Products" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700">
                <h2 className="text-2xl font-bold mb-4 text-green-300">Statistics</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-700 p-4 rounded text-center">
                        <p className="text-gray-400 text-sm uppercase">Overall Average</p>
                        <p className="text-3xl font-bold text-white">${stats.overallMean.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-700 p-4 rounded text-center">
                        <p className="text-gray-400 text-sm uppercase">Overall Median</p>
                        <p className="text-3xl font-bold text-white">${stats.overallMedian.toFixed(2)}</p>
                    </div>
                </div>
                
                <h3 className="text-lg font-semibold mb-2 text-gray-300">By Category</h3>
                <div className="overflow-auto max-h-40">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-900 sticky top-0">
                            <tr>
                                <th className="px-3 py-2">Category</th>
                                <th className="px-3 py-2 text-right">Avg</th>
                                <th className="px-3 py-2 text-right">Med</th>
                                <th className="px-3 py-2 text-right">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.categoryStats.map(cat => (
                                <tr key={cat.category} className="border-b border-gray-700 hover:bg-gray-750">
                                    <td className="px-3 py-2 font-medium bg-gray-800 capitalize">{cat.category}</td>
                                    <td className="px-3 py-2 text-right">${cat.mean.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">${cat.median.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right">{cat.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
      )}

      {/* Data Table */}
      <div className="w-full max-w-7xl bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 overflow-x-auto">
        {loading ? (
            <p className="text-center text-gray-400">Loading analytics...</p>
        ) : (
            <table className="min-w-full leading-normal">
                <thead>
                    <tr>
                        <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">SKU</th>
                        <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                        <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type (Inferred)</th>
                        <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Cost</th>
                        <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Price</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-750">
                            <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm font-mono text-gray-300">
                                {row.sku}
                            </td>
                            <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm text-white">
                                {row.name}
                            </td>
                            <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm text-gray-400 italic capitalize">
                                {row.typeUsed}
                            </td>
                            <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm text-right text-gray-300">
                                ${row.price.toFixed(2)}
                            </td>
                            <td className="px-5 py-5 border-b border-gray-700 bg-gray-800 text-sm text-right font-bold text-green-400">
                                ${row.calculatedPrice.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
}
