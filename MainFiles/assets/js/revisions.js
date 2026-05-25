window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Revisions = (() => {
  const { UI } = window.LaunchFlow;

  function pressure(entry) {
    if (entry.priority === 'Critical' || entry.roundCount >= 4) return 'critical';
    if (entry.priority === 'High' || entry.roundCount >= 3) return 'high';
    if (entry.priority === 'Medium') return 'medium';
    return 'low';
  }

  function render(workspace) {
    const filter = workspace.ui.filters.revisionStatus;
    const rows = workspace.revisions.filter((entry) => filter === 'all' || entry.status === filter).map((entry) => {
      const campaign = workspace.campaigns.find((item) => item.id === entry.campaignId);
      return `<tr>
        <td>${UI.escapeHtml(campaign.title)}</td>
        <td>${UI.escapeHtml(entry.assetPlatform)}</td>
        <td>${UI.escapeHtml(entry.comment)}</td>
        <td>${UI.badge(entry.priority)}</td>
        <td>${UI.badge(entry.status)}</td>
        <td>${UI.escapeHtml(entry.owner || 'Unassigned')}</td>
        <td>${entry.roundCount}</td>
        <td>${UI.badge(pressure(entry))}</td>
        <td>
          <div class="segmented">
            <button class="chip-btn" data-action="toggle-revision" data-id="${entry.id}">${entry.status === 'Resolved' ? 'Reopen' : 'Resolve'}</button>
            <button class="chip-btn" data-action="promote-revision" data-id="${entry.id}">Promote Priority</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
      <section class="surface stack">
        <div class="row-between">
          <div><p class="eyebrow">Revision Control</p><h3>Revision pressure and ownership</h3></div>
          <div class="segmented">
            <select data-change="revision-status-filter">
              <option value="all">All statuses</option>
              ${['Open','Resolved','Reopened'].map((status) => `<option value="${status}" ${filter === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
            <button class="primary-btn" data-action="open-revision-modal">New Revision</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Campaign</th><th>Asset</th><th>Comment</th><th>Priority</th><th>Status</th><th>Owner</th><th>Rounds</th><th>Pressure</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`;
  }

  function openCreateModal(workspace) {
    UI.openModal('Create Revision', `
      <form data-form="revision-form">
        <div class="form-grid">
          <label>Campaign<select name="campaignId">${workspace.campaigns.map((campaign) => `<option value="${campaign.id}">${UI.escapeHtml(campaign.title)}</option>`).join('')}</select></label>
          <label>Asset / Platform<input name="assetPlatform" required></label>
          <label>Priority<select name="priority">${['Low','Medium','High','Critical'].map((item) => `<option>${item}</option>`).join('')}</select></label>
          <label>Owner<input name="owner"></label>
        </div>
        <label>Comment<textarea name="comment" required></textarea></label>
        <div class="row-between"><span class="muted">Revisions immediately affect readiness and LaunchBrain scans.</span><button class="primary-btn" type="submit">Create Revision</button></div>
      </form>`);
  }

  return { render, openCreateModal };
})();
