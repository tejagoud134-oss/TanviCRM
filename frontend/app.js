// Tanvi Boutique Event & Trunk Show Full-Stack Management System Core Logic

// ==========================================
// 1. STATE & SERVICE BINDINGS
// ==========================================

let db = {
  events: [],
  guests: [],
  rules: {
    vipWarningPercent: 90,
    minAdvanceDays: 3,
    maxEliteRsvps: 25
  },
  auditLogs: [],
  alerts: [],
  metrics: {
    totalEvents: 0,
    upcomingEvents: 0,
    totalRSVPs: 0,
    confirmedRSVPs: 0,
    attendanceRate: 0,
    attendanceSub: 'Based on live events',
    alertCount: 0
  }
};

// Global view state
let currentView = "dashboard";
let calendarCurrentDate = new Date(2026, 5, 12); // June 2026
let currentCoordinationEventId = "";
let currentCheckinStatusFilter = "All";

// WebSocket Pointer
let socket = null;

// Chart pointers to destroy/re-instantiate
let charts = {
  pieDist: null,
  lineTrend: null,
  barDesigner: null
};

function connectSocket() {
  if (socket) return;
  
  // Connect to socket server directly on production (Vercel rewrites do not support WS proxying)
  const socketUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? ''
    : 'https://few-yaks-worry.loca.lt';
  
  socket = io(socketUrl);

  // Handle incoming live check-ins from other staff
  socket.on('broadcast_checkin', (data) => {
    showToast(`Socket Event: ${data.name} check-in status updated!`, "info");
    silentRefresh();
  });

  // Handle new events creations
  socket.on('broadcast_event_created', (data) => {
    showToast(`Socket Event: New Trunk Show "${data.name}" scheduled!`, "info");
    silentRefresh();
  });

  // Handle rule modifications
  socket.on('broadcast_rules_updated', () => {
    showToast("Socket Event: Boutique scheduling parameters recalculated by Admin.", "warning");
    silentRefresh();
  });
}

// ==========================================
// 2. TOAST SYSTEM
// ==========================================

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-xmark";
  if (type === "warning") icon = "fa-triangle-exclamation";
  if (type === "info") icon = "fa-circle-info";

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s ease-out reverse";
    setTimeout(() => toast.remove(), 280);
  }, 4000);
}

// ==========================================
// 3. CORE SYNC & REFRESH ENGINES
// ==========================================

let currentBranch = "Mumbai Colaba";

async function refreshDataViews() {
  try {
    // 1. Fetch dashboard metrics & alerts from rules engine
    const dashRes = await apiClient.get('/dashboard');
    db.metrics = dashRes.data.metrics;
    db.alerts = dashRes.data.alerts;

    // 2. Fetch base lists for other views
    const eventsData = await eventService.getAllEvents();
    
    // Filter events by branch
    db.events = eventsData.filter(e => !e.branch || e.branch === currentBranch);

    const guestsData = await guestService.getAllGuests();
    db.guests = guestsData;

    const rulesData = await ruleService.getAllRules();
    rulesData.forEach(r => {
      db.rules[r.key] = r.value;
    });

    const productsData = await productService.getAllProducts();
    db.products = productsData.filter(p => !p.branch || p.branch === currentBranch);

    // 3. Update alert overlays
    updateAlertUI();

    // 4. Load current screen layout
    if (currentView === "dashboard") {
      loadDashboardData();
    } else if (currentView === "scheduler") {
      loadSchedulerData();
    } else if (currentView === "guests") {
      loadGuestsData();
    } else if (currentView === "coordination") {
      loadCoordinationData();
    } else if (currentView === "analytics") {
      loadAnalyticsData();
    } else if (currentView === "settings") {
      loadSettingsData();
    } else if (currentView === "inventory") {
      loadInventoryData();
    }
  } catch (err) {
    showToast(err.formattedMessage || 'Synchronization failed', 'error');
  }
}

// Silent refresh keeps lists in sync without breaking form focus
async function silentRefresh() {
  try {
    const dashRes = await apiClient.get('/dashboard');
    db.metrics = dashRes.data.metrics;
    db.alerts = dashRes.data.alerts;
    
    db.events = await eventService.getAllEvents();
    db.guests = await guestService.getAllGuests();
    
    updateAlertUI();
    
    // Refresh tables and charts
    if (currentView === "dashboard") {
      buildCalendar();
      renderDashboardPieChart();
    } else if (currentView === "scheduler") {
      renderEventsRegistryTable();
    } else if (currentView === "guests") {
      renderGuestsTable();
    } else if (currentView === "coordination") {
      loadCoordinationEventData();
    } else if (currentView === "analytics") {
      renderAnalyticsCharts();
    }
  } catch (err) {
    console.error('Silent refresh failed:', err);
  }
}

function updateAlertUI() {
  const alertCount = db.alerts.length;
  
  const activeAlertBadge = document.getElementById("activeAlertBadge");
  const metricAlertCount = document.getElementById("metricAlertCount");
  const alertMetricCard = document.getElementById("alertMetricCard");
  
  if (activeAlertBadge) {
    activeAlertBadge.style.display = alertCount > 0 ? "block" : "none";
  }
  
  if (metricAlertCount) {
    metricAlertCount.innerText = alertCount;
  }
  
  if (alertMetricCard) {
    if (alertCount > 0) {
      alertMetricCard.classList.add("alert-active");
    } else {
      alertMetricCard.classList.remove("alert-active");
    }
  }

  // Dashboard logs
  const alertList = document.getElementById("dashboardAlertsList");
  if (alertList) {
    if (alertCount === 0) {
      alertList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.85rem;"><i class="fa-solid fa-square-check" style="font-size: 2rem; color: var(--status-success); margin-bottom: 8px; display: block;"></i> No active capacity or date alert conflicts. System running smooth.</div>`;
    } else {
      alertList.innerHTML = db.alerts.map(alt => `
        <div class="alert-item ${alt.type}">
          <i class="${alt.type === 'danger' ? 'fa-solid fa-circle-radiation' : alt.type === 'warning' ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-bell'}"></i>
          <div class="alert-content">
            <p>${alt.message}</p>
            <span class="alert-time">${alt.time}</span>
          </div>
        </div>
      `).join('');
    }
  }
}

// ==========================================
// 4. CLIENT SIDE VIEW ROUTER
// ==========================================

function switchView(viewId) {
  currentView = viewId;
  
  // Hide all sections, show active
  document.querySelectorAll(".view-section").forEach(sec => {
    sec.classList.remove("active");
  });
  
  const selectedSec = document.getElementById(`view-${viewId}`);
  if (selectedSec) {
    selectedSec.classList.add("active");
  }

  // Highlight navigation bar items
  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.remove("active");
  });
  
  const activeNavItem = document.getElementById(`nav-${viewId}`);
  if (activeNavItem) {
    activeNavItem.classList.add("active");
  }

  // Set titles
  const titles = {
    dashboard: "Fashion Suite Dashboard",
    scheduler: "Event Scheduler Registry",
    guests: "Guest List & RSVP Manager",
    coordination: "Live Event Day Coordination",
    analytics: "ROI Analytics & Reports",
    settings: "System Rules & Settings",
    inventory: "Inventory Management Portal"
  };
  
  const currentViewTitle = document.getElementById("currentViewTitle");
  if (currentViewTitle) {
    currentViewTitle.innerText = titles[viewId] || "Boutique Suite";
  }

  refreshDataViews();
}

// ==========================================
// 5. AUTHENTICATION & PORTAL CONTROLS
// ==========================================

function selectRole(role) {
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  
  document.getElementById("roleStaff").classList.remove("selected");
  document.getElementById("roleAdmin").classList.remove("selected");
  
  if (role === "Staff") {
    document.getElementById("roleStaff").classList.add("selected");
    if (emailInput) emailInput.value = "staff@tanviboutique.com";
    if (passwordInput) passwordInput.value = "StaffPass123!";
  } else {
    document.getElementById("roleAdmin").classList.add("selected");
    if (emailInput) emailInput.value = "admin@tanviboutique.com";
    if (passwordInput) passwordInput.value = "AdminPass123!";
  }
}

