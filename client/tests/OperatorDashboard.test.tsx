import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import OperatorDashboard from '../src/components/OperatorDashboard';

describe('OperatorDashboard Component Tests (Feature 4)', () => {
  const dummyToken = 'operator_dummy_token_xyz';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockOrders = [
    {
      id: 101,
      status: 'SUBMITTED',
      totalAmount: '12.25',
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-05T10:00:00.000Z',
      customer: {
        id: 1,
        fullName: 'Alice Customer',
        email: 'customer1@example.com',
      },
      items: [
        {
          id: 1,
          catalogItemId: 1,
          itemName: 'Iced Matcha Latte',
          unitPrice: '4.50',
          quantity: 2,
          lineTotal: '9.00',
        },
        {
          id: 2,
          catalogItemId: 2,
          itemName: 'Artisan Croissant',
          unitPrice: '3.25',
          quantity: 1,
          lineTotal: '3.25',
        },
      ],
    },
    {
      id: 102,
      status: 'ACCEPTED',
      totalAmount: '4.50',
      createdAt: '2026-11-05T09:30:00.000Z',
      updatedAt: '2026-11-05T09:35:00.000Z',
      customer: {
        id: 2,
        fullName: 'Bob Customer',
        email: 'customer2@example.com',
      },
      items: [
        {
          id: 3,
          catalogItemId: 1,
          itemName: 'Iced Matcha Latte',
          unitPrice: '4.50',
          quantity: 1,
          lineTotal: '4.50',
        },
      ],
    },
  ];

  // TEST-UI-01 / AC-11: Operator Queue rendering
  it('[AC-11] renders operator order queue table with customer names, totals, and status badges', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockOrders }),
    } as any);

    render(<OperatorDashboard token={dummyToken} />);

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
      expect(screen.getByText('#102')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice Customer')).toBeInTheDocument();
    expect(screen.getByText('customer1@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Customer')).toBeInTheDocument();
    expect(screen.getByText('customer2@example.com')).toBeInTheDocument();
    expect(screen.getByText('$12.25')).toBeInTheDocument();
    expect(screen.getByText('$4.50')).toBeInTheDocument();

    // Verify badges and action buttons
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept order/i })).toBeInTheDocument();
  });

  // TEST-UI-02 / AC-12: Accept Order State Transition
  it('[AC-12] clicking Accept Order calls PATCH and updates order status to ACCEPTED', async () => {
    const fetchMock = vi.fn();

    // First call: GET /api/operator/orders
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockOrders }),
    });

    // Second call: PATCH /api/operator/orders/101/accept
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          ...mockOrders[0],
          status: 'ACCEPTED',
          updatedAt: '2026-11-05T10:05:00.000Z',
        },
      }),
    });

    global.fetch = fetchMock as any;

    render(<OperatorDashboard token={dummyToken} />);

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole('button', { name: /accept order/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/operator/orders/101/accept',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            Authorization: `Bearer ${dummyToken}`,
          }),
        })
      );
    });

    // After successful accept, success feedback should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Order #101 was successfully accepted!/i)).toBeInTheDocument();
    });
  });

  // TEST-UI-03 / AC-13: 409 Conflict Error Handling
  it('[AC-13] displays conflict alert when server rejects accept with 409 Conflict', async () => {
    const fetchMock = vi.fn();

    // GET /api/operator/orders
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockOrders }),
    });

    // PATCH returns 409 Conflict
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: { code: 'STATE_CONFLICT', message: 'Cannot accept Order #101 because it is already accepted' },
      }),
    });

    global.fetch = fetchMock as any;

    render(<OperatorDashboard token={dummyToken} />);

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole('button', { name: /accept order/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(screen.getByText(/Cannot accept Order #101 because it is already accepted/i)).toBeInTheDocument();
    });
  });

  // TEST-UI-04: Line Items Breakdown Toggle
  it('toggles order item snapshot breakdown when Items button is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockOrders }),
    } as any);

    render(<OperatorDashboard token={dummyToken} />);

    await waitFor(() => {
      expect(screen.getByText('#101')).toBeInTheDocument();
    });

    // Items should not be in the breakdown table initially
    expect(screen.queryByText(/Line Items Breakdown for Order #101/i)).not.toBeInTheDocument();

    // Click Items toggle for order 101
    const itemsBtn = screen.getAllByRole('button', { name: /items/i })[0];
    fireEvent.click(itemsBtn);

    expect(screen.getByText(/Line Items Breakdown for Order #101/i)).toBeInTheDocument();
    expect(screen.getByText('Artisan Croissant')).toBeInTheDocument();
  });

  // TEST-UI-05: Empty State
  it('renders clean empty state when queue has no orders', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as any);

    render(<OperatorDashboard token={dummyToken} />);

    await waitFor(() => {
      expect(screen.getByText('No Orders in this View')).toBeInTheDocument();
    });

    expect(screen.getByText(/There are currently no customer orders placed in the system/i)).toBeInTheDocument();
  });
});
