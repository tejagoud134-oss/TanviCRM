// Authentication & Profiles Services for Tanvi Boutique

const authService = {
  // Seeding endpoint to trigger database setups out of the box
  seedDefaultAccounts: async () => {
    try {
      const res = await apiClient.post('/auth/seed');
      return res.data;
    } catch (err) {
      console.error('Seeding database users failed:', err.formattedMessage);
      throw err;
    }
  },

  // Perform JWT Log In
  login: async (email, password) => {
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      // Store in localStorage
      localStorage.setItem('tb_token', token);
      localStorage.setItem('tb_user', JSON.stringify(user));
      
      return response.data;
    } catch (err) {
      throw err;
    }
  },

  // Log Out
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err.formattedMessage);
    } finally {
      localStorage.removeItem('tb_token');
      localStorage.removeItem('tb_user');
    }
  },

  // Fetch profiles
  getProfile: async (userId) => {
    const res = await apiClient.get(`/auth/profile/${userId}`);
    return res.data;
  },

  // Update profile details
  updateProfile: async (userId, profileData) => {
    const res = await apiClient.put(`/auth/profile/${userId}`, profileData);
    // Update local storage too if it is the current user
    const currentUser = JSON.parse(localStorage.getItem('tb_user') || '{}');
    if (currentUser.id === userId) {
      localStorage.setItem('tb_user', JSON.stringify({ ...currentUser, ...res.data }));
    }
    return res.data;
  }
};
