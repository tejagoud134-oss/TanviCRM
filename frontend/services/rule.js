// System Parameters & Capacity Rules Services for Tanvi Boutique

const ruleService = {
  // Fetch rule variables
  getAllRules: async () => {
    const res = await apiClient.get('/rules');
    return res.data;
  },

  // Save rule parameter
  updateRule: async (key, value) => {
    const res = await apiClient.put(`/rules/${key}`, { value });
    return res.data;
  }
};
