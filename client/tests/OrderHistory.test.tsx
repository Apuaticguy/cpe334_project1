import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OrderHistory from '../src/components/OrderHistory';

describe('OrderHistory Component Tests', () => {
  const dummyToken = 'dummy_token_123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // TEST-15 / AC-09: Render past orders and price snapshots
  it('[TEST-15 / AC-09] renders customer past orders, status badges, and item snapshot prices', async () => {
    const mockOrders = [
      {
        id: 42,
        status: 'SUBMITTED',
        totalAmount: '12.25',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
        items: [
          {
            id: 1,
            catalogItemId: 1,
            itemName: 'Iced Matcha Latte',
            unitPrice: '4.50',
            quantity: 2,
            lineTotal: '9.00'
          },
          {
            id: 2,
            catalogItemId: 2,
            itemName: 'Artisan Croissant',
            unitPrice: '3.25',
            quantity: 1,
            lineTotal: '3.25'
          }
        ]
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockOrders })
    } as any);

    render(<OrderHistory token={dummyToken} onBrowseCatalog={() => {}} />);

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Order #42')).toBeInTheDocument();
    });

    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getAllByText('$12.25').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Iced Matcha Latte')).toBeInTheDocument();
    expect(screen.getByText('Artisan Croissant')).toBeInTheDocument();
  });

  // Empty state test
  it('renders friendly empty state when customer has no past orders', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] })
    } as any);

    render(<OrderHistory token={dummyToken} onBrowseCatalog={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('No Orders Placed Yet')).toBeInTheDocument();
    });

    expect(screen.getByText(/You haven't placed any orders in this session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse catalog/i })).toBeInTheDocument();
  });
});
