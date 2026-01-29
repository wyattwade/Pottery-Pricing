import { describe, it, expect } from 'vitest';
import { Rule } from './pricing';

// Since sanitizeRules is not exported, we might need to export it for testing or test it via fetchPricingData if we mock fetch.
// Alternatively, I can just test the logic by copying the function or making it exported in rules_storage.ts.
// Let's check rules_storage.ts again.

import { fetchPricingData } from './rules_storage';
import { vi } from 'vitest';

describe('rules storage', () => {
  it('sanitizes rules correctly on fetch', async () => {
    const mockData = {
      pricingMatrix: [],
      rules: [
        { id: 1, name: 'addedMultiplier', value: 8, type: 'PERCENTAGE_ADD', isActive: true, userId: 1 },
      ],
      products: []
    };

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData)
    });

    const data = await fetchPricingData();
    
    // Check if addedMultiplier was forced to 6
    const addedMult = data.rules.find(r => r.name === 'addedMultiplier');
    expect(addedMult?.value).toBe(6);

    // Check if defaults were added
    expect(data.rules.some(r => r.name === 'mugMinPrice' && r.value === 19)).toBe(true);
    expect(data.rules.some(r => r.name === 'plateMinPrice' && r.value === 20)).toBe(true);
    expect(data.rules.some(r => r.name === 'maxMarkupAmount' && r.value === 90)).toBe(true);
  });
});
