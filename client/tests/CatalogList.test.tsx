import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
