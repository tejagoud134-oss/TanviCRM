// E-Commerce Product Services for Tanvi Boutique

const productService = {
  getAllProducts: async () => {
    const res = await apiClient.get('/products');
    return res.data;
  },

  getProductById: async (id) => {
    const res = await apiClient.get(`/products/${id}`);
    return res.data;
  },

  createProduct: async (productData) => {
    const res = await apiClient.post('/products', productData);
    return res.data;
  },

  updateProduct: async (id, productData) => {
    const res = await apiClient.put(`/products/${id}`, productData);
    return res.data;
  },

  deleteProduct: async (id) => {
    const res = await apiClient.delete(`/products/${id}`);
    return res.data;
  }
};
