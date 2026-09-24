document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const apiBaseUrl = window.FREIGHTDISPATCH_API_URL || 'http://127.0.0.1:8000';
  const refreshButton = document.querySelector('#refresh-button');
  const errorBanner = document.querySelector('#error-banner');
  const connectionLabel = document.querySelector('#connection-label');

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

  const loadSummary = async () => {
    refreshButton.classList.add('loading');
    errorBanner.hidden = true;
    try {
      const [summaryResponse, loadsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/dashboard/summary`),
        fetch(`${apiBaseUrl}/loads`),
      ]);
      if (!summaryResponse.ok || !loadsResponse.ok) throw new Error('Dashboard request failed');
      const [summary, loads] = await Promise.all([summaryResponse.json(), loadsResponse.json()]);
      setText('#active-drivers', summary.active_drivers);
      setText('#active-loads', summary.active_loads);
      setText('#revenue', formatCurrency(summary.revenue));
      setText('#pending-actions', Number(summary.pending_contracts) + Number(summary.pending_commissions));
      setText('#pending-contracts', summary.pending_contracts);
      setText('#pending-commissions', summary.pending_commissions);
      setText('#missing-documents', summary.missing_documents);
      setText('#contract-count', summary.pending_contracts);
      setText('#load-nav-count', summary.active_loads);
      renderLoads(loads);
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
  loadSummary();
});