async function performLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) {
    showToast("Please enter email and password.", "warning");
    return;
  }

  try {
    const data = await authService.login(email, password);
    document.getElementById("loginOverlay").style.display = "none";
    
    // Set User Profile headers
    document.getElementById("userName").innerText = data.user.name;
    document.getElementById("userAvatar").innerText = data.user.name.charAt(0);
    document.getElementById("userRoleBadge").innerText = `${data.user.role} Role`;
    
    showToast(`Welcome back, ${data.user.name}! Access granted.`, "success");
    
    // Connect WebSockets and reload views
    connectSocket();
    switchView("dashboard");
  } catch (err) {
    showToast(err.formattedMessage || "Authentication failed", "error");
  }
}

async function performLogout() {
  await authService.logout();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  document.getElementById("loginOverlay").style.display = "flex";
  showToast("Signed out successfully. Session closed.", "info");
}

// ==========================================
// 6. DASHBOARD & CALENDAR BUILDERS
// ==========================================

function loadDashboardData() {
  // Aggregate Metrics
  document.getElementById("metricTotalEvents").innerText = db.metrics.totalEvents;
  document.getElementById("metricUpcomingEventsCount").innerText = `${db.metrics.upcomingEvents} scheduled upcoming`;
  
  document.getElementById("metricTotalRSVPs").innerText = db.metrics.totalRSVPs;
  document.getElementById("metricConfirmedRSVPs").innerText = `${db.metrics.confirmedRSVPs} confirmed RSVPs`;
  
  document.getElementById("metricAttendanceRate").innerText = `${db.metrics.attendanceRate}%`;
  document.getElementById("metricAttendanceSub").innerText = db.metrics.attendanceSub;

  // Render Calendar
  buildCalendar();

  // Render Quick Upcoming List
  const quickTable = document.getElementById("quickEventsTableBody");
  const upcomingList = db.events
    .filter(e => e.status === "Upcoming")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);

  if (upcomingList.length === 0) {
    quickTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No upcoming events scheduled.</td></tr>`;
  } else {
    quickTable.innerHTML = upcomingList.map(evt => {
      const rsvpCount = db.guests.filter(g => g.event_id === evt.id && g.rsvp === "Confirmed").length;
      return `
        <tr>
          <td><strong><a href="#" style="color: var(--primary-emerald); text-decoration: underline;" onclick="showEventDetails('${evt.id}')">${evt.name}</a></strong></td>
          <td><span class="badge ${evt.type === 'Trunk Show' ? 'badge-gold' : evt.type === 'Private Shopping' ? 'badge-emerald' : 'badge-outline'}">${evt.type}</span></td>
          <td><i class="fa-regular fa-calendar-check" style="margin-right: 4px; color: var(--accent-gold);"></i> ${evt.date} (${evt.time})</td>
          <td>${evt.capacity} seats max</td>
          <td><span class="badge badge-outline">${rsvpCount} Confirmed</span></td>
        </tr>
      `;
    }).join('');
  }

  // Render Pie Chart
  renderDashboardPieChart();
}

function buildCalendar() {
  const grid = document.getElementById("calendarGrid");
  const label = document.getElementById("calendarMonthLabel");
  if (!grid) return;
  grid.innerHTML = "";
  
  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  label.innerText = `${monthNames[month]} ${year}`;
  
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach(d => {
    grid.innerHTML += `<div class="calendar-day-label">${d}</div>`;
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    grid.innerHTML += `<div class="calendar-day empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;
    const dayEvents = db.events.filter(e => e.date === dateStr);
    
    let isToday = (year === 2026 && month === 5 && day === 12) ? "today" : "";
    
    let eventHtml = "";
    dayEvents.forEach(evt => {
      let evtClass = evt.type === "Trunk Show" ? "trunk" : evt.type === "Private Shopping" ? "private" : "designer";
      eventHtml += `<div class="calendar-event-dot ${evtClass}" title="${evt.name}" onclick="event.stopPropagation(); showEventDetails('${evt.id}')">${evt.name}</div>`;
    });

    grid.innerHTML += `
      <div class="calendar-day ${isToday}" onclick="quickScheduleDate('${dateStr}')">
        <span class="day-number">${day}</span>
        <div class="day-events">${eventHtml}</div>
      </div>
    `;
  }
}

function changeMonth(direction) {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + direction);
  buildCalendar();
}

function quickScheduleDate(dateStr) {
  switchView("scheduler");
  document.getElementById("eventDate").value = dateStr;
  showToast(`Pre-selected date ${dateStr} for boutique event scheduling.`, "info");
}

function renderDashboardPieChart() {
  const ctx = document.getElementById("eventTypePieChart");
  if (!ctx) return;

  let trunkShows = db.events.filter(e => e.type === "Trunk Show").length;
  let privateShops = db.events.filter(e => e.type === "Private Shopping").length;
  let launchParties = db.events.filter(e => e.type === "Designer Event").length;

  if (charts.pieDist) {
    charts.pieDist.destroy();
  }

  charts.pieDist = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Trunk Shows', 'Private Consults', 'VIP Launches'],
      datasets: [{
        data: [trunkShows, privateShops, launchParties],
        backgroundColor: ['#D4AF37', '#0A3C30', '#2980B9'],
        borderWidth: 2,
        borderColor: '#FBF9F6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 11 } }
        }
      },
      cutout: '65%'
    }
  });
}

// ==========================================
// 7. EVENT SCHEDULER LOGIC
// ==========================================

function loadSchedulerData() {
  document.getElementById("schedulerFormAlert").style.display = "none";
  renderEventsRegistryTable();
}

