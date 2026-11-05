import { useState, useEffect } from 'react';

export interface OrderCustomer {
  id: number;
  email: string;
  fullName: string;
}

export interface OrderItem {
  id: number;
  catalogItemId: number;
  itemName: string;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface OperatorOrder {
  id: number;
  status: 'SUBMITTED' | 'ACCEPTED' | 'CANCELLED';
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  customer: OrderCustomer;
  items: OrderItem[];
}

export interface OperatorDashboardProps {
  token: string;
}

export default function OperatorDashboard({ token }: OperatorDashboardProps) {
  const [orders, setOrders] = useState<OperatorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ orderId: number; type: 'success' | 'danger'; message: string } | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SUBMITTED' | 'ACCEPTED'>('ALL');

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/operator/orders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to retrieve operator orders');
      }
      setOrders(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to operator orders API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleAcceptOrder = async (orderId: number) => {
    setActionLoadingId(orderId);
    setFeedback(null);

    try {
      const res = await fetch(`/api/operator/orders/${orderId}/accept`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error(json.error?.message || `Order #${orderId} has already been accepted or modified.`);
        }
        throw new Error(json.error?.message || `Failed to accept order #${orderId}`);
      }

      // Update state locally with the updated order
      const updatedOrder: OperatorOrder = json.data;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: updatedOrder.status, updatedAt: updatedOrder.updatedAt } : o))
      );

      setFeedback({
        orderId,
        type: 'success',
        message: `Order #${orderId} was successfully accepted!`,
      });
    } catch (err: any) {
      setFeedback({
        orderId,
        type: 'danger',
        message: err.message || `An error occurred while accepting Order #${orderId}`,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedOrderId(expandedOrderId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="badge bg-warning text-dark">
            <i className="bi bi-hourglass-split me-1"></i>SUBMITTED
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="badge bg-success">
            <i className="bi bi-check2-circle me-1"></i>ACCEPTED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge bg-secondary">
            <i className="bi bi-x-circle me-1"></i>CANCELLED
          </span>
        );
      default:
        return <span className="badge bg-info">{status}</span>;
    }
  };

  // Filter orders based on status
  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'ALL') return true;
    return order.status === filterStatus;
  });

  const totalSubmitted = orders.filter((o) => o.status === 'SUBMITTED').length;
  const totalAccepted = orders.filter((o) => o.status === 'ACCEPTED').length;

  if (loading) {
    return (
      <div className="card shadow-sm border-0 p-5 text-center my-4">
        <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
        <p className="text-muted mb-0">Loading operator order queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex justify-content-between align-items-center my-4" role="alert">
        <div>
          <i className="bi bi-shield-x me-2 fs-5"></i>
          <strong>Operator Queue Error:</strong> {error}
        </div>
        <button className="btn btn-outline-danger btn-sm" onClick={fetchOrders}>
          <i className="bi bi-arrow-repeat me-1"></i> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="my-4">
      {/* Header and Controls */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h3 className="h4 fw-bold mb-1">
            <i className="bi bi-inbox-fill me-2 text-primary"></i>Operator Order Queue
          </h3>
          <p className="text-muted small mb-0">
            Authoritative order queue management and atomic status transitions (SUBMITTED &rarr; ACCEPTED)
          </p>
        </div>
        <button className="btn btn-outline-secondary btn-sm align-self-start align-self-md-auto" onClick={fetchOrders}>
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh Queue
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-4">
          <div className="card border-0 shadow-sm bg-white p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted small fw-semibold">Total Orders</span>
                <h4 className="fw-bold mb-0 mt-1">{orders.length}</h4>
              </div>
              <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-3">
                <i className="bi bi-cart-check fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-4">
          <div className="card border-0 shadow-sm bg-white p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-warning-emphasis small fw-semibold">Pending Action</span>
                <h4 className="fw-bold mb-0 mt-1 text-warning-emphasis">{totalSubmitted}</h4>
              </div>
              <div className="bg-warning bg-opacity-10 text-warning rounded-circle p-3">
                <i className="bi bi-hourglass-bottom fs-4"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-4">
          <div className="card border-0 shadow-sm bg-white p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-success small fw-semibold">Accepted Orders</span>
                <h4 className="fw-bold mb-0 mt-1 text-success">{totalAccepted}</h4>
              </div>
              <div className="bg-success bg-opacity-10 text-success rounded-circle p-3">
                <i className="bi bi-check-circle fs-4"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Feedback Alert */}
      {feedback && (
        <div
          className={`alert alert-${feedback.type} alert-dismissible fade show d-flex align-items-center mb-4`}
          role="alert"
        >
          <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2 fs-5`}></i>
          <div>{feedback.message}</div>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setFeedback(null)}></button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="d-flex gap-2 mb-3">
        <button
          className={`btn btn-sm ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setFilterStatus('ALL')}
        >
          All Orders ({orders.length})
        </button>
        <button
          className={`btn btn-sm ${filterStatus === 'SUBMITTED' ? 'btn-warning' : 'btn-outline-secondary'}`}
          onClick={() => setFilterStatus('SUBMITTED')}
        >
          Pending / Submitted ({totalSubmitted})
        </button>
        <button
          className={`btn btn-sm ${filterStatus === 'ACCEPTED' ? 'btn-success' : 'btn-outline-secondary'}`}
          onClick={() => setFilterStatus('ACCEPTED')}
        >
          Accepted ({totalAccepted})
        </button>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <div className="card shadow-sm border-0 p-5 text-center bg-white">
          <div className="bg-light rounded-circle d-inline-flex p-3 mx-auto mb-3 text-muted">
            <i className="bi bi-inbox fs-1"></i>
          </div>
          <h5 className="fw-bold mb-1">No Orders in this View</h5>
          <p className="text-muted small mb-0">
            {filterStatus === 'ALL'
              ? 'There are currently no customer orders placed in the system.'
              : `No orders found with status '${filterStatus}'.`}
          </p>
        </div>
      ) : (
        <div className="card shadow-sm border-0 bg-white overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col" style={{ width: '80px' }}>ID</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Date / Time</th>
                  <th scope="col" className="text-end">Total Amount</th>
                  <th scope="col" className="text-center" style={{ width: '130px' }}>Status</th>
                  <th scope="col" className="text-end" style={{ width: '220px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const formattedDate = new Date(order.createdAt).toLocaleString();
                  const isActionLoading = actionLoadingId === order.id;

                  return (
                    <tr key={order.id} className={order.status === 'SUBMITTED' ? 'table-warning bg-opacity-10' : ''}>
                      <td className="fw-bold text-dark">#{order.id}</td>
                      <td>
                        <div className="fw-semibold text-dark">{order.customer.fullName}</div>
                        <div className="text-muted small">{order.customer.email}</div>
                      </td>
                      <td className="small text-muted">{formattedDate}</td>
                      <td className="text-end fw-bold text-primary">${order.totalAmount}</td>
                      <td className="text-center">{getStatusBadge(order.status)}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end align-items-center gap-2">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => toggleExpand(order.id)}
                            title="Toggle Line Items"
                          >
                            <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} me-1`}></i>
                            {isExpanded ? 'Hide' : 'Items'} ({order.items.length})
                          </button>

                          {order.status === 'SUBMITTED' ? (
                            <button
                              className="btn btn-success btn-sm fw-semibold"
                              onClick={() => handleAcceptOrder(order.id)}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                  Accepting...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-check-lg me-1"></i> Accept Order
                                </>
                              )}
                            </button>
                          ) : (
                            <button className="btn btn-light btn-sm text-success border disabled" disabled>
                              <i className="bi bi-check2-all me-1"></i> Accepted
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Render expanded line items for selected order */}
          {expandedOrderId && (() => {
            const expOrder = orders.find((o) => o.id === expandedOrderId);
            if (!expOrder) return null;

            return (
              <div className="p-4 bg-light border-top">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-uppercase small text-muted mb-0">
                    <i className="bi bi-receipt me-1"></i> Line Items Breakdown for Order #{expOrder.id}
                  </h6>
                  <button className="btn btn-sm btn-link text-muted p-0" onClick={() => setExpandedOrderId(null)}>
                    Close Details
                  </button>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered bg-white mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Item Name</th>
                        <th className="text-center" style={{ width: '100px' }}>Quantity</th>
                        <th className="text-end" style={{ width: '140px' }}>Snapshot Price</th>
                        <th className="text-end" style={{ width: '140px' }}>Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expOrder.items.map((item) => (
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
                        <td className="text-end fw-bold text-primary">${expOrder.totalAmount}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
