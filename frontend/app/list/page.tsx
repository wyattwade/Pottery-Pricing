'use client';

import { useState, useEffect } from 'react';
import { fetchPricingData, fetchFlaggedSkus } from '../../lib/rules_storage';
import { calculatePriceBySku, PricingData, Product } from '../../lib/pricing';

export default function ListPage() {
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [flaggedSkus, setFlaggedSkus] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const [data, flags] = await Promise.all([
          fetchPricingData(basePath),
          fetchFlaggedSkus(basePath)
        ]);
        
        setFlaggedSkus(flags);

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
              const res = calculatePriceBySku(p.sku, data, { itemType: type });
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

  const downloadCSV = () => {
    if (!tableData || tableData.length === 0) return;

    const headers = ['SKU', 'Name', 'Item Type', 'Cost', 'Calculated Price', 'Flagged'];
    const csvRows = [
      headers.join(','), // Header row
      ...tableData.map(row => {
        return [
          `"${row.sku}"`,
          `"${row.name}"`,
          `"${row.typeUsed}"`,
          row.cost?.toFixed(2),
          row.calculatedPrice?.toFixed(2),
          flaggedSkus.includes(row.sku) ? "TRUE" : "FALSE"
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'pottery_prices.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Product Price List</h1>
            <button 
                onClick={downloadCSV}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow transition-colors duration-200 flex items-center gap-2"
                disabled={loading || tableData.length === 0}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
            </button>
        </div>
        
        <div className="bg-gray-800 shadow-xl rounded-lg overflow-hidden border border-gray-700">
          {loading ? (
             <div className="p-8 text-center text-gray-400">Loading products...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full leading-normal">
                <thead>
                  <tr>
                    <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Item Type
                    </th>
                    <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Price
                    </th>
                    <th className="px-5 py-3 border-b-2 border-gray-700 bg-gray-900 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row) => {
                      const isFlagged = flaggedSkus.includes(row.sku);
                      return (
                        <tr key={row.id} className={`border-b border-gray-700 transition-colors ${isFlagged ? 'bg-red-900/20 hover:bg-red-900/30' : 'hover:bg-gray-750'}`}>
                          <td className="px-5 py-4 text-sm font-mono text-gray-300">
                             <div className="flex items-center">
                                {isFlagged && (
                                    <div className="mr-2 text-yellow-500 group relative">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-red-800 text-white text-xs rounded shadow-lg border border-red-600 hidden group-hover:block z-50">
                                            Flagged: Potentially inconsistent due to item size and price. Please contact admin for pricing.
                                        </div>
                                    </div>
                                )}
                                {row.sku}
                             </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-white">
                            {row.name}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-400 italic">
                             {row.typeUsed}
                          </td>
                           <td className="px-5 py-4 text-sm text-right">
                               <div className="flex flex-col">
                                    <span className={`font-bold ${isFlagged ? 'text-yellow-400' : 'text-green-400'}`}>${row.calculatedPrice?.toFixed(2)}</span>
                               </div>
                           </td>
                          <td className="px-5 py-4 text-sm text-right text-gray-400">
                             <div className="text-xs">
                                 <div>Cost: ${row.cost?.toFixed(2)}</div>
                             </div>
                          </td>
                        </tr>
                      );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
