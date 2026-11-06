import { useState, useEffect } from 'react';

interface OrderItem {
  id: number;
  catalogItemId: number;
  itemName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

interface OrderRecord {
  id: number;
  status: 'SUBMITTED' | 'ACCEPTED' | 'CANCELLED';
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

interface OrderHistoryProps {
  token: string;
  onBrowseCatalog: () => void;
}

export default function OrderHistory({ token, onBrowseCatalog }: OrderHistoryProps) {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/my-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch order history');
      }
      setOrders(json.data || []);
      // Auto-expand the first order if available
      if (json.data && json.data.length > 0) {
        setExpandedOrderId(json.data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to orders API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const toggleExpand = (id: number) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return <span className="badge bg-warning text-dark"><i className="bi bi-clock me-1"></i>SUBMITTED</span>;
      case 'ACCEPTED':
        return <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>ACCEPTED</span>;
      case 'CANCELLED':
        return <span className="badge bg-secondary"><i className="bi bi-x-circle me-1"></i>CANCELLED</span>;
      default:
        return <span className="badge bg-info">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="card shadow-sm border-0 p-5 text-center my-4">
        <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
        <p className="text-muted mb-0">Loading your order history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center my-4" role="alert">
        <div>
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <strong>Error loading orders:</strong> {error}
        </div>
        <button className="btn btn-outline-danger btn-sm" onClick={fetchOrders}>
          <i className="bi bi-arrow-repeat me-1"></i> Try Again
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="card shadow-sm border-0 p-5 text-center my-4">
        <div className="bg-light rounded-circle d-inline-flex p-4 mx-auto mb-3 text-muted">
          <i className="bi bi-receipt-cutoff fs-1"></i>
        </div>
        <h4 className="fw-bold mb-2">No Orders Placed Yet</h4>
        <p className="text-muted small mb-4">
          You haven't placed any orders in this session. Visit our catalog to add items and place your first order!
        </p>
        <div>
          <button className="btn btn-primary" onClick={onBrowseCatalog}>
            <i className="bi bi-bag-plus me-1"></i> Browse Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="h4 fw-bold mb-1">
            <i className="bi bi-receipt me-2 text-primary"></i>My Order History
          </h3>
          <p className="text-muted small mb-0">
            Review your persisted orders, status transitions, and item price snapshots
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={fetchOrders}>
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh Orders
        </button>
      </div>

      <div className="d-flex flex-column gap-3">
        {orders.map((order) => {
          const isExpanded = expandedOrderId === order.id;
          const formattedDate = new Date(order.createdAt).toLocaleString();

          return (
            <div key={order.id} className="card shadow-sm border-0 overflow-hidden">
              <div 
                className="card-header bg-white p-3 d-flex justify-content-between align-items-center cursor-pointer"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleExpand(order.id)}
              >
                <div className="d-flex align-items-center gap-3">
                  <span className="fw-bold text-dark fs-5">Order #{order.id}</span>
                  {getStatusBadge(order.status)}
                  <span className="text-muted small d-none d-md-inline">
                    <i className="bi bi-calendar3 me-1"></i> {formattedDate}
                  </span>
                </div>

                <div className="d-flex align-items-center gap-3">
                  <span className="fs-5 fw-bold text-primary">
                    ${order.totalAmount}
                  </span>
                  <button className="btn btn-sm btn-light border text-muted">
                    <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="card-body p-3 bg-light border-top">
                  <div className="small text-muted mb-2 d-md-none">
                    <i className="bi bi-calendar3 me-1"></i> Placed: {formattedDate}
                  </div>

                  <h6 className="fw-bold small text-muted text-uppercase mb-2">Order Line Items</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered bg-white mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th className="text-center" style={{ width: '100px' }}>Quantity</th>
                          <th className="text-end" style={{ width: '120px' }}>Snapshot Price</th>
                          <th className="text-end" style={{ width: '120px' }}>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id}>
                            <td className="fw-semibold text-dark">{item.itemName}</td>
                            <td className="text-center">{item.quantity}</td>
                            <td className="text-end text-muted">${item.unitPrice}</td>
                            <td className="text-end fw-bold text-dark">${item.lineTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-light">
                          <td colSpan={3} className="text-end fw-bold">Authoritative Order Total:</td>
                          <td className="text-end fw-bold text-primary">${order.totalAmount}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
