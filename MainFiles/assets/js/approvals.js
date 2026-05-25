window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Approvals = (() => {
  const { UI } = window.LaunchFlow;
  function render(workspace) {
    const cards = workspace.approvals.map((approval) => {
      const campaign = workspace.campaigns.find((item) => item.id === approval.campaignId);
      return `<div class="card-row">
        <div class="row-between"><strong>${UI.escapeHtml(approval.assetName)}</strong><div>${UI.badge(approval.status)}</div></div>
        <p>${UI.escapeHtml(campaign.title)}</p>
        <p class="muted">Requested ${UI.formatDateTime(approval.requestedAt)}</p>
        <p>${UI.escapeHtml(approval.notes)}</p>
        <div class="segmented">
          <button class="chip-btn" data-action="approval-decision" data-id="${approval.id}" data-value="Approved">Approve</button>
          <button class="chip-btn" data-action="approval-decision" data-id="${approval.id}" data-value="Revision Requested">Request Revision</button>
          <button class="primary-btn" data-action="approval-decision" data-id="${approval.id}" data-value="Final Approved">Final Approval</button>
        </div>
      </div>`;
    }).join('');

    return `
      <section class="surface stack">
        <div><p class="eyebrow">Client Approval Room</p><h3>Polished local review workspace</h3><p class="muted">Approvals, revision requests, and final sign-off all flow through one local control room.</p></div>
        <div class="detail-grid">${cards}</div>
      </section>`;
  }
  return { render };
})();
