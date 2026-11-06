import { useState, useEffect } from 'react';

export interface CatalogItem {
  id: number;
  name: string;
  description: string;
  unitPrice: string;
  stockQuantity: number;
  isActive: boolean;
}

export interface OrderItemReceipt {
  catalogItemId: number;
  itemName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface PlacedOrderReceipt {
  id: number;
  status: string;
  totalAmount: string;
  createdAt: string;
  items: OrderItemReceipt[];
}

interface CatalogListProps {
  token: string;
}

export function CatalogList({ token }: CatalogListProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart: item ID -> quantity
  const [cart, setCart] = useState<{ [id: number]: number }>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<PlacedOrderReceipt | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/catalog');
      const json = await res.json();
      if (res.ok && json.success) {
        setItems(json.data);
      } else {
        setError(json.error?.message || 'Failed to load catalog');
      }
    } catch {
      setError('Unable to connect to server to fetch catalog');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemId: number, delta: number) => {
    setCart((prev) => {
      const current = prev[itemId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const handlePlaceOrder = async () => {
    const cartEntries = Object.entries(cart).map(([idStr, quantity]) => ({
      catalogItemId: Number(idStr),
      quantity,
    }));

    if (cartEntries.length === 0) {
      setOrderError('Your cart is empty. Please add items to place an order.');
      return;
    }

    setSubmitting(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: cartEntries }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setOrderSuccess(json.data);
        setCart({});
        // Refresh catalog to reflect updated inventory
        fetchCatalog();
      } else {
        setOrderError(json.error?.message || 'Failed to place order');
      }
    } catch {
      setOrderError('Network error while placing order');
    } finally {
      setSubmitting(false);
    }
  };

  const calculateSubtotal = () => {
    return Object.entries(cart).reduce((sum, [idStr, qty]) => {
      const item = items.find((i) => i.id === Number(idStr));
      if (!item) return sum;
      return sum + parseFloat(item.unitPrice) * qty;
    }, 0).toFixed(2);
  };

  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="text-muted mt-2 small">Loading menu & catalog...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex align-items-center" role="alert">
        <i className="bi bi-exclamation-triangle me-2 fs-5"></i>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="h5 fw-bold mb-0">Browse Catalog & Menu</h3>
          <p className="text-muted small mb-0">Select items and quantities. Prices are computed authoritatively by the server.</p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={fetchCatalog}>
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>

      {orderSuccess && (
        <div className="alert alert-success alert-dismissible fade show p-3 mb-4" role="alert">
          <div className="d-flex align-items-center mb-2">
            <i className="bi bi-check-circle-fill fs-4 text-success me-2"></i>
            <h5 className="alert-heading mb-0 fw-bold">Order Placed Successfully!</h5>
          </div>
          <p className="small mb-2">
            Order Reference: <strong>#{orderSuccess.id}</strong> | Status: <span className="badge bg-warning text-dark">{orderSuccess.status}</span> | Total: <strong>${orderSuccess.totalAmount}</strong>
          </p>
          <ul className="small mb-0 ps-3">
            {orderSuccess.items.map((item, idx) => (
              <li key={idx}>
                {item.itemName} x {item.quantity} @ ${item.unitPrice} = <strong>${item.lineTotal}</strong>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setOrderSuccess(null)}></button>
        </div>
      )}

      {orderError && (
        <div className="alert alert-danger alert-dismissible fade show p-3 mb-4" role="alert">
          <div className="d-flex align-items-center">
            <i className="bi bi-exclamation-circle-fill fs-5 text-danger me-2"></i>
            <div className="small fw-semibold">{orderError}</div>
          </div>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setOrderError(null)}></button>
        </div>
      )}

      <div className="row g-4">
        {/* Catalog Items Column */}
        <div className="col-12 col-lg-8">
          <div className="row g-3">
            {items.map((item) => {
              const currentQty = cart[item.id] || 0;
              const isOutOfStock = item.stockQuantity <= 0;

              return (
                <div key={item.id} className="col-12 col-md-6">
                  <div className="card h-100 shadow-sm border">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h5 className="card-title h6 fw-bold mb-0">{item.name}</h5>
                        <span className="badge bg-primary fs-6">${item.unitPrice}</span>
                      </div>
                      <p className="card-text text-muted small flex-grow-1">{item.description}</p>
                      
                      <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <span className="small">
                          Stock:{' '}
                          <span className={`fw-bold ${item.stockQuantity < 10 ? 'text-danger' : 'text-success'}`}>
                            {item.stockQuantity} left
                          </span>
                        </span>

                        <div className="btn-group btn-group-sm" role="group">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => handleQuantityChange(item.id, -1)}
                            disabled={currentQty === 0 || isOutOfStock}
                            aria-label="Decrease quantity"
                          >
                            <i className="bi bi-dash"></i>
                          </button>
                          <input
                            type="number"
                            min="0"
                            className="form-control form-control-sm text-center fw-bold text-dark px-1"
                            style={{ width: '56px', borderRadius: 0 }}
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setCart((prev) => {
                                if (val <= 0) {
                                  const copy = { ...prev };
                                  delete copy[item.id];
                                  return copy;
                                }
                                return { ...prev, [item.id]: val };
                              });
                            }}
                            aria-label={`Quantity for ${item.name}`}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => handleQuantityChange(item.id, 1)}
                            disabled={isOutOfStock}
                            aria-label="Increase quantity"
                          >
                            <i className="bi bi-plus"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Summary / Cart Sidebar */}
        <div className="col-12 col-lg-4">
          <div className="card shadow-sm border border-primary border-opacity-25 sticky-top" style={{ top: '1rem' }}>
            <div className="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
              <span className="fw-semibold small">
                <i className="bi bi-cart3 me-1"></i> Current Order
              </span>
              <span className="badge bg-light text-dark">{totalCartCount} items</span>
            </div>
            <div className="card-body p-3">
              {totalCartCount === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-cart-x fs-1 text-secondary opacity-50 mb-2"></i>
                  <p className="small mb-0">Your order is empty.</p>
                  <p className="small text-muted">Select items from the catalog to build your order.</p>
                </div>
              ) : (
                <>
                  <ul className="list-group list-group-flush mb-3">
                    {Object.entries(cart).map(([idStr, qty]) => {
                      const item = items.find((i) => i.id === Number(idStr));
                      if (!item) return null;
                      const itemTotal = (parseFloat(item.unitPrice) * qty).toFixed(2);

                      return (
                        <li key={item.id} className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-semibold small">{item.name}</div>
                            <div className="text-muted small">${item.unitPrice} × {qty}</div>
                          </div>
                          <span className="fw-bold small">${itemTotal}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="d-flex justify-content-between align-items-center pt-2 border-top mb-3">
                    <span className="fw-bold">Estimated Total:</span>
                    <span className="fw-bold fs-5 text-primary">${calculateSubtotal()}</span>
                  </div>

                  <button
                    className="btn btn-primary w-100 fw-bold shadow-sm"
                    onClick={handlePlaceOrder}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Authorizing Order...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-bag-check me-2"></i> Place Order
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
