// Events Schedule Services for Tanvi Boutique

const eventService = {
  // Fetch all registered boutique events
  getAllEvents: async () => {
    const res = await apiClient.get('/events');
    return res.data;
  },

  // Get specific event details
  getEventById: async (eventId) => {
    const res = await apiClient.get(`/events/${eventId}`);
    return res.data;
  },

  // Save new Trunk Show
  createEvent: async (eventData) => {
    const res = await apiClient.post('/events', eventData);
    return res.data;
  },

  // Delete event registry
  deleteEvent: async (eventId) => {
    const res = await apiClient.delete(`/events/${eventId}`);
    return res.data;
  }
};