function renderEventsRegistryTable() {
  const tbody = document.getElementById("registryEventsTableBody");
  if (!tbody) return;

  tbody.innerHTML = db.events.map(evt => {
    let statusClass = "badge-outline";
    if (evt.status === "Live") statusClass = "badge-emerald";
    if (evt.status === "Completed") statusClass = "badge-outline";
    if (evt.status === "Upcoming") statusClass = "badge-gold";

    const confirms = db.guests.filter(g => g.event_id === evt.id && g.rsvp === "Confirmed").length;

    return `
      <tr>
        <td><strong>${evt.name}</strong></td>
        <td><span class="badge ${evt.type === 'Trunk Show' ? 'badge-gold' : evt.type === 'Private Shopping' ? 'badge-emerald' : 'badge-outline'}">${evt.type}</span></td>
        <td><i class="fa-regular fa-clock"></i> ${evt.date} at ${evt.time}</td>
        <td>${confirms} / ${evt.capacity} max</td>
        <td><span style="font-style: italic; color: var(--text-muted); font-size: 0.85rem;">${evt.designer}</span></td>
        <td><span class="badge ${statusClass}">${evt.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="showEventDetails('${evt.id}')"><i class="fa-regular fa-eye"></i> View</button>
          <button class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="deleteEvent('${evt.id}')"><i class="fa-regular fa-trash-can"></i> Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleEventSubmit(e) {
  e.preventDefault();
  
  const alertBanner = document.getElementById("schedulerFormAlert");
  const alertMsg = document.getElementById("schedulerFormAlertMsg");
  alertBanner.style.display = "none";

  const name = document.getElementById("eventName").value.trim();
  const type = document.getElementById("eventType").value;
  const dateStr = document.getElementById("eventDate").value;
  const timeStr = document.getElementById("eventTime").value;
  const capacity = parseInt(document.getElementById("eventCapacity").value);
  const designer = document.getElementById("featuredDesigner").value.trim();
  const notes = document.getElementById("eventNotes").value.trim();

  const payload = {
    id: `evt-${Date.now()}`,
    name,
    type,
    date: dateStr,
    time: timeStr,
    capacity,
    designer,
    notes,
    status: 'Upcoming'
  };

  try {
    const response = await eventService.createEvent(payload);
    
    // Broadcast WebSockets event creation notice
    if (socket) {
      socket.emit('event_created', { eventId: response.id, name: response.name });
    }

    showToast(`Event "${name}" scheduled successfully!`, "success");
    resetForm('eventEntryForm');
    refreshDataViews();
  } catch (err) {
    alertMsg.innerText = err.formattedMessage || "Event scheduling failed.";
    alertBanner.style.display = "flex";
    showToast("Conflict identified during booking validation", "error");
  }
}

async function deleteEvent(id) {
  const evt = db.events.find(e => e.id === id);
  if (!evt) return;

  if (confirm(`Are you sure you want to delete: "${evt.name}"? This cascades and deletes all RSVPs.`)) {
    try {
      await eventService.deleteEvent(id);
      showToast("Event deleted successfully.", "warning");
      refreshDataViews();
    } catch (err) {
      showToast(err.formattedMessage || "Delete failed", "error");
    }
  }
}

function filterEventsTable() {
  const query = document.getElementById("eventSearchInput").value.toLowerCase();
  const rows = document.querySelectorAll("#registryEventsTableBody tr");

  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    row.style.display = text.includes(query) ? "" : "none";
  });
}

// ==========================================
// 8. GUEST & RSVP MANAGER CONTROLS
// ==========================================

function loadGuestsData() {
  document.getElementById("guestFormAlert").style.display = "none";
  populateGuestFormDropdowns();
  renderGuestsTable();
}

function populateGuestFormDropdowns() {
  const eventSelect = document.getElementById("guestEvent");
  const filterSelect = document.getElementById("guestTableEventFilter");
  
  if (!eventSelect) return;

  const activeEvents = db.events.filter(e => e.status !== "Completed");
  
  eventSelect.innerHTML = activeEvents.map(e => `
    <option value="${e.id}">${e.name} (${e.date} - ${e.type})</option>
  `).join('');

  filterSelect.innerHTML = `<option value="All">All Events</option>` + db.events.map(e => `
    <option value="${e.id}">${e.name}</option>
  `).join('');
}

function renderGuestsTable() {
  const tbody = document.getElementById("registryGuestsTableBody");
  if (!tbody) return;

  tbody.innerHTML = db.guests.map(g => {
    const evt = db.events.find(e => e.id === g.event_id);
    const eventName = evt ? evt.name : "Unassigned Event";

    let vipBadge = "badge-vip-regular";
    if (g.vip === "Elite") vipBadge = "badge-vip-elite";
    if (g.vip === "Gold") vipBadge = "badge-vip-gold";

    let rsvpClass = "badge-outline";
    if (g.rsvp === "Confirmed") rsvpClass = "badge-emerald";
    if (g.rsvp === "Declined") rsvpClass = "badge-outline";
    if (g.rsvp === "Pending") rsvpClass = "badge-gold";

    return `
      <tr>
        <td><strong>${g.name}</strong> ${g.checked_in ? '<span class="badge badge-emerald btn-sm" style="font-size: 0.65rem; padding: 2px 4px;"><i class="fa-solid fa-circle-check"></i> Checked-In</span>' : ''}</td>
        <td style="font-size: 0.85rem;">${eventName}</td>
        <td><span class="badge ${vipBadge}">${g.vip} VIP</span></td>
        <td style="font-size: 0.85rem;">
          <div><i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${g.phone}</div>
          <div><i class="fa-solid fa-envelope" style="font-size: 0.75rem;"></i> ${g.email}</div>
        </td>
        <td><span class="badge ${rsvpClass}">${g.rsvp}</span></td>
        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem;" title="${g.notes || ''}">
          ${g.notes || '<span style="color: var(--text-muted)">None</span>'}
        </td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-secondary btn-sm" onclick="showGuestDetails('${g.id}')">Details</button>
            <button class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="deleteGuest('${g.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleGuestSubmit(e) {
  e.preventDefault();

  const alertBanner = document.getElementById("guestFormAlert");
  const alertMsg = document.getElementById("guestFormAlertMsg");
  alertBanner.style.display = "none";

  const name = document.getElementById("guestName").value.trim();
  const eventId = document.getElementById("guestEvent").value;
  const phone = document.getElementById("guestPhone").value.trim();
  const email = document.getElementById("guestEmail").value.trim();
  const vip = document.getElementById("guestVip").value;
  const rsvp = document.getElementById("guestRsvp").value;
  const notes = document.getElementById("guestNotes").value.trim();

  // Basic validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alertMsg.innerText = "Email Validation Error: Please enter a valid email address.";
    alertBanner.style.display = "flex";
    return;
  }

  const assignedEvt = db.events.find(evt => evt.id === eventId);
  if (!assignedEvt) return;

  const payload = {
    id: `gst-${Date.now()}`,
    event_id: eventId,
    name,
    email,
    phone,
    vip,
    rsvp,
    checked_in: false,
    checkin_time: null,
    notes
  };

  try {
    // Attempt normal guest booking creation
    await guestService.createGuest(payload, false);
    showToast(`Guest profile saved for ${name}!`, "success");
    resetForm('guestEntryForm');
    refreshDataViews();
  } catch (err) {
    if (err.response && err.response.status === 409) {
      // Overcapacity trigger modal
      openOvercapacityModal(name, assignedEvt, payload);
    } else {
      showToast(err.formattedMessage || "Guest registration failed.", "error");
    }
  }
}

function openOvercapacityModal(guestName, eventObj, payload) {
  const modalOverlay = document.getElementById("detailsModalOverlay");
  const title = document.getElementById("detailsModalTitle");
  const content = document.getElementById("detailsModalContent");

  title.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--status-danger);"></i> Showroom Capacity Overflow Policy Warning`;
  content.innerHTML = `
    <div style="font-family: var(--font-sans); padding: 10px 0;">
      <p style="margin-bottom: 12px;"><strong>Guest RSVP Blocked:</strong> Trying to confirm <strong>${guestName}</strong> to event <strong>"${eventObj.name}"</strong>.</p>
      <p style="margin-bottom: 12px; color: var(--status-danger); font-weight: 600;">
        Capacity limit of ${eventObj.capacity} has already been met. Confirming this violates showroom slots allocation rules.
      </p>
      <div style="background-color: var(--bg-cream); padding: 14px; border-radius: var(--border-radius-md); border-left: 4px solid var(--accent-gold); margin-top: 16px;">
        <p style="font-size: 0.85rem; font-weight: bold; margin-bottom: 4px;">Choose Override Options:</p>
        <p style="font-size: 0.8rem; color: var(--text-muted);">
          1. Elite Overrule: Force confirm guest anyway as priority Elite VIP booking (will trigger active warnings).<br>
          2. Pending Registry: Register guest as "Pending" until capacity slots open.
        </p>
      </div>
      <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
        <button class="btn btn-secondary btn-sm" onclick="closeDetailsModal(); triggerPendingRegister(${JSON.stringify(payload).replace(/"/g, '&quot;')})">Register as Pending</button>
        <button class="btn btn-primary btn-sm" style="background-color: var(--status-danger); border-color: var(--status-danger);" onclick="closeDetailsModal(); triggerAdminBypass(${JSON.stringify(payload).replace(/"/g, '&quot;')})">Admin Bypass Limit (Confirm)</button>
      </div>
    </div>
  `;
  modalOverlay.classList.add("active");
}

async function triggerPendingRegister(payload) {
  payload.rsvp = "Pending";
  try {
    await guestService.createGuest(payload, false);
    showToast(`Guest profile saved for ${payload.name} (Pending)!`, "success");
    resetForm('guestEntryForm');
    refreshDataViews();
  } catch (err) {
    showToast(err.formattedMessage || "Registration failed.", "error");
  }
}

