// Product Reviews Services for Tanvi Boutique

const reviewService = {
  getProductReviews: async (productId) => {
    const res = await apiClient.get(`/reviews/${productId}`);
    return res.data;
  },

  createReview: async (reviewData) => {
    // reviewData: { product_id, rating, review }
    const res = await apiClient.post('/reviews', reviewData);
    return res.data;
  },

  deleteReview: async (reviewId) => {
    const res = await apiClient.delete(`/reviews/${reviewId}`);
    return res.data;
  }
};
