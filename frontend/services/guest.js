// Guest RSVPs & Live Check-in Services for Tanvi Boutique

const guestService = {
  // Fetch guest records
  getAllGuests: async () => {
    const res = await apiClient.get('/guests');
    return res.data;
  },

  // Save guest details
  createGuest: async (guestData, override = false) => {
    const res = await apiClient.post(`/guests?override=${override}`, guestData);
    return res.data;
  },

  // Update check-in status
  toggleCheckIn: async (guestId, checkedIn, timeString = null) => {
    const payload = {
      checked_in: checkedIn,
      checkin_time: timeString
    };
    const res = await apiClient.put(`/guests/${guestId}`, payload);
    return res.data;
  },

  // Delete guest profile
  deleteGuest: async (guestId) => {
    const res = await apiClient.delete(`/guests/${guestId}`);
    return res.data;
  }
};
