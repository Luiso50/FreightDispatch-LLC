document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const apiBaseUrl = window.LOADTWIN_API_URL || 'http://127.0.0.1:8000';
  const refreshButton = document.querySelector('#refresh-button');
  const errorBanner = document.querySelector('#error-banner');
  const connectionLabel = document.querySelector('#connection-label');
  const brokerForm = document.querySelector('#broker-form');
  const brokerFormStatus = document.querySelector('#broker-form-status');
  const loadForm = document.querySelector('#load-form');
  const loadFormStatus = document.querySelector('#load-form-status');

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(Number(value || 0));

  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  const renderMessages = (messages = []) => {
    const list = document.querySelector('#message-list');
    if (!messages.length) {
      list.innerHTML = '<div class="empty-state">No recent messages.</div>';
      return;
    }
    list.innerHTML = messages.map((message) => {
      const initial = (message.sender || '?').slice(-1);
      const timestamp = message.received_at ? new Date(message.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      return `<div class="message-item"><span class="message-avatar">${escapeHtml(initial)}</span><div><p>${escapeHtml(message.text)}</p><small>${escapeHtml(message.channel)} · ${escapeHtml(timestamp)}</small></div></div>`;
    }).join('');
  };

  const renderLoads = (loads = []) => {
    const list = document.querySelector('#load-list');
    if (!loads.length) {
      list.innerHTML = '<div class="load-placeholder"><div class="route-line"><span></span><i data-lucide="truck"></i><span></span></div><strong>No loads waiting</strong><p>Registered loads will appear here as they move through the operation.</p></div>';
      lucide.createIcons();
      return;
    }
    list.innerHTML = loads.slice(0, 5).map((load) => `<div class="load-row"><div class="load-route"><strong>${escapeHtml(load.origin.city)} → ${escapeHtml(load.destination.city)}</strong><small>${escapeHtml(load.equipment_type)} · ${escapeHtml(load.id)}</small></div><div class="load-meta"><strong>${load.offered_rate ? formatCurrency(load.offered_rate) : 'Rate pending'}</strong><small>${escapeHtml(load.origin.state)} / ${escapeHtml(load.destination.state)}</small></div><span class="load-status">${escapeHtml(load.status.replace('_', ' '))}</span></div>`).join('');
  };

  const renderDrivers = (drivers = []) => {
    const list = document.querySelector('#driver-list');
    if (!drivers.length) {
      list.innerHTML = '<div class="empty-state">No drivers registered.</div>';
      return;
    }
    list.innerHTML = drivers.slice(0, 5).map((driver) => {
      const initial = (driver.name || '?').slice(0, 2).toUpperCase();
      const equipment = driver.equipment_types?.join(', ') || 'Equipment pending';
      return `<div class="driver-row"><span class="driver-avatar">${escapeHtml(initial)}</span><div class="driver-info"><strong>${escapeHtml(driver.name)}</strong><small>${escapeHtml(equipment)}</small></div><span class="driver-status">${escapeHtml(driver.status)}</span></div>`;
    }).join('');
  };

  const renderBrokers = (brokers = []) => {
    const list = document.querySelector('#broker-list');
    if (!brokers.length) {
      list.innerHTML = '<div class="empty-state">No brokers registered.</div>';
      return;
    }
    list.innerHTML = brokers.slice(0, 6).map((broker) => {
      const rating = broker.internal_rating ? '★'.repeat(broker.internal_rating) : 'Rating pending';
      const contact = broker.contact_person || broker.email || broker.phone || 'Contact pending';
      return `<div class="broker-row"><strong>${escapeHtml(broker.name)}</strong><small>${escapeHtml(contact)}</small><small>${escapeHtml(broker.mc_number || 'MC pending')} · ${escapeHtml(broker.payment_terms || 'Terms pending')}</small><span class="broker-rating">${escapeHtml(rating)}</span></div>`;
    }).join('');
  };

  const loadSummary = async () => {
    refreshButton.classList.add('loading');
    errorBanner.hidden = true;
    try {
      const [summaryResponse, loadsResponse, renewalsResponse, driversResponse, brokersResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/dashboard/summary`),
        fetch(`${apiBaseUrl}/loads`),
        fetch(`${apiBaseUrl}/contracts/renewals?days=30`),
        fetch(`${apiBaseUrl}/drivers`),
        fetch(`${apiBaseUrl}/brokers`),
      ]);
      if (!summaryResponse.ok || !loadsResponse.ok || !renewalsResponse.ok || !driversResponse.ok || !brokersResponse.ok) throw new Error('Dashboard request failed');
      const [summary, loads, renewals, drivers, brokers] = await Promise.all([
        summaryResponse.json(), loadsResponse.json(), renewalsResponse.json(), driversResponse.json(), brokersResponse.json(),
      ]);
      setText('#active-drivers', summary.active_drivers);
      setText('#active-loads', summary.active_loads);
      setText('#revenue', formatCurrency(summary.revenue));
      setText('#pending-actions', Number(summary.pending_contracts) + Number(summary.pending_commissions));
      setText('#pending-contracts', summary.pending_contracts);
      setText('#pending-commissions', summary.pending_commissions);
      setText('#missing-documents', summary.missing_documents);
      setText('#contract-count', summary.pending_contracts);
      setText('#renewal-count', renewals.length);
      setText('#load-nav-count', summary.active_loads);
      renderLoads(loads);
      renderDrivers(drivers);
      renderBrokers(brokers);
      document.querySelector('#contract-progress').style.width = `${summary.pending_contracts ? 72 : 100}%`;
      renderMessages(summary.recent_messages);
      connectionLabel.textContent = 'Connected to API';
    } catch (error) {
      errorBanner.hidden = false;
      connectionLabel.textContent = 'API unavailable';
    } finally {
      refreshButton.classList.remove('loading');
    }
  };

  refreshButton.addEventListener('click', loadSummary);
  brokerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = brokerForm.querySelector('button');
    submitButton.disabled = true;
    brokerFormStatus.textContent = 'Saving...';
    try {
      const payload = Object.fromEntries(new FormData(brokerForm));
      const response = await fetch(`${apiBaseUrl}/brokers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Broker request failed');
      brokerForm.reset();
      brokerFormStatus.textContent = 'Broker added';
      await loadSummary();
    } catch (error) {
      brokerFormStatus.textContent = 'Could not save broker';
    } finally {
      submitButton.disabled = false;
    }
  });
  loadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = loadForm.querySelector('button');
    submitButton.disabled = true;
    loadFormStatus.textContent = 'Saving...';
    try {
      const values = Object.fromEntries(new FormData(loadForm));
      const payload = {
        id: `WEB-${Date.now()}`,
        origin: { city: values.origin_city, state: values.origin_state.toUpperCase() },
        destination: { city: values.destination_city, state: values.destination_state.toUpperCase() },
        equipment_type: values.equipment_type,
        offered_rate: values.offered_rate || null,
        status: 'available',
      };
      const response = await fetch(`${apiBaseUrl}/loads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Load request failed');
      loadForm.reset();
      loadFormStatus.textContent = 'Load added';
      await loadSummary();
    } catch (error) {
      loadFormStatus.textContent = 'Could not save load';
    } finally {
      submitButton.disabled = false;
    }
  });
  loadSummary();
});