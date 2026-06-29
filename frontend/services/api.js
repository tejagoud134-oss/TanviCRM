// Base Axios Service configuration for Tanvi Boutique Full Stack API client

const API_BASE_URL = '/api'; // Proxied locally or via Vercel rewrites

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Inject JWT token into headers if logged in
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('tb_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    // Track user identity header context
    const user = JSON.parse(localStorage.getItem('tb_user') || '{}');
    if (user && user.name) {
      config.headers['X-User-Name'] = user.name;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch authorization issues or network gateway offline
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const status = error.response ? error.response.status : null;
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // Fallback to mock DB on Vercel for any error, or on localhost if server is offline/unavailable
    const shouldFallback = !isLocalhost || !error.response || status === 502 || status === 504 || status === 404;

    if (shouldFallback) {
      console.warn('Redirecting request to Browser LocalStorage Database Mode.');
      try {
        const mockResponse = await handleMockRequest(error.config);
        return mockResponse; // Return resolved mock data back to the calling service
      } catch (mockError) {
        error.formattedMessage = 'Mock DB Error: ' + mockError.message;
        return Promise.reject(error);
      }
    }
    
    if (status === 401 || status === 403) {
      console.warn('Authentication failure or session timeout. Logging out.');
      // Auto Sign out client
      localStorage.removeItem('tb_token');
      localStorage.removeItem('tb_user');
      const loginOverlay = document.getElementById('loginOverlay');
      if (loginOverlay) {
        loginOverlay.style.display = 'flex';
      }
    }
    
    // Format error message
    let errorMsg = 'Network request failed. Please verify connection.';
    if (error.response && error.response.data && error.response.data.detail) {
      errorMsg = error.response.data.detail;
    } else if (error.response && error.response.data && error.response.data.message) {
      errorMsg = error.response.data.message;
    }
    
    error.formattedMessage = errorMsg;
    return Promise.reject(error);
  }
);

// ============================================================================
// BROWSER LOCALSTORAGE MOCK DATABASE ENGINE (OFFLINE FALLBACK MODE)
// ============================================================================

