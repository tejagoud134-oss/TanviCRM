// E-Commerce Order Services for Tanvi Boutique

const orderService = {
  getAllOrders: async () => {
    const res = await apiClient.get('/orders');
    return res.data;
  },

  getOrderById: async (id) => {
    const res = await apiClient.get(`/orders/${id}`);
    return res.data;
  },

  createOrder: async (orderItems) => {
    // orderItems: [{ product_id, quantity }]
    const res = await apiClient.post('/orders', { items: orderItems });
    return res.data;
  },

  updateOrderStatus: async (id, status, paymentStatus) => {
    const res = await apiClient.put(`/orders/${id}`, { status, payment_status: paymentStatus });
    return res.data;
  },

  deleteOrder: async (id) => {
    const res = await apiClient.delete(`/orders/${id}`);
    return res.data;
  }
};