async function triggerAdminBypass(payload) {
  payload.notes += " (Capacity Limit Overridden by Admin)";
  try {
    await guestService.createGuest(payload, true); // override = true
    showToast(`Guest profile forced-confirmed for ${payload.name}!`, "success");
    resetForm('guestEntryForm');
    refreshDataViews();
  } catch (err) {
    showToast(err.formattedMessage || "Bypass override failed.", "error");
  }
}

async function deleteGuest(id) {
  const guest = db.guests.find(g => g.id === id);
  if (!guest) return;

  if (confirm(`Are you sure you want to remove guest: "${guest.name}"?`)) {
    try {
      await guestService.deleteGuest(id);
      showToast("Guest profile deleted successfully.", "warning");
      refreshDataViews();
    } catch (err) {
      showToast(err.formattedMessage || "Delete failed", "error");
    }
  }
}

function filterGuestsTable() {
  const query = document.getElementById("guestSearchInput").value.toLowerCase();
  const eventFilter = document.getElementById("guestTableEventFilter").value;
  const rsvpFilter = document.getElementById("guestTableRsvpFilter").value;
  const vipFilter = document.getElementById("guestTableVipFilter").value;
  const rows = document.querySelectorAll("#registryGuestsTableBody tr");

  rows.forEach((row, index) => {
    const guest = db.guests[index];
    if (!guest) return;

    const matchesQuery = guest.name.toLowerCase().includes(query) || 
                         guest.phone.includes(query) || 
                         guest.email.toLowerCase().includes(query);
                         
    const matchesEvent = eventFilter === "All" || guest.event_id === eventFilter;
    const matchesRsvp = rsvpFilter === "All" || guest.rsvp === rsvpFilter;
    const matchesVip = vipFilter === "All" || guest.vip === vipFilter;

    if (matchesQuery && matchesEvent && matchesRsvp && matchesVip) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });
}

// ==========================================
// 9. LIVE EVENT DAY COORDINATION BOARD
// ==========================================

