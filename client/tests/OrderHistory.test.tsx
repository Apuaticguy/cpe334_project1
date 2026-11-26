import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  // TEST-19 / AC-16: Render Cancel Order button only on SUBMITTED orders and update status on click
  it('[TEST-19 / AC-16] renders Cancel Order button only on SUBMITTED orders and updates status to CANCELLED on click', async () => {
    const mockOrders = [
      {
        id: 101,
        status: 'SUBMITTED',
        totalAmount: '4.50',
        createdAt: '2026-11-26T10:00:00.000Z',
        updatedAt: '2026-11-26T10:00:00.000Z',
        items: [
          {
            id: 1,
            catalogItemId: 1,
            itemName: 'Iced Matcha Latte',
            unitPrice: '4.50',
            quantity: 1,
            lineTotal: '4.50'
          }
        ]
      },
      {
        id: 102,
        status: 'ACCEPTED',
        totalAmount: '3.25',
        createdAt: '2026-11-26T09:00:00.000Z',
        updatedAt: '2026-11-26T09:05:00.000Z',
        items: [
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

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/orders/my-orders') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockOrders })
        } as Response);
      }
      if (url === '/api/orders/101/cancel' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...mockOrders[0],
              status: 'CANCELLED',
              updatedAt: '2026-11-26T10:02:00.000Z'
            }
          })
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    global.fetch = fetchMock as any;

    render(<OrderHistory token={dummyToken} onBrowseCatalog={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Order #101')).toBeInTheDocument();
      expect(screen.getByText('Order #102')).toBeInTheDocument();
    });

    // Only one Cancel Order button should be rendered (for SUBMITTED Order #101, not ACCEPTED Order #102)
    const cancelButtons = screen.getAllByRole('button', { name: /cancel order/i });
    expect(cancelButtons).toHaveLength(1);

    // Click Cancel Order on Order #101
    fireEvent.click(cancelButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/orders/101/cancel',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: `Bearer ${dummyToken}` })
      })
    );
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  // TEST-S2-14 (F-07 portion) / AC-S2-05: Render REJECTED badge and rejectionReason to customer
  it('[TEST-S2-14 / AC-S2-05] renders REJECTED badge and operator rejection reason in customer order history', async () => {
    const mockOrders = [
      {
        id: 205,
        status: 'REJECTED',
        rejectionReason: 'Store closed early due to power maintenance',
        totalAmount: '4.50',
        createdAt: '2026-11-26T10:00:00.000Z',
        updatedAt: '2026-11-26T10:05:00.000Z',
        items: [
          {
            id: 1,
            catalogItemId: 1,
            itemName: 'Iced Matcha Latte',
            unitPrice: '4.50',
            quantity: 1,
            lineTotal: '4.50'
          }
        ]
      }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockOrders })
    } as any);

    render(<OrderHistory token={dummyToken} onBrowseCatalog={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Order #205')).toBeInTheDocument();
    });

    expect(screen.getByText('REJECTED')).toBeInTheDocument();
    expect(screen.getByText(/Store closed early due to power maintenance/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel order/i })).not.toBeInTheDocument();
  });

  // TEST-S2-14 / AC-S2-10: Pay Now on active UNPAID order -> PAID receipt
  it('[TEST-S2-14 / AC-S2-10] renders Pay Now button for active UNPAID orders and displays PAID receipt after checkout', async () => {
    const mockOrders = [
      {
        id: 301,
        status: 'SUBMITTED',
        paymentStatus: 'UNPAID',
        paymentReference: null,
        paidAt: null,
        totalAmount: '4.50',
        createdAt: '2026-11-26T10:00:00.000Z',
        updatedAt: '2026-11-26T10:00:00.000Z',
        items: [
          {
            id: 1,
            catalogItemId: 1,
            itemName: 'Iced Matcha Latte',
            unitPrice: '4.50',
            quantity: 1,
            lineTotal: '4.50'
          }
        ]
      }
    ];

    const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/orders/my-orders') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: mockOrders })
        } as Response);
      }
      if (url === '/api/orders/301/pay' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              ...mockOrders[0],
              paymentStatus: 'PAID',
              paymentReference: 'PAY-301-1795704000000',
              paidAt: '2026-11-26T10:02:00.000Z',
              updatedAt: '2026-11-26T10:02:00.000Z'
            }
          })
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });
    global.fetch = fetchMock as any;

    render(<OrderHistory token={dummyToken} onBrowseCatalog={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Order #301')).toBeInTheDocument();
    });

    expect(screen.getByText('UNPAID')).toBeInTheDocument();
    const payBtn = screen.getByRole('button', { name: /pay now/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(screen.getByText('PAID')).toBeInTheDocument();
      expect(screen.getAllByText(/PAY-301-1795704000000/i).length).toBeGreaterThanOrEqual(1);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/orders/301/pay',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: `Bearer ${dummyToken}` })
      })
    );
    expect(screen.queryByRole('button', { name: /pay now/i })).not.toBeInTheDocument();
  });
});
