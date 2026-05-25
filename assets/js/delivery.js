window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Delivery = (() => {
  const { UI } = window.LaunchFlow;
  const checklistKeys = [
    ['creatives', 'Final creatives attached'],
    ['captions', 'Captions approved'],
    ['adCopy', 'Ad copy approved'],
    ['landingPage', 'Landing page approved'],
    ['reportPrepared', 'Report prepared'],
    ['clientAccepted', 'Client accepted delivery']
  ];
  function render(workspace) {
    return `
      <section class="surface stack">
        <div><p class="eyebrow">Final Handoff</p><h3>Delivery Center</h3></div>
        <div class="detail-grid">
          ${workspace.deliveries.map((delivery) => {
            const campaign = workspace.campaigns.find((entry) => entry.id === delivery.campaignId);
            return `<div class="card-row">
              <div class="row-between"><strong>${UI.escapeHtml(campaign.title)}</strong><div>${UI.badge(delivery.finalApprovalStatus)}</div></div>
              <p>${UI.escapeHtml(delivery.deliveredAssets)}</p>
              <div class="stack">
                ${checklistKeys.map(([key, label]) => `<button class="ghost-btn" data-action="toggle-delivery-check" data-id="${delivery.id}" data-key="${key}">${delivery.checklist[key] ? 'Done' : 'Pending'} · ${label}</button>`).join('')}
              </div>
              <div class="segmented">
                <button class="chip-btn" data-action="toggle-client-acceptance" data-id="${delivery.id}">${delivery.clientAcceptance ? 'Undo Acceptance' : 'Accept Delivery'}</button>
                <button class="chip-btn" data-action="export-delivery-summary" data-id="${delivery.id}">Export Summary</button>
                <button class="primary-btn" data-action="archive-delivery" data-id="${campaign.id}">Archive</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>`;
  }
  return { render };
})();
