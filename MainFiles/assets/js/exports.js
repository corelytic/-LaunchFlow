window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Exports = (() => {
  const { UI } = window.LaunchFlow;

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportWorkspace(workspace) {
    download('corelytic-launchflow-workspace.json', JSON.stringify(workspace, null, 2), 'application/json');
  }

  function printableHtml(title, body) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Segoe UI,sans-serif;padding:32px;color:#1d1712;background:#f8f3eb}h1,h2{margin-top:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}.card{padding:16px;border:1px solid #ddd;border-radius:16px;margin:12px 0;background:#fffdf9}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.pill{display:inline-block;padding:4px 10px;border-radius:999px;background:#f1ece4;margin-right:6px}.danger{border-left:4px solid #b54343}.warning{border-left:4px solid #b78324}.success{border-left:4px solid #2f7c56}</style></head><body><h1>${title}</h1>${body}</body></html>`;
  }

  function reportBodies(workspace) {
    const campaignTitle = (id) => workspace.campaigns.find((campaign) => campaign.id === id)?.title || 'Unknown campaign';
    const simulation = window.LaunchFlow.LaunchBrain.simulate(workspace);
    const openRevisions = workspace.revisions.filter((revision) => revision.status !== 'Resolved');
    const pendingApprovals = workspace.approvals.filter((approval) => approval.status === 'Pending');
    const missingAssets = workspace.matrixItems.filter((item) => item.status === 'Missing' || item.creativeStatus === 'Missing');
    const incompletePlatforms = workspace.matrixItems.filter((item) => !['Approved', 'Ready', 'Delivered'].includes(item.status));
    return {
      readiness: `<div class="grid">${workspace.campaigns.map((campaign) => `<div class="card ${campaign.readinessScore < 60 ? 'danger' : campaign.readinessScore < 80 ? 'warning' : 'success'}"><h2>${campaign.title}</h2><div><span class="pill">${campaign.status}</span><span class="pill">${campaign.riskLevel}</span></div><p>Readiness: ${campaign.readinessScore}%</p><p>Launch: ${campaign.launchDate || 'Not scheduled'}</p></div>`).join('')}</div>`,
      blockers: `<table><tr><th>Blocker Type</th><th>Count</th><th>Operational Meaning</th></tr><tr><td>Missing assets</td><td>${missingAssets.length}</td><td>Channels cannot progress to ready state.</td></tr><tr><td>Pending approvals</td><td>${pendingApprovals.length}</td><td>Client sign-off is delaying launch confidence.</td></tr><tr><td>Open revisions</td><td>${openRevisions.length}</td><td>Production and approval loops remain unstable.</td></tr><tr><td>Incomplete platforms</td><td>${incompletePlatforms.length}</td><td>Platform coverage is not yet fully launch-safe.</td></tr></table>`,
      approvals: `<table><tr><th>Campaign</th><th>Asset</th><th>Status</th><th>Requested</th><th>Notes</th></tr>${workspace.approvals.map((approval) => `<tr><td>${campaignTitle(approval.campaignId)}</td><td>${approval.assetName}</td><td>${approval.status}</td><td>${UI.formatDateTime(approval.requestedAt)}</td><td>${approval.notes}</td></tr>`).join('')}</table>`,
      revisions: `<table><tr><th>Campaign</th><th>Asset</th><th>Priority</th><th>Status</th><th>Rounds</th></tr>${workspace.revisions.map((revision) => `<tr><td>${campaignTitle(revision.campaignId)}</td><td>${revision.assetPlatform}</td><td>${revision.priority}</td><td>${revision.status}</td><td>${revision.roundCount}</td></tr>`).join('')}</table>`,
      delivery: `<table><tr><th>Campaign</th><th>Final Approval</th><th>Client Accepted</th><th>Notes</th></tr>${workspace.deliveries.map((delivery) => `<tr><td>${campaignTitle(delivery.campaignId)}</td><td>${delivery.finalApprovalStatus}</td><td>${delivery.clientAcceptance ? 'Yes' : 'No'}</td><td>${delivery.deliveryNotes}</td></tr>`).join('')}</table>`,
      risk: `<table><tr><th>Campaign</th><th>Risk</th><th>Readiness</th><th>Pending Approvals</th><th>Open Revisions</th></tr>${workspace.campaigns.map((campaign) => `<tr><td>${campaign.title}</td><td>${campaign.riskLevel}</td><td>${campaign.readinessScore}%</td><td>${workspace.approvals.filter((approval) => approval.campaignId === campaign.id && approval.status === 'Pending').length}</td><td>${workspace.revisions.filter((revision) => revision.campaignId === campaign.id && revision.status !== 'Resolved').length}</td></tr>`).join('')}</table>`,
      platforms: `<table><tr><th>Campaign</th><th>Platform</th><th>Status</th><th>Approval</th><th>Blocker</th></tr>${workspace.matrixItems.map((item) => `<tr><td>${campaignTitle(item.campaignId)}</td><td>${item.platform}</td><td>${item.status}</td><td>${item.approvalStatus}</td><td>${item.blockerStatus}</td></tr>`).join('')}</table>`,
      simulation: `<div class="grid"><div class="card ${simulation.readinessState === 'critical' ? 'danger' : simulation.readinessState === 'warning' ? 'warning' : 'success'}"><h2>Launch confidence meter</h2><p><strong>${simulation.launchConfidence}%</strong> confidence · ${simulation.confidenceStatus}</p><p>Launch risk: ${simulation.riskLabel}</p><p>Projected readiness: ${simulation.projectedReadiness}%</p><p>Risk score: ${simulation.launchRiskScore}</p></div><div class="card"><h2>Launch impact projection</h2><p>Platform readiness: ${simulation.platformReadiness}%</p><p>Possible launch delay: ${simulation.possibleLaunchDelay ? `${simulation.possibleLaunchDelay} day(s)` : 'No delay projected'}</p><p>Operational confidence: ${simulation.confidenceStatus}</p></div></div><div class="card"><h2>Critical blockers</h2><ul>${simulation.criticalBlockers.map((item) => `<li>${item}</li>`).join('')}</ul></div><div class="card"><h2>Operational warnings</h2><ul>${simulation.operationalWarnings.map((item) => `<li>${item}</li>`).join('')}</ul></div><div class="card"><h2>Recommended automation actions</h2><ul>${['createMissingAssetTasks', 'createApprovalReminder', 'createRevisionFollowUp', 'moveCampaignToReadyIfComplete', 'exportLaunchSummary'].map((item) => `<li>${item}${simulation.recommendedAutomations.includes(item) ? ' (recommended now)' : ''}</li>`).join('')}</ul></div><div class="card"><h2>Simulation timeline</h2><ul>${simulation.timelineSteps.map((item) => `<li><strong>${item.label}:</strong> ${item.detail}</li>`).join('')}</ul></div>`
    };
  }

  function renderReport(workspace, kind) {
    const bodies = reportBodies(workspace);
    const html = printableHtml(`Corelytic LaunchFlow - ${kind} report`, bodies[kind] || bodies.readiness);
    download(`launchflow-${kind}-report.html`, html, 'text/html');
    return html;
  }

  function exportOperationalSummary(workspace) {
    const simulation = window.LaunchFlow.LaunchBrain.simulate(workspace);
    const summary = {
      generatedAt: new Date().toISOString(),
      averageReadiness: Math.round(workspace.campaigns.reduce((sum, campaign) => sum + campaign.readinessScore, 0) / Math.max(1, workspace.campaigns.length)),
      campaignsAtRisk: workspace.campaigns.filter((campaign) => ['High', 'Critical'].includes(campaign.riskLevel)).length,
      pendingApprovals: workspace.approvals.filter((approval) => approval.status === 'Pending').length,
      openRevisions: workspace.revisions.filter((revision) => revision.status !== 'Resolved').length,
      missingAssets: workspace.matrixItems.filter((item) => item.status === 'Missing' || item.creativeStatus === 'Missing').length,
      simulation
    };
    download('launchflow-operational-summary.json', JSON.stringify(summary, null, 2), 'application/json');
    return summary;
  }

  function exportSimulationReport(workspace) {
    const simulation = window.LaunchFlow.LaunchBrain.simulate(workspace);
    const html = printableHtml('Corelytic LaunchFlow - launch simulation', reportBodies(workspace).simulation);
    download('launchflow-simulation-report.html', html, 'text/html');
    return simulation;
  }

  return { exportWorkspace, renderReport, exportOperationalSummary, exportSimulationReport };
})();