const handleMockRequest = async (config) => {
  const initMockDb = () => {
    if (!localStorage.getItem('tb_mock_initialized')) {
      const defaultEvents = [
        { id: "evt_1", name: "Summer Trunk Show 2026", date: "2026-06-15", time: "10:00 AM", location: "Mumbai Colaba", description: "Previewing new summer collections.", capacity: 50, branch: "Mumbai Colaba" },
        { id: "evt_2", name: "Elite Bridal Preview", date: "2026-06-25", time: "02:00 PM", location: "Delhi Connaught", description: "Exclusive bridal wear showcase.", capacity: 30, branch: "Delhi Connaught" }
      ];
      const defaultGuests = [
        { id: "gst_1", event_id: "evt_1", name: "Aishwarya Rai", email: "aishwarya@example.com", phone: "+91 98765 43210", rsvp_status: "Confirmed", checked_in: false },
        { id: "gst_2", event_id: "evt_1", name: "Priyanka Chopra", email: "priyanka@example.com", phone: "+91 98765 43211", rsvp_status: "Confirmed", checked_in: true, checkin_time: "2026-06-15T10:15:00Z" }
      ];
      const defaultRules = [
        { key: "vipWarningPercent", value: 90 },
        { key: "minAdvanceDays", value: 3 },
        { key: "maxEliteRsvps", value: 25 }
      ];
      const defaultProducts = [
        { id: "prod_1", name: "Silk Banarasi Saree", price: 15000, stock: 10, description: "Pure silk Banarasi saree with gold zari work.", branch: "Mumbai Colaba" },
        { id: "prod_2", name: "Designer Anarkali Suit", price: 8500, stock: 15, description: "Georgette Anarkali suit with heavy embroidery.", branch: "Delhi Connaught" }
      ];
      const defaultOrders = [];
      const defaultReviews = [];
      const defaultAuditLogs = [
        { id: "log_1", action: "System initialized in Demo/Mock Mode", timestamp: new Date().toISOString() }
      ];

      localStorage.setItem('tb_mock_events', JSON.stringify(defaultEvents));
      localStorage.setItem('tb_mock_guests', JSON.stringify(defaultGuests));
      localStorage.setItem('tb_mock_rules', JSON.stringify(defaultRules));
      localStorage.setItem('tb_mock_products', JSON.stringify(defaultProducts));
      localStorage.setItem('tb_mock_orders', JSON.stringify(defaultOrders));
      localStorage.setItem('tb_mock_reviews', JSON.stringify(defaultReviews));
      localStorage.setItem('tb_mock_audit_logs', JSON.stringify(defaultAuditLogs));
      localStorage.setItem('tb_mock_initialized', 'true');
    }
  };

  initMockDb();

  let url = config.url || '';
  if (url.startsWith('/api')) {
    url = url.slice(4);
  }
  if (!url.startsWith('/')) {
    url = '/' + url;
  }
  
  const queryIndex = url.indexOf('?');
  const path = queryIndex !== -1 ? url.substring(0, queryIndex) : url;

  const method = config.method.toUpperCase();
  const data = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : null;

  const loadTable = (name) => JSON.parse(localStorage.getItem(`tb_mock_${name}`) || '[]');
  const saveTable = (name, list) => localStorage.setItem(`tb_mock_${name}`, JSON.stringify(list));

  const logAudit = (action) => {
    const logs = loadTable('audit_logs');
    logs.unshift({ id: `log_${Date.now()}`, action, timestamp: new Date().toISOString() });
    saveTable('audit_logs', logs);
  };

  let responseData = null;

  // 1. Authentication
  if (path === '/auth/seed') {
    responseData = { message: "Database seeded (Mock Mode)" };
  } else if (path === '/auth/login') {
    const email = data?.email || 'staff@tanviboutique.com';
    responseData = {
      token: "mock_jwt_token_for_" + email,
      user: {
        id: email === "admin@tanviboutique.com" ? "usr_admin" : "usr_staff",
        email: email,
        name: email === "admin@tanviboutique.com" ? "Boutique Admin" : "Boutique Staff",
        role: email === "admin@tanviboutique.com" ? "admin" : "staff"
      }
    };
    logAudit(`User logged in (Mock Mode): ${email}`);
  } else if (path === '/auth/logout') {
    responseData = { message: "Logged out (Mock Mode)" };
  } else if (path.startsWith('/auth/profile/')) {
    const userId = path.split('/').pop();
    if (method === 'GET') {
      responseData = {
        id: userId,
        email: userId === "usr_admin" ? "admin@tanviboutique.com" : "staff@tanviboutique.com",
        name: userId === "usr_admin" ? "Boutique Admin" : "Boutique Staff",
        role: userId === "usr_admin" ? "admin" : "staff"
      };
    } else if (method === 'PUT') {
      responseData = { id: userId, ...data };
      logAudit(`Updated profile: ${userId}`);
    }
  }

  // 2. Dashboard & Analytics
  else if (path === '/dashboard') {
    const events = loadTable('events');
    const guests = loadTable('guests');
    const alerts = [];
    const rules = loadTable('rules');
    const vipWarning = rules.find(r => r.key === 'vipWarningPercent')?.value || 90;
    
    events.forEach(evt => {
      const evtGuests = guests.filter(g => g.event_id === evt.id);
      const confGuests = evtGuests.filter(g => g.rsvp_status === 'Confirmed');
      if (evt.capacity && (confGuests.length / evt.capacity) * 100 >= vipWarning) {
        alerts.push({ id: `alt_${evt.id}`, message: `Trunk Show "${evt.name}" capacity exceeds warning threshold!` });
      }
    });

    responseData = {
      metrics: {
        totalEvents: events.length,
        upcomingEvents: events.length,
        totalRSVPs: guests.length,
        confirmedRSVPs: guests.filter(g => g.rsvp_status === 'Confirmed').length,
        attendanceRate: guests.length ? Math.round((guests.filter(g => g.checked_in).length / guests.length) * 100) : 0,
        attendanceSub: "Based on check-in tracking",
        alertCount: alerts.length
      },
      alerts: alerts
    };
  } else if (path === '/dashboard/predictive') {
    responseData = {
      expectedAttendance: 85,
      demandScore: 9.2,
      insights: ["High turnout expected for Banarasi Silk collections.", "Recommend opening additional elite rsvp slots."]
    };
  } else if (path === '/analytics') {
    responseData = {
      revenueTrend: [120000, 145000, 190000, 240000, 310000, 420000],
      checkinsTrend: [45, 62, 78, 110, 134, 189],
      designerDistribution: [
        { designer: "Sabyasachi", sales: 450000 },
        { designer: "Manish Malhotra", sales: 380000 },
        { designer: "Ritu Kumar", sales: 290000 },
        { designer: "Tarun Tahiliani", sales: 220000 }
      ]
    };
  }

  // 3. Events
  else if (path === '/events') {
    if (method === 'GET') {
      responseData = loadTable('events');
    } else if (method === 'POST') {
      const events = loadTable('events');
      const newEvent = { id: `evt_${Date.now()}`, ...data };
      events.push(newEvent);
      saveTable('events', events);
      logAudit(`Created event: ${newEvent.name}`);
      responseData = newEvent;
    }
  } else if (path.startsWith('/events/')) {
    const eventId = path.split('/').pop();
    const events = loadTable('events');
    if (method === 'GET') {
      responseData = events.find(e => e.id === eventId) || {};
    } else if (method === 'DELETE') {
      const filtered = events.filter(e => e.id !== eventId);
      saveTable('events', filtered);
      logAudit(`Deleted event ID: ${eventId}`);
      responseData = { message: "Event deleted (Mock)" };
    }
  }

  // 4. Guests
  else if (path === '/guests') {
    if (method === 'GET') {
      responseData = loadTable('guests');
    } else if (method === 'POST') {
      const guests = loadTable('guests');
      const newGuest = { id: `gst_${Date.now()}`, ...data };
      guests.push(newGuest);
      saveTable('guests', guests);
      logAudit(`Registered guest: ${newGuest.name}`);
      responseData = newGuest;
    }
  } else if (path.startsWith('/guests/')) {
    const guestId = path.split('/').pop();
    const guests = loadTable('guests');
    if (method === 'PUT') {
      const index = guests.findIndex(g => g.id === guestId);
      if (index !== -1) {
        guests[index] = { ...guests[index], ...data };
        saveTable('guests', guests);
        logAudit(`Updated guest status: ${guests[index].name}`);
        responseData = guests[index];
      }
    } else if (method === 'DELETE') {
      const filtered = guests.filter(g => g.id !== guestId);
      saveTable('guests', filtered);
      logAudit(`Deleted guest ID: ${guestId}`);
      responseData = { message: "Guest deleted (Mock)" };
    }
  }

  // 5. Rules
  else if (path === '/rules') {
    responseData = loadTable('rules');
  } else if (path.startsWith('/rules/')) {
    const key = path.split('/').pop();
    const rules = loadTable('rules');
    const index = rules.findIndex(r => r.key === key);
    if (index !== -1) {
      rules[index].value = data?.value;
    } else {
      rules.push({ key, value: data?.value });
    }
    saveTable('rules', rules);
    logAudit(`Updated scheduling rule: ${key} to ${data?.value}`);
    responseData = { key, value: data?.value };
  }

  // 6. Products
  else if (path === '/products') {
    if (method === 'GET') {
      responseData = loadTable('products');
    } else if (method === 'POST') {
      const products = loadTable('products');
      const newProduct = { id: `prod_${Date.now()}`, ...data };
      products.push(newProduct);
      saveTable('products', products);
      logAudit(`Added product: ${newProduct.name}`);
      responseData = newProduct;
    }
  } else if (path.startsWith('/products/')) {
    const prodId = path.split('/').pop();
    const products = loadTable('products');
    if (method === 'GET') {
      responseData = products.find(p => p.id === prodId) || {};
    } else if (method === 'PUT') {
      const index = products.findIndex(p => p.id === prodId);
      if (index !== -1) {
        products[index] = { ...products[index], ...data };
        saveTable('products', products);
        logAudit(`Updated product: ${products[index].name}`);
        responseData = products[index];
      }
    } else if (method === 'DELETE') {
      const filtered = products.filter(p => p.id !== prodId);
      saveTable('products', filtered);
      logAudit(`Deleted product ID: ${prodId}`);
      responseData = { message: "Product deleted" };
    }
  }

  // 7. Orders & Checkout
  else if (path === '/orders') {
    if (method === 'GET') {
      responseData = loadTable('orders');
    } else if (method === 'POST') {
      const orders = loadTable('orders');
      const products = loadTable('products');
      let totalAmount = 0;
      const orderItems = data?.items || [];
      const populatedItems = orderItems.map(item => {
        const prod = products.find(p => p.id === item.product_id);
        const itemTotal = prod ? prod.price * item.quantity : 0;
        totalAmount += itemTotal;
        return {
          ...item,
          product_name: prod?.name || "Unknown Product",
          price: prod?.price || 0,
          total: itemTotal
        };
      });
      const newOrder = {
        id: `ord_${Date.now()}`,
        items: populatedItems,
        total_amount: totalAmount,
        status: "Pending",
        payment_status: "Unpaid",
        created_at: new Date().toISOString()
      };
      orders.push(newOrder);
      saveTable('orders', orders);
      logAudit(`Created order: ${newOrder.id}`);
      responseData = newOrder;
    }
  } else if (path.startsWith('/orders/')) {
    const parts = path.split('/');
    const orderId = parts[2];
    const orders = loadTable('orders');
    if (parts.length > 3 && parts[3] === 'checkout') {
      const index = orders.findIndex(o => o.id === orderId);
      if (index !== -1) {
        orders[index].status = "Processing";
        orders[index].payment_status = "Paid";
        saveTable('orders', orders);
        logAudit(`Completed order checkout ID: ${orderId}`);
        responseData = { message: "Checkout completed", order: orders[index] };
      }
    } else {
      if (method === 'GET') {
        responseData = orders.find(o => o.id === orderId) || {};
      } else if (method === 'PUT') {
        const index = orders.findIndex(o => o.id === orderId);
        if (index !== -1) {
          orders[index] = { ...orders[index], ...data };
          saveTable('orders', orders);
          responseData = orders[index];
        }
      } else if (method === 'DELETE') {
        const filtered = orders.filter(o => o.id !== orderId);
        saveTable('orders', filtered);
        responseData = { message: "Order deleted" };
      }
    }
  }

  // 8. Reviews
  else if (path.startsWith('/reviews')) {
    if (method === 'POST') {
      const reviews = loadTable('reviews');
      const newReview = { id: `rev_${Date.now()}`, ...data, date: new Date().toISOString() };
      reviews.push(newReview);
      saveTable('reviews', reviews);
      responseData = newReview;
    } else if (method === 'DELETE') {
      const revId = path.split('/').pop();
      const reviews = loadTable('reviews');
      const filtered = reviews.filter(r => r.id !== revId);
      saveTable('reviews', filtered);
      responseData = { message: "Review deleted" };
    } else {
      const prodId = path.split('/').pop();
      const reviews = loadTable('reviews');
      responseData = reviews.filter(r => r.product_id === prodId);
    }
  }

  // 9. Audit Logs
  else if (path === '/audit-logs') {
    if (method === 'GET') {
      responseData = loadTable('audit_logs');
    } else if (method === 'DELETE') {
      saveTable('audit_logs', []);
      responseData = { message: "Logs cleared" };
    }
  }

  // 10. Recommendations
  else if (path.startsWith('/recommendations/products')) {
    const products = loadTable('products');
    responseData = products.slice(0, 3);
  }

  // 11. Notifications
  else if (path === '/notifications/send') {
    responseData = { message: "Notification sent (Mock)" };
  }

  // 12. Backup/Restore
  else if (path.startsWith('/backup/')) {
    const action = path.split('/').pop();
    if (action === 'history') {
      responseData = [
        { filename: "backup_default_mock.json", created_at: new Date().toISOString(), size: "4.2 KB" }
      ];
    } else if (action === 'create') {
      responseData = { message: "Backup created successfully (Mock)" };
    } else if (action === 'restore') {
      responseData = { message: "Backup restored successfully (Mock)" };
    }
  }

  // 13. Reports Export
  else if (path.startsWith('/reports/export')) {
    // Return dummy empty text blob for reports download
    const dummyBlob = new Blob(["Mock Event CSV Data Export"], { type: "text/csv" });
    responseData = dummyBlob;
  }

  return {
    data: responseData,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config: config,
    request: {}
  };
};
