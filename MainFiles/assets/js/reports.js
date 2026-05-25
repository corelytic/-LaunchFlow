window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Reports = (() => {
  const { UI } = window.LaunchFlow;

  function avgReadiness(workspace) {
    return Math.round(workspace.campaigns.reduce((sum, item) => sum + item.readinessScore, 0) / Math.max(1, workspace.campaigns.length));
  }

  function render(workspace) {
    const pendingApprovals = workspace.approvals.filter((item) => item.status === 'Pending').length;
    const openRevisions = workspace.revisions.filter((item) => item.status !== 'Resolved').length;
    const atRisk = workspace.campaigns.filter((item) => ['High', 'Critical'].includes(item.riskLevel)).length;
    const completeDelivery = workspace.deliveries.filter((item) => item.clientAcceptance).length;
    const missingAssets = workspace.matrixItems.filter((item) => item.status === 'Missing' || item.creativeStatus === 'Missing').length;
    const incompletePlatforms = workspace.matrixItems.filter((item) => !['Approved', 'Ready', 'Delivered'].includes(item.status)).length;
    const simulation = window.LaunchFlow.LaunchBrain.simulate(workspace);
    const healthSummary = {
      healthy: workspace.campaigns.filter((item) => item.riskLevel === 'Low').length,
      medium: workspace.campaigns.filter((item) => item.riskLevel === 'Medium').length,
      high: workspace.campaigns.filter((item) => item.riskLevel === 'High').length,
      critical: workspace.campaigns.filter((item) => item.riskLevel === 'Critical').length
    };

    return `
      <section class="surface stack">
        <div class="row-between">
          <div>
            <p class="eyebrow">Executive Reporting Pack</p>
            <h3>Operational reporting with launch pressure context</h3>
          </div>
          <div class="segmented">
            <button class="primary-btn" data-action="export-workspace">Export JSON Backup</button>
            <button class="ghost-btn" data-action="export-operational-summary">Operational Summary</button>
          </div>
        </div>
        <div class="metrics-grid report-scorecards">
          <div class="metric-card accent-card"><div class="muted">Launch readiness score</div><div class="metric-value counter-value" data-count="${avgReadiness(workspace)}">${avgReadiness(workspace)}</div><div class="helper">Average launch readiness across live operations.</div><button class="chip-btn" data-action="print-report" data-report="readiness">Printable HTML</button></div>
          <div class="metric-card"><div class="muted">Blocker breakdown</div><div class="metric-value counter-value" data-count="${missingAssets + pendingApprovals + openRevisions}">${missingAssets + pendingApprovals + openRevisions}</div><div class="helper">Assets, approvals, and revision pressure combined.</div><button class="chip-btn" data-action="print-report" data-report="blockers">Printable HTML</button></div>
          <div class="metric-card"><div class="muted">Approval delay report</div><div class="metric-value counter-value" data-count="${pendingApprovals}">${pendingApprovals}</div><div class="helper">Pending client review items affecting launch confidence.</div><button class="chip-btn" data-action="print-report" data-report="approvals">Printable HTML</button></div>
          <div class="metric-card"><div class="muted">Revision pressure report</div><div class="metric-value counter-value" data-count="${openRevisions}">${openRevisions}</div><div class="helper">Open revisions driving readiness volatility.</div><button class="chip-btn" data-action="print-report" data-report="revisions">Printable HTML</button></div>
          <div class="metric-card"><div class="muted">Campaign health summary</div><div class="metric-value counter-value" data-count="${atRisk}">${atRisk}</div><div class="helper">${healthSummary.healthy} healthy · ${healthSummary.medium} medium · ${healthSummary.high} high · ${healthSummary.critical} critical.</div><button class="chip-btn" data-action="print-report" data-report="risk">Printable HTML</button></div>
          <div class="metric-card"><div class="muted">Platform completion analysis</div><div class="metric-value counter-value" data-count="${incompletePlatforms}">${incompletePlatforms}</div><div class="helper">${completeDelivery}/${workspace.deliveries.length} deliveries accepted with incomplete platform count tracked.</div><button class="chip-btn" data-action="print-report" data-report="platforms">Printable HTML</button></div>
        </div>
        <div class="double-grid">
          <div class="report-sheet stack">
            <div class="surface-header"><div><h3>Executive readiness reporting</h3><p class="muted">High-pressure scorecards for agency delivery teams.</p></div><button class="ghost-btn" data-action="run-launch-simulation">Refresh simulation</button></div>
            <div class="detail-grid compact-grid">
              <div class="card-row risk-band-${simulation.readinessState}"><strong>Launch Simulation</strong><div class="metric-value">${simulation.projectedReadiness}%</div><div class="helper">${simulation.riskLabel} launch risk · ${simulation.launchConfidence}% confidence</div><button class="chip-btn" data-action="export-simulation-report">Export Simulation</button></div>
              <div class="card-row"><strong>Health Mix</strong><div class="stack"><div>Healthy campaigns: ${healthSummary.healthy}</div><div>Medium risk: ${healthSummary.medium}</div><div>High risk: ${healthSummary.high}</div><div>Critical launches: ${healthSummary.critical}</div></div></div>
              <div class="card-row"><strong>Blocker Breakdown</strong><div class="stack"><div>Missing assets: ${missingAssets}</div><div>Approvals overdue / pending: ${pendingApprovals}</div><div>Unresolved revisions: ${openRevisions}</div><div>Incomplete platforms: ${incompletePlatforms}</div></div></div>
            </div>
          </div>
          <div class="report-sheet stack">
            <div class="surface-header"><div><h3>Simulation warnings</h3><p class="muted">Rule-based launch pressure forecast.</p></div></div>
            <div class="stack">${simulation.operationalWarnings.map((warning) => `<div class="card-row warning-rail">${UI.escapeHtml(warning)}</div>`).join('') || '<div class="card-row">No active operational warnings.</div>'}</div>
            <div class="stack">
              <strong>Recommended automations</strong>
              ${simulation.recommendedAutomations.map((command) => `<button class="ghost-btn" data-action="run-automation-command" data-command="${command}">${command}</button>`).join('') || '<span class="muted">No automation recommendation required.</span>'}
            </div>
          </div>
        </div>
        <div id="report-output" class="report-frame">Choose a report export action to generate a printable operational summary.</div>
      </section>`;
  }

  return { render };
})();
