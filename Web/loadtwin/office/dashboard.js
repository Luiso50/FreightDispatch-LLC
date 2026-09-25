document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const apiBaseUrl = window.LOADTWIN_API_URL || 'http://127.0.0.1:8000';
  const refreshButton = document.querySelector('#refresh-button');
  const errorBanner = document.querySelector('#error-banner');
  const connectionLabel = document.querySelector('#connection-label');
  const whatsappStatus = document.querySelector('#whatsapp-status');
  const brokerForm = document.querySelector('#broker-form');
  const brokerFormStatus = document.querySelector('#broker-form-status');
  const loadForm = document.querySelector('#load-form');
  const loadFormStatus = document.querySelector('#load-form-status');
  const driverForm = document.querySelector('#driver-form');
  const driverFormStatus = document.querySelector('#driver-form-status');
  const contractForm = document.querySelector('#contract-form');
  const contractFormStatus = document.querySelector('#contract-form-status');
  const evidenceForm = document.querySelector('#evidence-form');
  const evidenceFormStatus = document.querySelector('#evidence-form-status');
  const proposalForm = document.querySelector('#proposal-form');
  const proposalFormStatus = document.querySelector('#proposal-form-status');
  const caseForm = document.querySelector('#case-form');
  const caseFormStatus = document.querySelector('#case-form-status');
  const paymentForm = document.querySelector('#payment-form');
  const paymentFormStatus = document.querySelector('#payment-form-status');

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

  const renderProposals = (proposals = []) => {
    const list = document.querySelector('#proposal-list');
    if (!proposals.length) {
      list.innerHTML = '<div class="empty-state">No proposals sent.</div>';
      return;
    }
    list.innerHTML = proposals.slice(-8).reverse().map((proposal) => `<div class="proposal-row"><div><strong>${escapeHtml(proposal.load_id)}</strong><small>${escapeHtml(proposal.message)}</small></div><div><strong>${escapeHtml(proposal.driver_id)}</strong><small>${proposal.created_at ? new Date(proposal.created_at).toLocaleString() : '--'}</small></div><span class="proposal-status">${escapeHtml(proposal.status)}</span></div>`).join('');
  };

  const renderCases = (cases = []) => {
    const list = document.querySelector('#case-list');
    if (!cases.length) {
      list.innerHTML = '<div class="empty-state">No accepted loads waiting for Trulos.</div>';
      return;
    }
    list.innerHTML = cases.slice(-8).reverse().map((bookingCase) => `<div class="case-row"><div><strong>${escapeHtml(bookingCase.load_id)}</strong><small>Driver ${escapeHtml(bookingCase.driver_id)}</small></div><div><strong>${bookingCase.agreed_rate ? formatCurrency(bookingCase.agreed_rate) : 'Rate pending'}</strong><small>${escapeHtml(bookingCase.external_order_id || 'External order pending')}</small></div><span class="case-status">${escapeHtml(bookingCase.status.replace('_', ' '))}</span></div>`).join('');
  };

  const loadSummary = async () => {
    refreshButton.classList.add('loading');
    errorBanner.hidden = true;
    try {
      const [summaryResponse, loadsResponse, renewalsResponse, driversResponse, brokersResponse, proposalsResponse, casesResponse, whatsappResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/dashboard/summary`),
        fetch(`${apiBaseUrl}/loads`),
        fetch(`${apiBaseUrl}/contracts/renewals?days=30`),
        fetch(`${apiBaseUrl}/drivers`),
        fetch(`${apiBaseUrl}/brokers`),
        fetch(`${apiBaseUrl}/proposals`),
        fetch(`${apiBaseUrl}/booking-cases`),
        fetch(`${apiBaseUrl}/integrations/whatsapp/status`),
      ]);
      if (!summaryResponse.ok || !loadsResponse.ok || !renewalsResponse.ok || !driversResponse.ok || !brokersResponse.ok || !proposalsResponse.ok || !casesResponse.ok || !whatsappResponse.ok) throw new Error('Dashboard request failed');
      const [summary, loads, renewals, drivers, brokers, proposals, cases, whatsapp] = await Promise.all([
        summaryResponse.json(), loadsResponse.json(), renewalsResponse.json(), driversResponse.json(), brokersResponse.json(), proposalsResponse.json(), casesResponse.json(), whatsappResponse.json(),
      ]);
      setText('#active-drivers', summary.active_drivers);
      setText('#active-loads', summary.active_loads);
      setText('#revenue', formatCurrency(summary.revenue));
      setText('#payments-collected', formatCurrency(summary.payments_collected));
      setText('#pending-payments', summary.pending_payments);
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
      renderProposals(proposals);
      renderCases(cases);
      const whatsappReady = whatsapp.verify_token_configured && whatsapp.app_secret_configured && whatsapp.access_token_configured && whatsapp.phone_number_id_configured;
      whatsappStatus.textContent = `WhatsApp: ${whatsappReady ? 'ready' : 'configuration pending'}`;
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
  driverForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = driverForm.querySelector('button');
    submitButton.disabled = true;
    driverFormStatus.textContent = 'Saving...';
    try {
      const values = Object.fromEntries(new FormData(driverForm));
      const payload = {
        name: values.name,
        phone: values.phone,
        equipment_types: values.equipment_type ? [values.equipment_type] : [],
      };
      const response = await fetch(`${apiBaseUrl}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Driver request failed');
      driverForm.reset();
      driverFormStatus.textContent = 'Driver added';
      await loadSummary();
    } catch (error) {
      driverFormStatus.textContent = 'Could not save driver';
    } finally {
      submitButton.disabled = false;
    }
  });
  contractForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = contractForm.querySelector('button');
    submitButton.disabled = true;
    contractFormStatus.textContent = 'Saving...';
    try {
      const values = Object.fromEntries(new FormData(contractForm));
      const payload = {
        trip_id: values.trip_id,
        contract_number: values.contract_number,
        customer_name: values.customer_name,
        carrier_name: values.carrier_name,
        agreed_rate: values.agreed_rate,
        renewal_date: values.renewal_date || null,
      };
      const response = await fetch(`${apiBaseUrl}/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Contract request failed');
      contractForm.reset();
      contractFormStatus.textContent = 'Contract added';
      await loadSummary();
    } catch (error) {
      contractFormStatus.textContent = 'Could not save contract';
    } finally {
      submitButton.disabled = false;
    }
  });
  evidenceForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = evidenceForm.querySelector('button');
    submitButton.disabled = true;
    evidenceFormStatus.textContent = 'Saving...';
    try {
      const values = Object.fromEntries(new FormData(evidenceForm));
      const response = await fetch(`${apiBaseUrl}/loads/${encodeURIComponent(values.load_id)}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: values.load_id,
          evidence_type: values.evidence_type,
          description: values.description,
          document_url: values.document_url || null,
        }),
      });
      if (!response.ok) throw new Error('Evidence request failed');
      evidenceForm.reset();
      evidenceFormStatus.textContent = 'Evidence saved';
    } catch (error) {
      evidenceFormStatus.textContent = 'Could not save evidence';
    } finally {
      submitButton.disabled = false;
    }
  });
  proposalForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = proposalForm.querySelector('button');
    submitButton.disabled = true;
    proposalFormStatus.textContent = 'Sending...';
    try {
      const values = Object.fromEntries(new FormData(proposalForm));
      const response = await fetch(`${apiBaseUrl}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          load_id: values.load_id,
          driver_id: values.driver_id,
          message: values.message,
          send_whatsapp: values.send_whatsapp === 'true',
        }),
      });
      if (!response.ok) throw new Error('Proposal request failed');
      proposalForm.reset();
      proposalFormStatus.textContent = 'Proposal sent';
      await loadSummary();
    } catch (error) {
      proposalFormStatus.textContent = 'Could not send proposal';
    } finally {
      submitButton.disabled = false;
    }
  });
  caseForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = caseForm.querySelector('button');
    submitButton.disabled = true;
    caseFormStatus.textContent = 'Updating...';
    try {
      const values = Object.fromEntries(new FormData(caseForm));
      const response = await fetch(`${apiBaseUrl}/booking-cases/${encodeURIComponent(values.case_id)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: values.status,
          external_order_id: values.external_order_id || null,
        }),
      });
      if (!response.ok) throw new Error('Case update failed');
      caseForm.reset();
      caseFormStatus.textContent = 'Case updated';
      await loadSummary();
    } catch (error) {
      caseFormStatus.textContent = 'Could not update case';
    } finally {
      submitButton.disabled = false;
    }
  });
  paymentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = paymentForm.querySelector('button');
    submitButton.disabled = true;
    paymentFormStatus.textContent = 'Syncing...';
    try {
      const values = Object.fromEntries(new FormData(paymentForm));
      const response = await fetch(`${apiBaseUrl}/booking-cases/${encodeURIComponent(values.case_id)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_reference: values.external_reference,
          amount: values.amount,
          status: values.status,
          receipt_url: values.receipt_url || null,
        }),
      });
      if (!response.ok) throw new Error('Payment sync failed');
      paymentForm.reset();
      paymentFormStatus.textContent = 'Payment synced';
    } catch (error) {
      paymentFormStatus.textContent = 'Could not sync payment';
    } finally {
      submitButton.disabled = false;
    }
  });
  loadSummary();
});