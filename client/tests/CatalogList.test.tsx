import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CatalogList } from '../src/components/CatalogList';

describe('CatalogList Component Tests', () => {
  const mockToken = 'mock-test-jwt-token';

  const mockCatalogData = [
    {
      id: 1,
      name: 'Iced Matcha Latte',
      description: 'Ceremonial grade Japanese green tea latte',
      unitPrice: '4.50',
      stockQuantity: 50,
      isActive: true,
    },
    {
      id: 2,
      name: 'Artisan Croissant',
      description: 'Freshly baked flaky French butter croissant',
      unitPrice: '3.25',
      stockQuantity: 30,
      isActive: true,
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // TEST-14: Render CatalogList component with mocked API
  it('[TEST-14 / AC-05] renders catalog items, price tags, and order summary correctly', async () => {
    // Mock global fetch
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/catalog') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockCatalogData }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<CatalogList token={mockToken} />);

    // Shows loading initially
    expect(screen.getByText(/loading menu & catalog/i)).toBeInTheDocument();

    // Wait for items to be displayed
    await waitFor(() => {
      expect(screen.getByText('Iced Matcha Latte')).toBeInTheDocument();
      expect(screen.getByText('Artisan Croissant')).toBeInTheDocument();
    });

    // Check price badges
    expect(screen.getByText('$4.50')).toBeInTheDocument();
    expect(screen.getByText('$3.25')).toBeInTheDocument();

    // Check stock status
    expect(screen.getByText(/50 left/i)).toBeInTheDocument();
    expect(screen.getByText(/30 left/i)).toBeInTheDocument();

    // Check Current Order section
    expect(screen.getByText(/current order/i)).toBeInTheDocument();
    expect(screen.getByText(/your order is empty/i)).toBeInTheDocument();
  });

  // DEF-QO-01 / Issue #27: Cart item quantity allows exceeding available inventory stock via + button
  it('[DEF-QO-01 / Issue #27] prevents incrementing cart quantity beyond available inventory stock', async () => {
    const limitedStockItem = [
      {
        id: 99,
        name: 'KMUTT Engineering Hoodie',
        description: 'Limited edition cotton fleece hoodie',
        unitPrice: '28.00',
        stockQuantity: 3,
        isActive: true,
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/catalog') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: limitedStockItem }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    render(<CatalogList token={mockToken} />);

    // Wait for item to load
    await waitFor(() => {
      expect(screen.getByText('KMUTT Engineering Hoodie')).toBeInTheDocument();
      expect(screen.getByText(/3 left/i)).toBeInTheDocument();
    });

    const plusButton = screen.getByLabelText('Increase quantity');
    const input = screen.getByLabelText('Quantity for KMUTT Engineering Hoodie') as HTMLInputElement;

    // Click 3 times to reach full stock of 3
    fireEvent.click(plusButton);
    fireEvent.click(plusButton);
    fireEvent.click(plusButton);

    expect(input.value).toBe('3');

    // The '+' button MUST be disabled once quantity reaches available stock (3)
    expect(plusButton).toBeDisabled();

    // Attempting another click must NOT increase quantity beyond stock
    fireEvent.click(plusButton);
    expect(input.value).toBe('3');
  });
});
