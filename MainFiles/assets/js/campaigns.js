window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Campaigns = (() => {
  const { UI, State } = window.LaunchFlow;

  const getClientName = (workspace, clientId) => (workspace.clients.find((client) => client.id === clientId) || {}).name || 'Unknown client';

  function renderCampaigns(workspace) {
    const statusFilter = workspace.ui.filters.campaignStatus;
    const search = workspace.ui.search.toLowerCase();
    const campaigns = workspace.campaigns.filter((campaign) => {
      const matchesStatus = statusFilter === 'All' || campaign.status === statusFilter;
      const matchesSearch = !search || `${campaign.title} ${getClientName(workspace, campaign.client)} ${campaign.owner}`.toLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });

    const rows = campaigns.map((campaign) => `
      <tr>
        <td><strong>${UI.escapeHtml(campaign.title)}</strong><div class="muted">${UI.escapeHtml(getClientName(workspace, campaign.client))}</div></td>
        <td>${UI.badge(campaign.status)}</td>
        <td>${campaign.readinessScore}%</td>
        <td>${UI.badge(campaign.riskLevel)}</td>
        <td>${UI.formatDate(campaign.launchDate)}</td>
        <td>${UI.escapeHtml(campaign.owner || 'Unassigned')}</td>
        <td>
          <div class="segmented">
            <button class="chip-btn" data-action="view-campaign" data-id="${campaign.id}">Details</button>
            <button class="chip-btn" data-action="edit-campaign" data-id="${campaign.id}">Edit</button>
            <button class="chip-btn" data-action="duplicate-campaign" data-id="${campaign.id}">Duplicate</button>
            <button class="danger-btn" data-action="delete-campaign" data-id="${campaign.id}">Delete</button>
          </div>
        </td>
      </tr>`).join('');

    return `
      <section class="surface stack">
        <div class="row-between">
          <div>
            <p class="eyebrow">Campaign Operations</p>
            <h3>Launch-ready campaign control</h3>
          </div>
          <div class="segmented">
            <select data-change="campaign-status-filter">
              <option ${statusFilter === 'All' ? 'selected' : ''}>All</option>
              ${State.statuses.map((status) => `<option ${statusFilter === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
            <input type="search" placeholder="Search campaigns" value="${UI.escapeHtml(workspace.ui.search)}" data-change="campaign-search">
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Campaign</th><th>Status</th><th>Readiness</th><th>Risk</th><th>Launch Date</th><th>Owner</th><th>Actions</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="7">No campaigns match the current filter.</td></tr>`}</tbody>
          </table>
        </div>
      </section>`;
  }

  function renderCampaignModal(workspace, campaignId = '') {
    const campaign = workspace.campaigns.find((entry) => entry.id === campaignId) || { title: '', client: workspace.clients[0]?.id || '', owner: '', launchDate: '', platforms: [], status: 'Planning', readinessScore: 50, riskLevel: 'Medium', notes: '', daysInStatus: 0 };
    UI.openModal(campaignId ? 'Edit Campaign' : 'Create Campaign', `
      <form data-form="campaign-form" data-id="${campaignId}">
        <div class="form-grid">
          <label>Title<input name="title" value="${UI.escapeHtml(campaign.title)}" required></label>
          <label>Client<select name="client">${workspace.clients.map((client) => `<option value="${client.id}" ${client.id === campaign.client ? 'selected' : ''}>${UI.escapeHtml(client.name)}</option>`).join('')}</select></label>
          <label>Owner<input name="owner" value="${UI.escapeHtml(campaign.owner)}"></label>
          <label>Launch Date<input type="date" name="launchDate" value="${campaign.launchDate || ''}"></label>
          <label>Status<select name="status">${State.statuses.map((status) => `<option ${status === campaign.status ? 'selected' : ''}>${status}</option>`).join('')}</select></label>
          <label>Readiness Score<input type="number" name="readinessScore" min="0" max="100" value="${campaign.readinessScore}"></label>
          <label>Risk Level<select name="riskLevel">${['Low','Medium','High','Critical'].map((level) => `<option ${level === campaign.riskLevel ? 'selected' : ''}>${level}</option>`).join('')}</select></label>
          <label>Platforms<select name="platforms" multiple size="8">${['Instagram Feed','Instagram Story','TikTok','YouTube Shorts','Meta Ads','LinkedIn','Email Campaign','Landing Page'].map((platform) => `<option value="${platform}" ${campaign.platforms.includes(platform) ? 'selected' : ''}>${platform}</option>`).join('')}</select></label>
        </div>
        <label>Notes<textarea name="notes">${UI.escapeHtml(campaign.notes)}</textarea></label>
        <div class="row-between"><span class="muted">Hold Ctrl or Cmd to select multiple platforms.</span><button class="primary-btn" type="submit">Save Campaign</button></div>
      </form>`);
  }

  function renderCampaignDetail(workspace, campaignId) {
    const campaign = workspace.campaigns.find((entry) => entry.id === campaignId);
    const matrix = workspace.matrixItems.filter((item) => item.campaignId === campaignId);
    const approvals = workspace.approvals.filter((item) => item.campaignId === campaignId);
    const revisions = workspace.revisions.filter((item) => item.campaignId === campaignId && item.status !== 'Resolved');
    UI.openModal(campaign.title, `
      <div class="stack">
        <div class="detail-grid">
          <div class="card-row"><strong>Client</strong><div>${UI.escapeHtml(getClientName(workspace, campaign.client))}</div></div>
          <div class="card-row"><strong>Status</strong><div>${UI.badge(campaign.status)}</div></div>
          <div class="card-row"><strong>Readiness</strong><div>${campaign.readinessScore}%</div></div>
          <div class="card-row"><strong>Launch</strong><div>${UI.formatDate(campaign.launchDate)}</div></div>
        </div>
        <div class="card-row"><strong>Notes</strong><p>${UI.escapeHtml(campaign.notes || 'No notes yet.')}</p></div>
        <div class="double-grid">
          <div class="card-row"><strong>Launch Matrix</strong><div class="stack">${matrix.map((item) => `<div>${UI.escapeHtml(item.platform)}: ${UI.badge(item.status)}</div>`).join('')}</div></div>
          <div class="card-row"><strong>Pending Load</strong><div>${approvals.filter((item) => item.status === 'Pending').length} approvals pending</div><div>${revisions.length} unresolved revisions</div></div>
        </div>
      </div>`);
  }

  function renderMatrix(workspace) {
    const filter = workspace.ui.filters.matrixCampaignId;
    const items = workspace.matrixItems.filter((item) => filter === 'all' || item.campaignId === filter);
    return `
      <section class="surface stack">
        <div class="row-between">
          <div><p class="eyebrow">Platform Readiness</p><h3>Launch Matrix</h3></div>
          <select data-change="matrix-campaign-filter">
            <option value="all">All campaigns</option>
            ${workspace.campaigns.map((campaign) => `<option value="${campaign.id}" ${filter === campaign.id ? 'selected' : ''}>${UI.escapeHtml(campaign.title)}</option>`).join('')}
          </select>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Campaign</th><th>Platform</th><th>Required Assets</th><th>Status</th><th>Copy</th><th>Creative</th><th>Approval</th><th>Schedule</th><th>Blocker</th><th>Actions</th></tr></thead>
            <tbody>
              ${items.map((item) => {
                const campaign = workspace.campaigns.find((entry) => entry.id === item.campaignId);
                return `<tr>
                  <td>${UI.escapeHtml(campaign.title)}</td>
                  <td>${UI.escapeHtml(item.platform)}</td>
                  <td>${UI.escapeHtml(item.requiredAssets)}</td>
                  <td>${UI.badge(item.status)}</td>
                  <td>${UI.escapeHtml(item.copyStatus)}</td>
                  <td>${UI.escapeHtml(item.creativeStatus)}</td>
                  <td>${UI.escapeHtml(item.approvalStatus)}</td>
                  <td>${UI.escapeHtml(item.scheduledStatus)}</td>
                  <td>${UI.escapeHtml(item.blockerStatus)}</td>
                  <td><button class="chip-btn" data-action="cycle-matrix-status" data-id="${item.id}">Advance</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  return { renderCampaigns, renderCampaignModal, renderCampaignDetail, renderMatrix, getClientName };
})();