function loadCoordinationData() {
  const select = document.getElementById("coordinationEventSelect");
  if (!select) return;

  const activeEvents = db.events.filter(e => e.status !== "Completed");
  
  select.innerHTML = activeEvents.map(e => `
    <option value="${e.id}">${e.name} (${e.date === '2026-06-12' ? 'TODAY' : e.date})</option>
  `).join('');

  if (activeEvents.length > 0) {
    if (!currentCoordinationEventId || !activeEvents.find(e => e.id === currentCoordinationEventId)) {
      currentCoordinationEventId = activeEvents[0].id;
    }
    select.value = currentCoordinationEventId;
    loadCoordinationEventData();
  } else {
    document.getElementById("checkinChecklistList").innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted);">
        No live or upcoming events registered for coordination day today.
      </div>
    `;
    document.getElementById("liveSeatNumbers").innerText = "0 / 0";
  }
}

function loadCoordinationEventData() {
  currentCoordinationEventId = document.getElementById("coordinationEventSelect").value;
  const evt = db.events.find(e => e.id === currentCoordinationEventId);
  if (!evt) return;

  // Sync title / status badge
  const badge = document.getElementById("coordinationStatusBadge");
  if (evt.status === "Live") {
    badge.innerHTML = `<span class="badge badge-emerald"><i class="fa-solid fa-circle-dot" style="margin-right: 4px; animation: flash 1s infinite alternate;"></i> Live Now</span>`;
  } else {
    badge.innerHTML = `<span class="badge badge-gold">Upcoming Event Day</span>`;
  }

  const eventGuests = db.guests.filter(g => g.event_id === evt.id);
  const checkedIn = eventGuests.filter(g => g.checked_in).length;
  
  // Seat metrics
  document.getElementById("liveSeatNumbers").innerText = `${checkedIn} / ${evt.capacity}`;
  
  // Update progress bar
  const pct = evt.capacity > 0 ? Math.min((checkedIn / evt.capacity) * 100, 100) : 0;
  const bar = document.getElementById("liveCapacityProgressBar");
  bar.style.width = `${pct}%`;
  
  const subText = document.getElementById("liveCapacitySub");
  if (pct >= 90) {
    subText.innerText = "VIP CAPACITY ALERT: Store showroom layout limits reached!";
    subText.className = "checklist-meta danger";
  } else if (pct >= 75) {
    subText.innerText = "WARNING: Room space filling up fast.";
    subText.className = "checklist-meta";
    subText.style.color = "var(--status-warning)";
  } else {
    subText.innerText = "Showroom capacity normal. Space fits all guests.";
    subText.className = "checklist-meta";
    subText.style.color = "var(--text-muted)";
  }

  document.getElementById("btnCheckinCount").innerText = checkedIn;

  buildCheckinList();
  buildLiveFeed();
}

function buildCheckinList() {
  const container = document.getElementById("checkinChecklistList");
  const query = document.getElementById("checkinSearchInput").value.toLowerCase();
  
  const eventGuests = db.guests.filter(g => g.event_id === currentCoordinationEventId);
  
  if (eventGuests.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted);">
        No guests registered under this event list yet.
      </div>
    `;
    return;
  }

  const filtered = eventGuests.filter(g => {
    const matchesQuery = g.name.toLowerCase().includes(query);
    if (!matchesQuery) return false;
    
    if (currentCheckinStatusFilter === "All") return true;
    if (currentCheckinStatusFilter === "Confirmed") return g.rsvp === "Confirmed";
    if (currentCheckinStatusFilter === "Checked In") return g.checked_in;
    if (currentCheckinStatusFilter === "Absent") return g.rsvp === "Confirmed" && !g.checked_in;
    
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-muted);">
        No guests match criteria.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(g => {
    let vipBadge = "badge-vip-regular";
    if (g.vip === "Elite") vipBadge = "badge-vip-elite";
    if (g.vip === "Gold") vipBadge = "badge-vip-gold";

    return `
      <div class="checklist-item">
        <div class="checklist-details">
          <span class="checklist-name">
            ${g.name} 
            <span class="badge ${vipBadge}" style="font-size: 0.65rem; padding: 2px 6px;">${g.vip}</span>
          </span>
          <span class="checklist-meta">
            ${g.phone} | <span style="font-style: italic; color: var(--primary-emerald);">${g.notes || 'No notes'}</span>
          </span>
          ${g.checked_in ? `<span style="font-size: 0.75rem; color: var(--status-success); font-weight: bold; margin-top: 4px;"><i class="fa-solid fa-clock"></i> Checked in at ${g.checkin_time}</span>` : ''}
        </div>
        <div>
          ${g.checked_in ? `
            <button class="btn btn-secondary btn-sm" style="color: var(--status-danger); border-color: var(--status-danger);" onclick="toggleGuestCheckin('${g.id}', false)">
              Cancel Check-in
            </button>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="toggleGuestCheckin('${g.id}', true)">
              Mark Check-in <i class="fa-solid fa-user-check"></i>
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function filterCheckinStatus(filterName) {
  currentCheckinStatusFilter = filterName;
  buildCheckinList();
}

function filterCheckinList() {
  buildCheckinList();
}

async function toggleGuestCheckin(guestId, status) {
  const today = new Date();
  const timeStr = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

  try {
    const res = await guestService.toggleCheckIn(guestId, status, status ? timeStr : null);
    
    // Broadcast status to other admin tabs via Socket WebSockets
    if (socket) {
      socket.emit('guest_checkin_update', {
        eventId: currentCoordinationEventId,
        guestId: guestId,
        name: res.name,
        checkedIn: status,
        checkin_time: status ? timeStr : null
      });
    }

    showToast(status ? `${res.name} checked in successfully!` : `Cancelled check-in for ${res.name}.`, status ? "success" : "info");
    refreshDataViews();
  } catch (err) {
    showToast(err.formattedMessage || "Check-in modification failed", "error");
  }
}

function triggerSocialBuzz(type) {
  const evt = db.events.find(e => e.id === currentCoordinationEventId);
  if (!evt) return;

  let text = "";
  if (type === "opening") {
    text = `✨ LIVE FROM TANVI BOUTIQUE ✨\nThe doors are officially open for our exclusive ${evt.name} featuring ${evt.designer}! Ready to welcome our VIP guests to this styling experience. Stay tuned! #TanviBoutique #DesignerEthnic #TrunkShow`;
  } else if (type === "styling") {
    const checkedInGuests = db.guests.filter(g => g.event_id === currentCoordinationEventId && g.checked_in);
    if (checkedInGuests.length === 0) {
      showToast("No guests checked in yet to assign styling consultants.", "warning");
      return;
    }
    const stylists = ["Aanya", "Priyanka", "Vikram"];
    let assignments = "";
    checkedInGuests.forEach((g, index) => {
      const assignedStylist = stylists[index % stylists.length];
      assignments += `\n• ${g.name} ➔ Personal Stylist: ${assignedStylist} (Salon Suite ${index + 1})`;
    });
    
    text = `🎨 STYLING ASSIGNMENT UPDATES 🎨\nAssigning professional drape styling specialists for active consults:${assignments}\n#TanviBoutique #OccasionWearConsultation`;
  } else {
    text = `🔥 HIGH FASHION LOOK OF THE DAY 🔥\nShowcasing gorgeous designs from ${evt.designer}'s new collection. Best-seller of the session matches are flying off our shelves. Drop in to witness the draping consulting! #ExclusiveSarees #BanarasiSilk`;
  }

  navigator.clipboard.writeText(text).then(() => {
    showToast("Copy-paste ready social buzz template copied to clipboard!", "success");
    refreshDataViews();
  }).catch(err => {
    alert("Buzz template: \n\n" + text);
  });
}

async function buildLiveFeed() {
  const container = document.getElementById("coordinationFeedList");
  if (!container) return;

  try {
    const logsRes = await apiClient.get('/audit-logs');
    const checkinLogs = logsRes.data
      .filter(log => log.action.includes("Guest Checked") || log.action.includes("Check-in") || log.action.includes("Social"))
      .slice(0, 10);

    if (checkinLogs.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 12px; font-size: 0.8rem;">No activity log updates.</div>`;
      return;
    }

    container.innerHTML = checkinLogs.map(log => {
      const formattedTime = new Date(log.timestamp).toLocaleString();
      return `
        <div class="alert-item info" style="padding: 10px; margin-bottom: 4px;">
          <i class="fa-solid fa-clock-rotate-left" style="font-size: 0.9rem;"></i>
          <div class="alert-content">
            <p style="font-size: 0.8rem;"><strong>${log.action}</strong>: ${log.details}</p>
            <span class="alert-time">${formattedTime}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load activity feed:', err);
  }
}

// ==========================================
// 10. ROI ANALYTICS & REPORT EXPORTER
// ==========================================

async function loadAnalyticsData() {
  try {
    const res = await apiClient.get('/analytics');
    const analytics = res.data;
    
    // Draw charts using backend arrays coordinates
    renderAnalyticsCharts(analytics);
  } catch (err) {
    showToast(err.formattedMessage || "Analytics failed to load", "error");
  }
}

function renderAnalyticsCharts(data) {
  const ctxLine = document.getElementById("analyticsConversionChart");
  if (ctxLine && data) {
    if (charts.lineTrend) charts.lineTrend.destroy();
    
    // Truncate labels for charts readability
    const shortLabels = data.lineChart.labels.map(l => l.substring(0, 15) + '...');

    charts.lineTrend = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: shortLabels,
        datasets: [
          {
            label: 'Confirmed RSVPs',
            data: data.lineChart.confirmed,
            borderColor: '#D4AF37',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Checked-In Attendees',
            data: data.lineChart.checkedIn,
            borderColor: '#0A3C30',
            backgroundColor: 'rgba(10, 60, 48, 0.1)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Inter' } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  const ctxBar = document.getElementById("analyticsLabelsBarChart");
  if (ctxBar && data) {
    if (charts.barDesigner) charts.barDesigner.destroy();

    charts.barDesigner = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: data.barChart.designers,
        datasets: [{
          label: 'Total Clients Registered',
          data: data.barChart.counts,
          backgroundColor: '#0A3C30',
          borderColor: '#D4AF37',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 2 } }
        }
      }
    });
  }
}

async function exportDataReport() {
  const type = document.getElementById("reportType").value;
  let filename = "tanvi_boutique_report.csv";

  if (type === "events") {
    filename = "boutique_events_registry.csv";
  } else if (type === "guests") {
    filename = "boutique_guest_rsvps.csv";
  } else {
    filename = "tanvi_boutique_database_dump.csv";
  }

  try {
    showToast("Compiling export files... Please wait.", "info");
    
    // Fetch blob securely using Axios (attaches Authorization Bearer token header)
    const res = await apiClient.get(`/reports/export?source=${type}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    showToast(`Spreadsheet exported: ${filename}`, "success");
  } catch (err) {
    showToast(err.formattedMessage || "Export compilation failed.", "error");
  }
}

// ==========================================
// 11. SYSTEM SETTINGS & AUDIT LOGS
// ==========================================

function loadSettingsData() {
  document.getElementById("ruleVipWarningPercent").value = db.rules.vipWarningPercent;
  document.getElementById("ruleMinAdvanceDays").value = db.rules.minAdvanceDays;
  document.getElementById("ruleMaxEliteRsvps").value = db.rules.maxEliteRsvps;

  renderAuditLogs();
}

async function renderAuditLogs() {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;

  try {
    const res = await apiClient.get('/audit-logs');
    tbody.innerHTML = res.data.map(log => {
      const formattedTime = new Date(log.timestamp).toLocaleString();
      return `
        <tr>
          <td style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-history"></i> ${formattedTime}</td>
          <td><strong>${log.user}</strong></td>
          <td><span class="badge badge-outline">${log.action}</span></td>
          <td style="font-size: 0.85rem;">${log.details}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Audit logs loading failed:', err);
  }
}

async function saveSystemRules() {
  const currentUser = JSON.parse(localStorage.getItem('tb_user') || '{}');
  
  if (currentUser.role !== "Admin") {
    showToast("Access Denied: Admin role privileges required.", "error");
    return;
  }

  const vipWarningPercent = parseInt(document.getElementById("ruleVipWarningPercent").value);
  const minAdvanceDays = parseInt(document.getElementById("ruleMinAdvanceDays").value);
  const maxEliteRsvps = parseInt(document.getElementById("ruleMaxEliteRsvps").value);

  try {
    // Call API updates sequentially
    await ruleService.updateRule("vipWarningPercent", vipWarningPercent);
    await ruleService.updateRule("minAdvanceDays", minAdvanceDays);
    await ruleService.updateRule("maxEliteRsvps", maxEliteRsvps);

    // Emit Socket rule updates trigger
    if (socket) {
      socket.emit('rules_updated');
    }

    showToast("Boutique capacity limits rules updated!", "success");
    refreshDataViews();
  } catch (err) {
    showToast(err.formattedMessage || "Failed to update rules", "error");
  }
}

async function resetRulesToDefault() {
  const currentUser = JSON.parse(localStorage.getItem('tb_user') || '{}');
  if (currentUser.role !== "Admin") {
    showToast("Access Denied: Admin privileges required.", "error");
    return;
  }

  try {
    await ruleService.updateRule("vipWarningPercent", 90);
    await ruleService.updateRule("minAdvanceDays", 3);
    await ruleService.updateRule("maxEliteRsvps", 25);
    
    if (socket) {
      socket.emit('rules_updated');
    }
    
    showToast("Default rule bounds restored.", "info");
    refreshDataViews();
  } catch (err) {
    showToast(err.formattedMessage || "Failed to restore defaults", "error");
  }
}

async function clearAuditLogs() {
  if (confirm("Are you sure you want to truncate the system event history? This action is permanent.")) {
    try {
      await apiClient.delete('/audit-logs');
      showToast("Audit logs database truncated.", "warning");
      renderAuditLogs();
    } catch (err) {
      showToast(err.formattedMessage || "Logs clearance failed", "error");
    }
  }
}

// ==========================================
// 12. POPUP MODALS & INFO LOGS
// ==========================================

function openAlertsModal() {
  const overlay = document.getElementById("alertsModalOverlay");
  const list = document.getElementById("alertsModalList");
  if (!overlay || !list) return;
  
  if (db.alerts.length === 0) {
    list.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--text-muted);">No active system alerts.</p>`;
  } else {
    list.innerHTML = db.alerts.map(alt => `
      <div class="alert-item ${alt.type}" style="margin-bottom: 0;">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div class="alert-content">
          <p>${alt.message}</p>
        </div>
      </div>
    `).join('');
  }
  overlay.classList.add("active");
}

function closeAlertsModal() {
  document.getElementById("alertsModalOverlay").classList.remove("active");
}

async function showEventDetails(eventId) {
  const overlay = document.getElementById("detailsModalOverlay");
  const title = document.getElementById("detailsModalTitle");
  const content = document.getElementById("detailsModalContent");
  
  try {
    const evt = await eventService.getEventById(eventId);
    const eventGuests = db.guests.filter(g => g.event_id === evt.id);
    const confirmed = eventGuests.filter(g => g.rsvp === "Confirmed").length;
    const pending = eventGuests.filter(g => g.rsvp === "Pending").length;
    const checkedIn = eventGuests.filter(g => g.checked_in).length;

    title.innerText = "Event Details & Capacity Status";
    content.innerHTML = `
      <div style="font-family: var(--font-sans);">
        <h4 style="font-size: 1.25rem; color: var(--primary-emerald-dark); margin-bottom: 8px;">${evt.name}</h4>
        <span class="badge ${evt.type === 'Trunk Show' ? 'badge-gold' : 'badge-emerald'}" style="margin-bottom: 16px;">${evt.type}</span>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 0.9rem;">
          <div><strong>Date & Time:</strong><br>${evt.date} at ${evt.time}</div>
          <div><strong>Featured Brand/Designer:</strong><br>${evt.designer}</div>
          <div><strong>Boutique Showroom Capacity:</strong><br>${evt.capacity} spaces limit</div>
          <div><strong>Active Registry Status:</strong><br><span class="badge badge-outline">${evt.status}</span></div>
        </div>

        <div style="background-color: var(--bg-cream); padding: 16px; border-radius: var(--border-radius-md); margin-bottom: 20px;">
          <h5 style="margin-bottom: 8px; font-size: 0.95rem;">Showroom Draping Notes & Guidelines</h5>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${evt.notes || 'No notes specified.'}</p>
        </div>

        <h5 style="margin-bottom: 10px; font-size: 0.95rem;">Registry Summary Metric Rates</h5>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center;">
          <div style="border: 1px solid var(--border-color); padding: 8px; border-radius: var(--border-radius-sm);">
            <span style="font-size: 0.75rem; color: var(--text-muted);">CONFIRMED</span>
            <div style="font-size: 1.2rem; font-weight: bold; color: var(--primary-emerald);">${confirmed}</div>
          </div>
          <div style="border: 1px solid var(--border-color); padding: 8px; border-radius: var(--border-radius-sm);">
            <span style="font-size: 0.75rem; color: var(--text-muted);">PENDING</span>
            <div style="font-size: 1.2rem; font-weight: bold; color: var(--accent-gold-dark);">${pending}</div>
          </div>
          <div style="border: 1px solid var(--border-color); padding: 8px; border-radius: var(--border-radius-sm);">
            <span style="font-size: 0.75rem; color: var(--text-muted);">CHECKED-IN</span>
            <div style="font-size: 1.2rem; font-weight: bold; color: var(--status-success);">${checkedIn}</div>
          </div>
        </div>
      </div>
    `;
    overlay.classList.add("active");
  } catch (err) {
    showToast("Could not load event details", "error");
  }
}

function showGuestDetails(guestId) {
  const overlay = document.getElementById("detailsModalOverlay");
  const title = document.getElementById("detailsModalTitle");
  const content = document.getElementById("detailsModalContent");

  const g = db.guests.find(gst => gst.id === guestId);
  if (!g) return;

  const evt = db.events.find(e => e.id === g.event_id);
  const eventName = evt ? evt.name : "Unassigned";

  title.innerText = "Client Guest Card & History";
  content.innerHTML = `
    <div style="font-family: var(--font-sans);">
      <h4 style="font-size: 1.25rem; color: var(--primary-emerald-dark); margin-bottom: 4px;">${g.name}</h4>
      <div style="margin-bottom: 16px;">
        <span class="badge ${g.vip === 'Elite' ? 'badge-vip-elite' : g.vip === 'Gold' ? 'badge-vip-gold' : 'badge-vip-regular'}">${g.vip} VIP</span>
        <span class="badge ${g.rsvp === 'Confirmed' ? 'badge-emerald' : 'badge-outline'}" style="margin-left: 6px;">RSVP: ${g.rsvp}</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 0.9rem;">
        <div><strong>Assigned Boutique Event:</strong><br>${eventName}</div>
        <div><strong>Contact Number:</strong><br>${g.phone}</div>
        <div><strong>Email Address:</strong><br>${g.email}</div>
        <div><strong>Live Attendance:</strong><br>${g.checked_in ? `<span style="color:var(--status-success)">Checked-in at ${g.checkin_time}</span>` : 'Not Checked-In'}</div>
      </div>

      <div style="background-color: var(--bg-cream); padding: 16px; border-radius: var(--border-radius-md);">
        <h5 style="margin-bottom: 8px; font-size: 0.95rem;">Client Silhouette & Drape Preferences</h5>
        <p style="font-size: 0.85rem; color: var(--text-muted);">${g.notes || 'No sizing or designer preferences registered.'}</p>
      </div>
    </div>
  `;
  overlay.classList.add("active");
}

function closeDetailsModal() {
  document.getElementById("detailsModalOverlay").classList.remove("active");
}

function resetForm(formId) {
  document.getElementById(formId).reset();
  showToast("Form details cleared.", "info");
}

// ==========================================
// 13. APP RUN TRIGGER
// ==========================================

window.addEventListener("DOMContentLoaded", async () => {
  // 1. PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('PWA Service Worker loaded.'))
      .catch(err => console.log('Service worker fail:', err));
  }

  // Check if already authenticated via token cache
  const cachedToken = localStorage.getItem('tb_token');
  const cachedUser = JSON.parse(localStorage.getItem('tb_user') || 'null');
  
  if (cachedToken && cachedUser) {
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("userName").innerText = cachedUser.name;
    document.getElementById("userAvatar").innerText = cachedUser.name.charAt(0);
    document.getElementById("userRoleBadge").innerText = `${cachedUser.role} Role`;
    
    connectSocket();
    switchView("dashboard");
  } else {
    // Show login overlay
    document.getElementById("loginOverlay").style.display = "flex";
  }
});

// ==========================================
// 14. ENTERPRISE UPGRADES ADDITIONAL MODULES
// ==========================================

// --- Multi-Branch Manager ---
function changeBranch() {
  currentBranch = document.getElementById("branchSelect").value;
  showToast(`Switched active branch view to: ${currentBranch}`, "info");
  refreshDataViews();
}

// --- Multi-Language i18n Translation Dictionary ---
let currentLang = "en";
const translations = {
  en: {
    dashboard: "Fashion Suite Dashboard",
    scheduler: "Event Scheduler Registry",
    guests: "Guest List & RSVP Manager",
    coordination: "Live Event Day Coordination",
    analytics: "ROI Analytics & Reports",
    settings: "System Rules & Settings",
    inventory: "Inventory Management Portal",
    signout: "Sign Out",
    welcome: "Welcome back",
    search: "Search"
  },
  hi: {
    dashboard: "बौतिक इवेंट्स डैशबोर्ड",
    scheduler: "नया इवेंट शिड्यूल करें",
    guests: "अतिथि और आमंत्रण मैनेजर",
    coordination: "लाइव शोरूम चेक-इन",
    analytics: "आय विश्लेषण और रिपोर्ट",
    settings: "सिस्टम सेटिंग्स एवं नियम",
    inventory: "इन्वेंट्री प्रबंधन पोर्टल",
    signout: "साइन आउट",
    welcome: "स्वागत है",
    search: "खोजें"
  },
  es: {
    dashboard: "Panel de Eventos Boutique",
    scheduler: "Programar Nuevo Evento",
    guests: "Registro de Invitados RSVP",
    coordination: "Coordinación y Check-In",
    analytics: "Análisis y Reportes de ROI",
    settings: "Configuración del Sistema",
    inventory: "Portal de Inventario",
    signout: "Cerrar Sesión",
    welcome: "Bienvenido de nuevo",
    search: "Buscar"
  }
};

function changeLanguage() {
  currentLang = document.getElementById("langSelect").value;
  showToast(`Language updated to: ${currentLang === 'hi' ? 'Hindi' : currentLang === 'es' ? 'Spanish' : 'English'}`, "info");
  
  // Apply translation changes to sidebar
  const dict = translations[currentLang];
  document.getElementById("nav-dashboard").querySelector("a").innerHTML = `<i class="fa-solid fa-chart-line"></i> ${dict.dashboard}`;
  document.getElementById("nav-scheduler").querySelector("a").innerHTML = `<i class="fa-solid fa-calendar-plus"></i> ${dict.scheduler}`;
  document.getElementById("nav-guests").querySelector("a").innerHTML = `<i class="fa-solid fa-users"></i> ${dict.guests}`;
  document.getElementById("nav-coordination").querySelector("a").innerHTML = `<i class="fa-solid fa-clipboard-user"></i> ${dict.coordination}`;
  document.getElementById("nav-analytics").querySelector("a").innerHTML = `<i class="fa-solid fa-chart-pie"></i> ${dict.analytics}`;
  document.getElementById("nav-inventory").querySelector("a").innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> ${dict.inventory}`;
  document.getElementById("nav-settings").querySelector("a").innerHTML = `<i class="fa-solid fa-sliders"></i> ${dict.settings}`;
  
  const headerTitle = document.getElementById("currentViewTitle");
  if (headerTitle) {
    headerTitle.innerText = dict[currentView] || "Boutique Suite";
  }
}

// --- QR Scan Ticket Check-in Simulator ---
function openQRScanModal() {
  const overlay = document.getElementById("qrScanModalOverlay");
  const select = document.getElementById("qrScanGuestSelect");
  
  // Load checked-in candidates
  const eventGuests = db.guests.filter(g => g.event_id === currentCoordinationEventId && !g.checked_in && g.rsvp === 'Confirmed');
  if (eventGuests.length === 0) {
    select.innerHTML = `<option value="">No pending confirmed RSVP guests</option>`;
  } else {
    select.innerHTML = eventGuests.map(g => `<option value="${g.id}">${g.name} (ID: ${g.id})</option>`).join('');
  }
  overlay.classList.add("active");
}

function closeQRScanModal() {
  document.getElementById("qrScanModalOverlay").classList.remove("active");
}

// Synthesize Beep Sound for scan confirmation via Web Audio API
function playScanChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5 beep
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15); // Quick decay

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.log("Audio play failed:", e);
  }
}

async function simulateQRScan() {
  const guestId = document.getElementById("qrScanGuestSelect").value;
  if (!guestId) {
    showToast("No guest selected to simulate QR scan ticket.", "warning");
    return;
  }
  
  playScanChime();
  closeQRScanModal();
  
  // Call check-in route
  await toggleGuestCheckin(guestId, true);
}

// --- AI Styling recommendations and orders ---
// Intercept showGuestDetails to add AI styling panel
const originalShowGuestDetails = showGuestDetails;
showGuestDetails = async function(guestId) {
  originalShowGuestDetails(guestId);
  
  const content = document.getElementById("detailsModalContent");
  
  // Add styling recommendations block
  content.innerHTML += `
    <div style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 16px;">
      <h5 style="margin-bottom: 12px; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
        <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-gold);"></i> AI styling recommendations matching preferences
      </h5>
      <div id="aiRecommendationsLoader" style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 10px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Running match recommendations...
      </div>
      <div id="aiRecommendationsList" style="display: flex; flex-direction: column; gap: 10px;"></div>
    </div>
  `;

  try {
    const res = await apiClient.get(`/recommendations/products?guest_id=${guestId}`);
    document.getElementById("aiRecommendationsLoader").style.display = "none";
    const list = document.getElementById("aiRecommendationsList");

    if (res.data.length === 0) {
      list.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 10px;">No fitting recommendation profiles identified for this user preferences notes.</div>`;
      return;
    }

    list.innerHTML = res.data.map(rec => `
      <div style="background: var(--bg-cream); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); padding: 12px; display: flex; gap: 12px; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <img src="${rec.product.image || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100'}" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;">
          <div>
            <div style="font-size: 0.85rem; font-weight: bold; color: var(--text-dark);">${rec.product.title}</div>
            <div style="font-size: 0.75rem; color: var(--primary-emerald-dark); font-weight: 600;">INR ${rec.product.price.toLocaleString()} | Stock: ${rec.product.stock}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 4px;">AI Reason: ${rec.reason}</div>
          </div>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 4px 8px;" onclick="initiatePaymentGateway(${rec.product.id}, ${rec.product.price}, '${rec.product.title.replace(/'/g, "\\'")}')">
            Buy Now <i class="fa-solid fa-credit-card"></i>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById("aiRecommendationsLoader").innerText = "Failed loading AI suggestions.";
  }
};

// --- Stripe Online Payment Gateway Checkout Modal ---
function initiatePaymentGateway(productId, price, title) {
  closeDetailsModal();
  
  const modalOverlay = document.getElementById("detailsModalOverlay");
  const modalTitle = document.getElementById("detailsModalTitle");
  const content = document.getElementById("detailsModalContent");

  modalTitle.innerHTML = `<i class="fa-solid fa-credit-card" style="color: var(--primary-emerald);"></i> Secure Online Checkout Payment Gateway`;
  content.innerHTML = `
    <div style="font-family: var(--font-sans); padding: 10px 0;">
      <p style="margin-bottom: 12px; font-size: 0.95rem;">Purchasing item: <strong>${title}</strong></p>
      <div style="background: var(--bg-cream); padding: 12px; border-radius: var(--border-radius-sm); font-size: 1.15rem; font-weight: bold; color: var(--primary-emerald-dark); margin-bottom: 20px; text-align: center;">
        INR ${price.toLocaleString()} Total Invoice
      </div>
      <form id="stripePaymentForm" onsubmit="executeGatewayCheckout(event, ${productId})">
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" for="cardholderName">Cardholder Name</label>
          <input type="text" id="cardholderName" class="form-control" placeholder="e.g. Radhika Merchant" value="Radhika Merchant" required>
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
          <label class="form-label" for="cardNumber">Credit Card Number</label>
          <input type="text" id="cardNumber" class="form-control" placeholder="4111 2222 3333 4444" value="4111 2222 3333 4444" required>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div class="form-group">
            <label class="form-label" for="cardExpiry">Expiration Date</label>
            <input type="text" id="cardExpiry" class="form-control" placeholder="MM/YY" value="06/30" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="cardCVV">CVV Security Code</label>
            <input type="password" id="cardCVV" class="form-control" placeholder="123" value="123" required>
          </div>
        </div>
        <div id="checkoutFeedbackMsg" style="display:none; text-align: center; margin-bottom: 16px; font-weight: 500; font-size: 0.85rem; color: var(--primary-emerald-dark);">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Contacting Secure Bank Gateway (Stripe)...
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 12px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeDetailsModal()">Cancel Checkout</button>
          <button type="submit" class="btn btn-primary btn-sm" id="btnCapturePayment">Confirm & Transact Payment</button>
        </div>
      </form>
    </div>
  `;
  
  modalOverlay.classList.add("active");
}

async function executeGatewayCheckout(event, productId) {
  event.preventDefault();
  
  const feedback = document.getElementById("checkoutFeedbackMsg");
  const btn = document.getElementById("btnCapturePayment");
  feedback.style.display = "block";
  btn.disabled = true;
  
  const cardNumber = document.getElementById("cardNumber").value.trim();
  const last4 = cardNumber.slice(-4) || "4444";

  try {
    // 1. Create order
    const orderRes = await orderService.createOrder([{ product_id: productId, quantity: 1 }]);
    const orderId = orderRes.id;
    
    // 2. Call checkout route
    const checkoutRes = await apiClient.post(`/orders/${orderId}/checkout`, {
      payment_method: "Stripe Gateway Credit Card",
      card_last4: last4
    });
    
    feedback.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--status-success); margin-right: 6px;"></i> Payment Captured Successfully! Creating Ticket...`;
    
    // Quick delay for immersive UX
    setTimeout(() => {
      closeDetailsModal();
      showToast(`Stripe Invoice settled successfully! Transaction: ${checkoutRes.data.transaction_id}`, "success");
      
      // Auto-trigger simulated WhatsApp alert
      const user = JSON.parse(localStorage.getItem('tb_user') || '{}');
      if (user.id) {
        apiClient.post('/notifications/send', {
          guest_id: "gst-01", // Simulate Radhika Merchant
          channel: "whatsapp",
          message: `Dear Radhika, your payment of INR ${checkoutRes.data.amount.toLocaleString()} is confirmed. Your custom draping consult slot is secured.`
        }).then(() => console.log("WhatsApp seeder check dispatched."));
      }

      refreshDataViews();
    }, 1800);
  } catch (err) {
    feedback.innerText = err.formattedMessage || "Credit transaction failed.";
    btn.disabled = false;
  }
}

// --- Inventory Manager Controller ---
function loadInventoryData() {
  renderInventoryTable();
}

function renderInventoryTable() {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;

  if (db.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No inventory items registered in this branch.</td></tr>`;
    return;
  }

  tbody.innerHTML = db.products.map(prod => {
    let statusClass = prod.stock > 0 ? "badge-emerald" : "badge-outline";
    return `
      <tr>
        <td>
          <div style="display:flex; gap: 8px; align-items: center;">
            <img src="${prod.image || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=100'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">
            <strong>${prod.title}</strong>
          </div>
        </td>
        <td>${prod.category}</td>
        <td>INR ${prod.price.toLocaleString()}</td>
        <td>${prod.stock} items left</td>
        <td><span class="badge ${statusClass}">${prod.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" style="color: var(--status-danger);" onclick="deleteProduct(${prod.id})">
            <i class="fa-regular fa-trash-can"></i> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function handleProductSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById("prodTitle").value.trim();
  const price = parseFloat(document.getElementById("prodPrice").value);
  const category = document.getElementById("prodCategory").value;
  const stock = parseInt(document.getElementById("prodStock").value);
  const description = document.getElementById("prodDescription").value.trim();

  const payload = {
    title,
    price,
    category,
    stock,
    description,
    image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500",
    status: stock > 0 ? "Available" : "Out of Stock",
    branch: currentBranch
  };

  try {
    await productService.createProduct(payload);
    showToast(`Product '${title}' successfully registered.`, "success");
    resetForm('productEntryForm');
    refreshDataViews();
  } catch (err) {
    showToast(err.formattedMessage || "Product registration failed.", "error");
  }
}

async function deleteProduct(id) {
  if (confirm("Delete this product entry permanently from inventory?")) {
    try {
      await productService.deleteProduct(id);
      showToast("Product deleted successfully.", "warning");
      refreshDataViews();
    } catch (err) {
      showToast(err.formattedMessage || "Delete failed", "error");
    }
  }
}

// --- Cloud Backup History controller ---
async function loadBackupHistory() {
  try {
    const res = await apiClient.get('/backup/history');
    const tbody = document.getElementById("backupHistoryBody");
    if (!tbody) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">No cloud backups saved.</td></tr>`;
      return;
    }

    tbody.innerHTML = res.data.map(bk => `
      <tr>
        <td><strong>${bk.filename}</strong></td>
        <td>${bk.size_bytes.toLocaleString()} bytes</td>
        <td>${new Date(bk.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-gold btn-sm" onclick="restoreCloudBackup('${bk.filename}')">
            Restore Backup <i class="fa-solid fa-cloud-arrow-down"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Backup history fetch failed:', err);
  }
}

async function triggerCloudBackup() {
  try {
    showToast("Compiling database tables and duplicating snapshot to cloud...", "info");
    const res = await apiClient.post('/backup/create');
    showToast(res.data.message, "success");
    loadBackupHistory();
    renderAuditLogs();
  } catch (err) {
    showToast(err.formattedMessage || "Cloud backup failed.", "error");
  }
}

async function restoreCloudBackup(filename) {
  if (confirm(`CRITICAL WARNING: Restoring backup ${filename} will overwrite the current database. Proceed?`)) {
    try {
      showToast("Overwriting tables and restoring snapshot...", "warning");
      const res = await apiClient.post(`/backup/restore?filename=${filename}`);
      showToast(res.data.message, "success");
      refreshDataViews();
      renderAuditLogs();
    } catch (err) {
      showToast(err.formattedMessage || "Snapshot restore failed.", "error");
    }
  }
}

// Load cloud backup history when Settings opens
const originalLoadSettingsData = loadSettingsData;
loadSettingsData = function() {
  originalLoadSettingsData();
  loadBackupHistory();
};

// --- Predictive Analytics Dashboard Builder ---
const originalLoadAnalyticsData = loadAnalyticsData;
loadAnalyticsData = async function() {
  originalLoadAnalyticsData();
  
  try {
    const res = await apiClient.get('/dashboard/predictive');
    const pred = res.data;
    
    // Render predicted turnout list
    const tbody = document.getElementById("predictiveTurnoutBody");
    if (tbody) {
      if (pred.turnoutForecast.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No predictive data.</td></tr>`;
      } else {
        tbody.innerHTML = pred.turnoutForecast.map(evt => {
          let riskBadge = "badge-emerald";
          if (evt.overload_risk === "Critical") riskBadge = "badge-outline"; // custom color warnings
          if (evt.overload_risk === "Medium") riskBadge = "badge-gold";
          
          return `
            <tr>
              <td><strong>${evt.event_name}</strong></td>
              <td>${evt.confirmed_rsvps} confirmed</td>
              <td><span style="font-weight: bold; color: var(--primary-emerald);">${evt.predicted_attendance} guests</span> predicted</td>
              <td><span class="badge ${riskBadge}">${evt.overload_risk} Risk</span></td>
            </tr>
          `;
        }).join('');
      }
    }
    
    // Fill text labels
    document.getElementById("predPeakTraffic").innerText = pred.peakTrafficHour;
    document.getElementById("predTopDesigner").innerText = pred.topTrendingDesigner;
    document.getElementById("forecastConfidence").innerText = `AI Engine: ${pred.historicalConfidenceScore}% Confidence`;
    
  } catch (err) {
    console.error("Predictive analytics pull failed:", err);
  }
};

