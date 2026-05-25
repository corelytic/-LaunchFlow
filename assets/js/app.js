window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.App = (() => {
  const ns = window.LaunchFlow;
  const { UI, Router, Storage, SeedData, LaunchBrain, Automations, Campaigns, Revisions, Approvals, Delivery, Reports, Exports, QAGuard, State } = ns;
  let workspace;
  let actionMap = {};
  let pendingImportWorkspace = null;
  let audioContext = null;
  let simulationTimerIds = [];

  function clearSimulationTimers() {
    simulationTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    simulationTimerIds = [];
  }

  function clientName(clientId) {
    return Campaigns.getClientName(workspace, clientId);
  }

  function save() {
    Storage.saveWorkspace(workspace);
  }

  function playSound(kind) {
    if (!workspace?.settings?.soundsEnabled) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const config = {
        success: { frequency: 520, duration: 0.08, volume: 0.03 },
        warning: { frequency: 240, duration: 0.12, volume: 0.035 },
        automation: { frequency: 420, duration: 0.1, volume: 0.025 }
      }[kind] || { frequency: 360, duration: 0.08, volume: 0.025 };
      oscillator.type = 'sine';
      oscillator.frequency.value = config.frequency;
      gain.gain.value = config.volume;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + config.duration);
    } catch (error) {
      console.error(error);
    }
  }

  function addTimeline(campaignId, type, severity, message) {
    workspace.timeline.unshift({ id: State.nextId('tl'), campaignId, type, severity, message, createdAt: new Date().toISOString() });
  }

  function getCampaignBundle(campaignId) {
    return {
      matrix: workspace.matrixItems.filter((item) => item.campaignId === campaignId),
      approvals: workspace.approvals.filter((item) => item.campaignId === campaignId),
      revisions: workspace.revisions.filter((item) => item.campaignId === campaignId && item.status !== 'Resolved'),
      delivery: workspace.deliveries.find((item) => item.campaignId === campaignId)
    };
  }

  function recalcCampaign(campaignId) {
    const campaign = workspace.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    const matrix = workspace.matrixItems.filter((item) => item.campaignId === campaignId);
    const approvals = workspace.approvals.filter((item) => item.campaignId === campaignId);
    const revisions = workspace.revisions.filter((item) => item.campaignId === campaignId && item.status !== 'Resolved');
    const matrixScore = matrix.length ? Math.round(matrix.reduce((sum, item) => {
      const map = { Missing: 15, Draft: 40, 'Needs Review': 55, Approved: 85, Ready: 95, Delivered: 100 };
      return sum + (map[item.status] || 35);
    }, 0) / matrix.length) : 50;
    const approvalPenalty = approvals.filter((item) => item.status === 'Pending').length * 4;
    const revisionPenalty = revisions.reduce((sum, item) => sum + ({ Low: 2, Medium: 4, High: 7, Critical: 10 }[item.priority] || 4), 0);
    const ownerPenalty = campaign.owner ? 0 : 10;
    const datePenalty = campaign.launchDate ? 0 : 12;
    campaign.readinessScore = Math.max(0, Math.min(100, matrixScore - approvalPenalty - revisionPenalty - ownerPenalty - datePenalty + 20));
    campaign.riskLevel = campaign.readinessScore < 50 ? 'Critical' : campaign.readinessScore < 70 ? 'High' : campaign.readinessScore < 85 ? 'Medium' : 'Low';
  }

  function scanLaunchBrain() {
    workspace.alerts = LaunchBrain.scan(workspace);
    addTimeline('', 'LaunchBrain alert generated', 'info', `LaunchBrain scan completed with ${workspace.alerts.length} alerts.`);
    workspace.lastBrainRun = new Date().toISOString();
  }

  function runSimulation(logTimeline = false) {
    workspace.lastSimulation = LaunchBrain.simulate(workspace);
    if (logTimeline) {
      addTimeline('', 'Launch simulation run', workspace.lastSimulation.readinessState === 'critical' ? 'critical' : workspace.lastSimulation.readinessState === 'warning' ? 'warning' : 'info', `Launch Simulation completed with ${workspace.lastSimulation.launchConfidence}% confidence and ${workspace.lastSimulation.blockerCount} blocker group(s).`);
    }
    return workspace.lastSimulation;
  }

  function initWorkspace() {
    workspace = Storage.loadWorkspace() || SeedData.seed();
    workspace.ui = { ...State.getDefaults().ui, ...(workspace.ui || {}) };
    workspace.settings = { ...State.getDefaults().settings, ...(workspace.settings || {}) };
    workspace.dismissedAlerts = workspace.dismissedAlerts || [];
    workspace.actionLog = workspace.actionLog || [];
    document.documentElement.dataset.theme = workspace.settings.theme;
    document.documentElement.dataset.density = workspace.settings.density;
    scanLaunchBrain();
    runSimulation();
    save();
  }

  function dashboardView() {
    const active = workspace.campaigns.filter((campaign) => !campaign.archived).length;
    const atRisk = workspace.campaigns.filter((campaign) => ['High', 'Critical'].includes(campaign.riskLevel)).length;
    const pendingApprovals = workspace.approvals.filter((item) => item.status === 'Pending').length;
    const overdueApprovals = workspace.approvals.filter((item) => item.status === 'Pending' && ((Date.now() - new Date(item.requestedAt).getTime()) / 86400000) > 2).length;
    const missingAssets = workspace.matrixItems.filter((item) => item.status === 'Missing' || item.creativeStatus === 'Missing').length;
    const unresolvedRevisions = workspace.revisions.filter((item) => item.status !== 'Resolved').length;
    const incompletePlatforms = workspace.matrixItems.filter((item) => !['Approved', 'Ready', 'Delivered'].includes(item.status)).length;
    const countdown24 = workspace.campaigns.filter((campaign) => campaign.launchDate && LaunchBrain.daysToLaunch(campaign.launchDate) <= 1 && LaunchBrain.daysToLaunch(campaign.launchDate) >= 0).length;
    const countdown3 = workspace.campaigns.filter((campaign) => campaign.launchDate && LaunchBrain.daysToLaunch(campaign.launchDate) <= 3 && LaunchBrain.daysToLaunch(campaign.launchDate) >= 0).length;
    const overdueLaunches = workspace.campaigns.filter((campaign) => campaign.launchDate && LaunchBrain.daysToLaunch(campaign.launchDate) < 0 && !campaign.archived).length;
    const completedDeliveries = workspace.deliveries.filter((item) => item.clientAcceptance).length;
    const urgentActions = workspace.alerts.filter((alert) => !workspace.dismissedAlerts.includes(alert.id)).slice(0, 4);
    const automationFeed = [
      ...workspace.actionLog.map((item) => ({ tone: 'warning', label: item.command, detail: item.note, createdAt: item.createdAt })),
      ...workspace.timeline.filter((entry) => ['Automation applied', 'LaunchBrain alert generated', 'Approval requested', 'Status changed'].includes(entry.type)).map((entry) => ({ tone: entry.severity, label: entry.type, detail: entry.message, createdAt: entry.createdAt }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    const averageReadiness = Math.round(workspace.campaigns.reduce((sum, campaign) => sum + campaign.readinessScore, 0) / Math.max(1, workspace.campaigns.length));
    const readinessState = averageReadiness >= 80 ? 'healthy' : averageReadiness >= 60 ? 'warning' : 'critical';
    const ringDegrees = Math.max(16, Math.round((averageReadiness / 100) * 360));
    const healthMix = {
      healthy: workspace.campaigns.filter((campaign) => campaign.riskLevel === 'Low').length,
      medium: workspace.campaigns.filter((campaign) => campaign.riskLevel === 'Medium').length,
      high: workspace.campaigns.filter((campaign) => campaign.riskLevel === 'High').length,
      critical: workspace.campaigns.filter((campaign) => campaign.riskLevel === 'Critical').length
    };
    return `
      <div class="stack">
        <section class="radar-shell">
          <div class="radar-panel surface risk-shell-${readinessState}">
            <div class="surface-header">
              <div>
                <p class="eyebrow">Launch Readiness Radar</p>
                <h3>Live operational pressure across the launch floor</h3>
              </div>
              <div class="segmented">
                <span class="kbd">${active} active campaigns</span>
                <span class="kbd">${workspace.alerts.length} LaunchBrain alerts</span>
              </div>
            </div>
            <div class="radar-grid">
              <div class="radar-ring-wrap">
                <div class="radar-ring readiness-${readinessState}" style="--readiness-deg:${ringDegrees}deg;">
                  <div class="radar-ring-inner">
                    <span class="eyebrow">Readiness</span>
                    <div class="radar-score counter-value" data-count="${averageReadiness}">${averageReadiness}</div>
                    <div class="radar-label">${readinessState}</div>
                  </div>
                </div>
                <div class="pulse-row">
                  <span class="pulse-dot pulse-${readinessState}"></span>
                  <span class="muted">Operational pulse ${readinessState}</span>
                </div>
              </div>
              <div class="stack">
                <div class="detail-grid compact-grid">
                  <div class="card-row radar-stat"><strong>Healthy campaigns</strong><div class="metric-value counter-value" data-count="${healthMix.healthy}">${healthMix.healthy}</div></div>
                  <div class="card-row radar-stat"><strong>Medium risk</strong><div class="metric-value counter-value" data-count="${healthMix.medium}">${healthMix.medium}</div></div>
                  <div class="card-row radar-stat warning-rail"><strong>High risk</strong><div class="metric-value counter-value" data-count="${healthMix.high}">${healthMix.high}</div></div>
                  <div class="card-row radar-stat critical-rail"><strong>Critical launches</strong><div class="metric-value counter-value" data-count="${healthMix.critical}">${healthMix.critical}</div></div>
                </div>
                <div class="blocker-grid">
                  <div class="blocker-card warning-rail"><span>Approvals overdue</span><strong class="counter-value" data-count="${overdueApprovals}">${overdueApprovals}</strong></div>
                  <div class="blocker-card critical-rail"><span>Missing assets</span><strong class="counter-value" data-count="${missingAssets}">${missingAssets}</strong></div>
                  <div class="blocker-card warning-rail"><span>Unresolved revisions</span><strong class="counter-value" data-count="${unresolvedRevisions}">${unresolvedRevisions}</strong></div>
                  <div class="blocker-card critical-rail"><span>Launch risks</span><strong class="counter-value" data-count="${atRisk}">${atRisk}</strong></div>
                  <div class="blocker-card warning-rail"><span>Incomplete platforms</span><strong class="counter-value" data-count="${incompletePlatforms}">${incompletePlatforms}</strong></div>
                </div>
              </div>
            </div>
          </div>
          <div class="surface stack pressure-panel">
            <div class="surface-header"><div><h3>Countdown Pressure</h3><p class="muted">Timing pressure and launch risk concentration.</p></div><button class="ghost-btn" data-action="run-launch-simulation">Run Launch Simulation</button></div>
            <div class="detail-grid compact-grid">
              <div class="card-row warning-rail"><strong>Within 24h</strong><div class="metric-value counter-value" data-count="${countdown24}">${countdown24}</div></div>
              <div class="card-row"><strong>Within 3 days</strong><div class="metric-value counter-value" data-count="${countdown3}">${countdown3}</div></div>
              <div class="card-row critical-rail"><strong>Overdue launches</strong><div class="metric-value counter-value" data-count="${overdueLaunches}">${overdueLaunches}</div></div>
            </div>
            <div class="card-row">
              <strong>Automation activity feed</strong>
              <div class="automation-feed">${automationFeed.map((item) => `<div class="feed-item tone-${UI.escapeHtml(String(item.tone || 'info').toLowerCase())}"><span class="pulse-dot pulse-${UI.escapeHtml(String(item.tone || 'info').toLowerCase())}"></span><div><strong>${UI.escapeHtml(item.label)}</strong><div class="muted">${UI.escapeHtml(item.detail)}</div></div></div>`).join('') || '<div class="muted">No recent automation activity yet.</div>'}</div>
            </div>
          </div>
        </section>
        <section class="metrics-grid">
          <div class="metric-card accent-card"><div class="muted">Delivery completion</div><div class="metric-value counter-value" data-count="${completedDeliveries}">${completedDeliveries}</div><div class="helper">Accepted deliveries out of ${workspace.deliveries.length}</div></div>
          <div class="metric-card"><div class="muted">Pending approvals</div><div class="metric-value counter-value" data-count="${pendingApprovals}">${pendingApprovals}</div></div>
          <div class="metric-card"><div class="muted">Launches due soon</div><div class="metric-value counter-value" data-count="${countdown3}">${countdown3}</div></div>
          <div class="metric-card critical-card"><div class="muted">LaunchBrain alerts</div><div class="metric-value counter-value" data-count="${workspace.alerts.length}">${workspace.alerts.length}</div></div>
        </section>
        <section class="double-grid">
          <div class="surface stack">
            <div class="surface-header"><div><h3>Campaign risk cards</h3><p class="muted">Readiness, blockers, countdown pressure, and launch posture.</p></div></div>
            <div class="card-list">${workspace.campaigns.slice(0, 4).map((campaign) => `<div class="card-row urgency-card urgency-${campaign.riskLevel.toLowerCase().replace(/\s+/g, '-')}"><div class="row-between"><strong>${UI.escapeHtml(campaign.title)}</strong>${UI.badge(campaign.riskLevel)}</div><div class="inline-meta"><span>${clientName(campaign.client)}</span><span>${campaign.launchDate ? `${LaunchBrain.daysToLaunch(campaign.launchDate)} day(s)` : 'No date'}</span></div><div class="progress-bar"><div class="progress-fill live-progress" style="width:${campaign.readinessScore}%"></div></div><div class="muted">Readiness ${campaign.readinessScore}% · ${UI.escapeHtml(campaign.status)}</div></div>`).join('')}</div>
          </div>
          <div class="surface stack">
            <div class="surface-header"><div><h3>Urgent next actions</h3><p class="muted">Suggested by LaunchBrain Automation Engine</p></div><button class="ghost-btn" data-action="run-launchbrain">Refresh Scan</button></div>
            <div class="alert-list">${urgentActions.map((alert) => `<div class="card-row urgency-card urgency-${alert.severity}"><div class="row-between"><strong>${UI.escapeHtml(alert.title)}</strong>${UI.badge(alert.severity)}</div><p>${UI.escapeHtml(alert.reason)}</p><div class="segmented"><button class="chip-btn" data-action="apply-alert-action" data-id="${alert.id}">Apply ${UI.escapeHtml(alert.suggestedCommand)}</button><button class="ghost-btn" data-action="dismiss-alert" data-id="${alert.id}">Dismiss</button></div></div>`).join('') || UI.emptyState('No urgent actions', 'The current scan is stable. Run another simulation to stress test launch readiness.', 'Run Launch Simulation', 'run-launch-simulation')}</div>
          </div>
        </section>
      </div>`;
  }

  function launchBrainView() {
    const active = workspace.alerts.filter((alert) => !workspace.dismissedAlerts.includes(alert.id));
    const dismissed = workspace.alerts.filter((alert) => workspace.dismissedAlerts.includes(alert.id));
    const simulation = workspace.lastSimulation || runSimulation();
    return `
      <section class="surface stack">
        <div class="row-between"><div><p class="eyebrow">Rule-Based Intelligence</p><h3>LaunchBrain Automation Engine</h3></div><div class="segmented"><button class="ghost-btn" data-action="run-launch-simulation">Run Launch Simulation</button><button class="primary-btn" data-action="run-launchbrain">Run Scan</button></div></div>
        <div class="double-grid">
          <div class="stack">
            <div class="card-row simulation-inline risk-shell-${simulation.readinessState}">
              <div class="row-between"><strong>Simulation Snapshot</strong><span class="badge">${simulation.riskLabel}</span></div>
              <div class="inline-meta"><span>Projected readiness ${simulation.projectedReadiness}%</span><span>Confidence ${simulation.launchConfidence}%</span></div>
              <div class="progress-bar"><div class="progress-fill live-progress" style="width:${simulation.launchConfidence}%"></div></div>
              <button class="chip-btn" data-action="export-simulation-report">Export simulation report</button>
            </div>
            <h4>Critical alerts & suggested fixes</h4>
            ${active.map((alert) => `<div class="card-row urgency-card urgency-${alert.severity}"><div class="row-between"><strong>${UI.escapeHtml(alert.title)}</strong>${UI.badge(alert.severity)}</div><p>${UI.escapeHtml(alert.reason)}</p><p class="muted">Recommended: ${UI.escapeHtml(alert.recommendedAction)}</p><div class="segmented"><button class="chip-btn" data-action="apply-alert-action" data-id="${alert.id}">Apply ${UI.escapeHtml(alert.suggestedCommand)}</button><button class="ghost-btn" data-action="dismiss-alert" data-id="${alert.id}">Dismiss</button></div></div>`).join('') || UI.emptyState('No active alerts', 'The current workspace scan is clear.', '', '')}
          </div>
          <div class="stack">
            <div class="card-row"><strong>Dismissed alerts</strong><div class="stack">${dismissed.map((alert) => `<div>${UI.escapeHtml(alert.title)}</div>`).join('') || '<span class="muted">No dismissed alerts yet.</span>'}</div></div>
            <div class="card-row"><strong>Applied actions log</strong><div class="stack">${workspace.actionLog.slice(0, 8).map((item) => `<div><strong>${UI.escapeHtml(item.command)}</strong><div class="muted">${UI.escapeHtml(item.note)}</div></div>`).join('') || '<span class="muted">No automation actions logged yet.</span>'}</div></div>
            <div class="card-row"><strong>Recommended automations</strong><div class="stack">${simulation.recommendedAutomations.map((command) => `<button class="ghost-btn" data-action="run-automation-command" data-command="${command}">${command}</button>`).join('') || '<span class="muted">No simulation automation recommendation right now.</span>'}</div></div>
          </div>
        </div>
      </section>`;
  }

  function timelineView() {
    const typeFilter = workspace.ui.filters.timelineType;
    const campaignFilter = workspace.ui.filters.timelineCampaignId;
    const entries = workspace.timeline.filter((entry) => (typeFilter === 'all' || entry.type === typeFilter) && (campaignFilter === 'all' || entry.campaignId === campaignFilter));
    return `
      <section class="surface stack">
        <div class="row-between"><div><p class="eyebrow">Timeline Engine</p><h3>Filterable operational timeline</h3></div><div class="segmented"><select data-change="timeline-type-filter"><option value="all">All types</option>${[...new Set(workspace.timeline.map((entry) => entry.type))].map((type) => `<option value="${UI.escapeHtml(type)}" ${typeFilter === type ? 'selected' : ''}>${UI.escapeHtml(type)}</option>`).join('')}</select><select data-change="timeline-campaign-filter"><option value="all">All campaigns</option>${workspace.campaigns.map((campaign) => `<option value="${campaign.id}" ${campaignFilter === campaign.id ? 'selected' : ''}>${UI.escapeHtml(campaign.title)}</option>`).join('')}</select></div></div>
        <div class="timeline-list">${entries.map((entry) => `<div class="timeline-item"><div class="row-between"><strong>${UI.escapeHtml(entry.type)}</strong>${UI.badge(entry.severity)}</div><p>${UI.escapeHtml(entry.message)}</p><div class="timeline-meta"><span>${entry.campaignId ? UI.escapeHtml(workspace.campaigns.find((campaign) => campaign.id === entry.campaignId)?.title || 'Workspace') : 'Workspace'}</span><span>${UI.formatDateTime(entry.createdAt)}</span></div></div>`).join('')}</div>
      </section>`;
  }

  function settingsView() {
    const snapshots = Storage.listSnapshots();
    return `
      <section class="surface stack">
        <div><p class="eyebrow">Workspace Control</p><h3>Settings, backup, automation recipes, and polish controls</h3></div>
        <div class="detail-grid">
          <div class="card-row"><strong>Theme</strong><div class="segmented"><button class="ghost-btn" data-action="set-theme" data-value="light">Light</button><button class="ghost-btn" data-action="set-theme" data-value="dark">Dark</button></div></div>
          <div class="card-row"><strong>Density</strong><div class="segmented"><button class="ghost-btn" data-action="set-density" data-value="comfortable">Comfortable</button><button class="ghost-btn" data-action="set-density" data-value="compact">Compact</button></div></div>
          <div class="card-row"><strong>Operational sound</strong><p class="muted">Optional confirmation tones for approvals, blockers, and automations. Off by default.</p><button class="ghost-btn" data-action="toggle-sounds">${workspace.settings.soundsEnabled ? 'Disable sounds' : 'Enable sounds'}</button></div>
          <div class="card-row"><strong>Backup</strong><div class="segmented"><button class="chip-btn" data-action="export-workspace">Export JSON</button><button class="chip-btn" data-action="import-workspace">Import JSON</button><button class="chip-btn" data-action="save-snapshot">Save Snapshot</button></div></div>
          <div class="card-row"><strong>Reset</strong><p class="muted">Reset the workspace to seeded launch data with confirmation.</p><button class="danger-btn" data-action="confirm-reset">Reset Demo Data</button></div>
        </div>
        <div class="card-row"><strong>Automation recipes</strong><div class="stack">${Object.entries(workspace.settings.recipes).map(([key, enabled]) => `<button class="ghost-btn" data-action="toggle-recipe" data-key="${key}">${enabled ? 'Enabled' : 'Disabled'} · ${key}</button>`).join('')}</div></div>
        <div class="card-row"><strong>Snapshots</strong><div class="stack">${snapshots.map((entry) => `<div class="row-between"><span>${UI.formatDateTime(entry.createdAt)}</span><div class="segmented"><button class="chip-btn" data-action="restore-snapshot" data-id="${entry.id}">Restore</button><button class="danger-btn" data-action="delete-snapshot" data-id="${entry.id}">Delete</button></div></div>`).join('') || '<span class="muted">No snapshots saved yet.</span>'}</div></div>
      </section>`;
  }

  function renderRoute() {
    switch (workspace.ui.route) {
      case 'dashboard': return dashboardView();
      case 'campaigns': return Campaigns.renderCampaigns(workspace);
      case 'matrix': return Campaigns.renderMatrix(workspace);
      case 'revisions': return Revisions.render(workspace);
      case 'approvals': return Approvals.render(workspace);
      case 'launchbrain': return launchBrainView();
      case 'delivery': return Delivery.render(workspace);
      case 'timeline': return timelineView();
      case 'reports': return Reports.render(workspace);
      case 'settings': return settingsView();
      default: return dashboardView();
    }
  }

  function renderSimulationPanel() {
    const simulation = workspace.lastSimulation || runSimulation();
    const recommendedCommands = ['createMissingAssetTasks', 'createApprovalReminder', 'createRevisionFollowUp', 'moveCampaignToReadyIfComplete', 'exportLaunchSummary'];
    const confidenceDegrees = Math.max(18, Math.round((simulation.launchConfidence / 100) * 360));
    const delayText = simulation.possibleLaunchDelay ? `${simulation.possibleLaunchDelay} day delay risk` : 'No launch delay projected';
    return `
      <div class="simulation-shell">
        <div class="simulation-topline">
          <div>
            <p class="eyebrow">Launch Simulation Mode</p>
            <h3>Operational launch scenario review</h3>
            <p class="muted">Deterministic rule-based stress test for launch readiness, blockers, approvals, revisions, and delivery coverage.</p>
          </div>
          <div class="segmented">
            <span class="kbd">Generated ${UI.formatDateTime(simulation.createdAt)}</span>
            <span class="kbd">${simulation.blockerCount} blocker groups</span>
          </div>
        </div>
        <div class="card-row simulation-hero risk-shell-${simulation.readinessState}">
          <div class="simulation-meter-shell">
            <div class="confidence-meter">
              <div class="confidence-ring confidence-ring-${simulation.readinessState}" style="--confidence-deg:${confidenceDegrees}deg;">
                <div class="confidence-ring-inner">
                  <div class="confidence-value counter-value" data-count="${simulation.launchConfidence}">${simulation.launchConfidence}</div>
                  <span>% confidence</span>
                </div>
              </div>
            </div>
            <div class="pulse-row">
              <span class="pulse-dot pulse-${simulation.readinessState}"></span>
              <span class="muted">${simulation.confidenceStatus} operational posture</span>
            </div>
          </div>
          <div class="simulation-hero-copy">
            <div class="row-between"><strong>Launch Confidence Meter</strong>${UI.badge(simulation.confidenceStatus)}</div>
            <h2 class="simulation-risk-title">${simulation.confidenceStatus} · ${simulation.riskLabel} launch risk</h2>
            <p class="muted">Projected readiness ${simulation.projectedReadiness}% · platform readiness ${simulation.platformReadiness}% · ${delayText}</p>
            <div class="simulation-impact-grid">
              <div class="simulation-impact-card">
                <span>Launch Risk Score</span>
                <strong class="counter-value" data-count="${simulation.launchRiskScore}">${simulation.launchRiskScore}</strong>
              </div>
              <div class="simulation-impact-card">
                <span>Projected Readiness</span>
                <strong class="counter-value" data-count="${simulation.projectedReadiness}">${simulation.projectedReadiness}</strong>
              </div>
              <div class="simulation-impact-card critical-rail">
                <span>Critical Blocking Issues</span>
                <strong class="counter-value" data-count="${simulation.blockerCount}">${simulation.blockerCount}</strong>
              </div>
              <div class="simulation-impact-card">
                <span>Operational Confidence</span>
                <strong>${simulation.confidenceStatus}</strong>
              </div>
            </div>
            <div class="progress-bar simulation-progress">
              <div class="progress-fill live-progress" style="width:${simulation.launchConfidence}%"></div>
            </div>
          </div>
        </div>
        <div class="double-grid">
          <div class="stack">
            <div class="card-row critical-rail">
              <div class="row-between"><strong>Critical blockers</strong>${UI.badge(simulation.blockerCount)}</div>
              <ul class="plain-list">${simulation.criticalBlockers.map((item) => `<li>${UI.escapeHtml(item)}</li>`).join('')}</ul>
            </div>
            <div class="card-row warning-rail">
              <strong>Launch impact projection</strong>
              <div class="detail-grid compact-grid simulation-projection-grid">
                <div class="projection-tile"><span>Projected readiness</span><strong>${simulation.projectedReadiness}%</strong></div>
                <div class="projection-tile"><span>Possible launch delay</span><strong>${delayText}</strong></div>
                <div class="projection-tile"><span>Platform readiness</span><strong>${simulation.platformReadiness}%</strong></div>
                <div class="projection-tile"><span>Operational confidence</span><strong>${simulation.confidenceStatus}</strong></div>
              </div>
            </div>
            <div class="card-row"><strong>Operational warnings</strong><ul class="plain-list">${simulation.operationalWarnings.map((item) => `<li>${UI.escapeHtml(item)}</li>`).join('')}</ul></div>
          </div>
          <div class="stack">
            <div class="card-row">
              <strong>Recommended automation actions</strong>
              <div class="stack simulation-actions">
                ${recommendedCommands.map((command) => `<button class="${simulation.recommendedAutomations.includes(command) ? 'primary-btn' : 'ghost-btn'}" data-action="run-automation-command" data-command="${command}">${simulation.recommendedAutomations.includes(command) ? 'Recommended · ' : ''}${command}</button>`).join('')}
              </div>
            </div>
            <div class="card-row">
              <strong>Simulation timeline</strong>
              <div class="automation-feed">${simulation.timelineSteps.map((item) => `<div class="feed-item tone-${UI.escapeHtml(String(item.tone).toLowerCase())}"><span class="pulse-dot pulse-${UI.escapeHtml(String(item.tone).toLowerCase())}"></span><div><strong>${UI.escapeHtml(item.label)}</strong><div class="muted">${UI.escapeHtml(item.detail)}</div></div></div>`).join('')}</div>
            </div>
            <div class="card-row"><strong>Simulation activity</strong><div class="automation-feed">${simulation.simulationFeed.map((item) => `<div class="feed-item tone-${UI.escapeHtml(String(item.tone).toLowerCase())}"><span class="pulse-dot pulse-${UI.escapeHtml(String(item.tone).toLowerCase())}"></span><div><strong>${UI.escapeHtml(item.label)}</strong><div class="muted">${UI.escapeHtml(item.detail)}</div></div></div>`).join('')}</div></div>
          </div>
        </div>
      </div>`;
  }

  function openSimulationModal() {
    const scanSteps = [
      'Analyzing launch readiness...',
      'Checking approvals...',
      'Scanning blockers...',
      'Reviewing unresolved revisions...',
      'Validating platform coverage...',
      'Calculating operational confidence...'
    ];
    const actions = '<div class="segmented"><button class="ghost-btn" data-action="close-modal">Close</button><button class="ghost-btn" data-action="run-launch-simulation">Run Again</button><button class="primary-btn" data-action="export-simulation-report">Export Simulation Report</button></div>';
    clearSimulationTimers();
    const modalId = UI.openModal(
      'Launch Simulation',
      `<div class="simulation-scan-shell"><div class="scan-status pulse-row"><span class="pulse-dot pulse-info"></span><span class="muted">Preparing deterministic launch scan...</span></div><div class="scan-progress"><div class="scan-progress-bar" style="width:8%"></div></div><div class="scan-step-list">${scanSteps.map((step, index) => `<div class="scan-step ${index === 0 ? 'is-active' : ''}" data-step-index="${index}"><span class="scan-step-index">0${index + 1}</span><span>${UI.escapeHtml(step)}</span></div>`).join('')}</div></div>`,
      '<div class="segmented"><button class="ghost-btn" data-action="close-modal">Close</button></div>',
      { modalClass: 'simulation-modal', backdropClass: 'simulation-backdrop', eyebrow: 'Rule-Based Scenario Review' }
    );
    UI.registerModalCleanup(() => {
      clearSimulationTimers();
    });
    const progressBar = document.querySelector('.scan-progress-bar');
    const stepNodes = Array.from(document.querySelectorAll('.scan-step'));
    scanSteps.forEach((_, index) => {
      const timerId = window.setTimeout(() => {
        if (!UI.isModalActive(modalId)) return;
        stepNodes.forEach((node, nodeIndex) => node.classList.toggle('is-active', nodeIndex === index));
        stepNodes.forEach((node, nodeIndex) => node.classList.toggle('is-complete', nodeIndex < index));
        if (progressBar) progressBar.style.width = `${Math.round(((index + 1) / scanSteps.length) * 100)}%`;
      }, index * 220);
      simulationTimerIds.push(timerId);
    });
    simulationTimerIds.push(window.setTimeout(() => {
      if (!UI.isModalActive(modalId)) return;
      const simulation = runSimulation(true);
      save();
      UI.setModalContent('Launch Simulation', renderSimulationPanel(), actions, {
        modalId,
        modalClass: 'simulation-modal',
        backdropClass: 'simulation-backdrop',
        eyebrow: 'Rule-Based Scenario Review'
      });
      animateUI();
      UI.toast(`Launch simulation completed at ${simulation.launchConfidence}% confidence.`, simulation.readinessState === 'critical' ? 'warning' : 'info');
      playSound(simulation.readinessState === 'critical' ? 'warning' : 'automation');
    }, scanSteps.length * 220 + 120));
  }

  function animateUI() {
    document.querySelectorAll('.counter-value').forEach((node) => {
      const target = Number(node.dataset.count);
      if (!Number.isFinite(target)) return;
      if (node.dataset.animated === String(target)) return;
      node.dataset.animated = String(target);
      const duration = 500;
      const start = performance.now();
      const from = Number(node.textContent) || 0;
      const step = (time) => {
        const progress = Math.min(1, (time - start) / duration);
        node.textContent = String(Math.round(from + ((target - from) * progress)));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function refreshAll() {
    workspace.campaigns.forEach((campaign) => recalcCampaign(campaign.id));
    scanLaunchBrain();
    runSimulation();
    save();
    render();
  }

  actionMap = {
    'open-campaign-modal': () => Campaigns.renderCampaignModal(workspace),
    'view-campaign': (event) => Campaigns.renderCampaignDetail(workspace, event.target.dataset.id),
    'edit-campaign': (event) => Campaigns.renderCampaignModal(workspace, event.target.dataset.id),
    'duplicate-campaign': (event) => {
      const source = workspace.campaigns.find((item) => item.id === event.target.dataset.id);
      const cloneId = State.nextId('camp');
      const clone = { ...structuredClone(source), id: cloneId, title: `${source.title} Copy`, status: 'Planning', archived: false };
      workspace.campaigns.unshift(clone);
      workspace.matrixItems.filter((item) => item.campaignId === source.id).forEach((item) => workspace.matrixItems.push({ ...structuredClone(item), id: State.nextId('matrix'), campaignId: cloneId, locked: false }));
      workspace.deliveries.push({ id: State.nextId('delivery'), campaignId: cloneId, deliveredAssets: clone.platforms.join(', '), finalApprovalStatus: 'Pending', checklist: { creatives: false, captions: false, adCopy: false, landingPage: false, reportPrepared: false, clientAccepted: false }, clientAcceptance: false, deliveryNotes: 'Duplicated campaign delivery shell created.', archived: false });
      addTimeline(clone.id, 'Campaign created', 'info', `${clone.title} duplicated from ${source.title}.`);
      refreshAll();
      UI.toast('Campaign duplicated.');
      playSound('automation');
    },
    'delete-campaign': (event) => {
      const id = event.target.dataset.id;
      const campaign = workspace.campaigns.find((item) => item.id === id);
      UI.openModal('Delete Campaign', `<p>Delete ${UI.escapeHtml(campaign.title)} and all linked workflow items?</p>`, `<button class="danger-btn" data-action="confirm-delete-campaign" data-id="${id}">Delete Permanently</button>`);
    },
    'confirm-delete-campaign': (event) => {
      const id = event.target.dataset.id;
      workspace.campaigns = workspace.campaigns.filter((item) => item.id !== id);
      workspace.matrixItems = workspace.matrixItems.filter((item) => item.campaignId !== id);
      workspace.revisions = workspace.revisions.filter((item) => item.campaignId !== id);
      workspace.approvals = workspace.approvals.filter((item) => item.campaignId !== id);
      workspace.deliveries = workspace.deliveries.filter((item) => item.campaignId !== id);
      addTimeline('', 'Campaign deleted', 'warning', 'A campaign and its related records were deleted.');
      UI.closeModal();
      refreshAll();
      UI.toast('Campaign deleted.', 'warning');
      playSound('warning');
    },
    'cycle-matrix-status': (event) => {
      const item = workspace.matrixItems.find((entry) => entry.id === event.target.dataset.id);
      const cycle = ['Missing', 'Draft', 'Needs Review', 'Approved', 'Ready', 'Delivered'];
      item.status = cycle[(cycle.indexOf(item.status) + 1) % cycle.length];
      item.copyStatus = item.status;
      item.creativeStatus = item.status;
      item.approvalStatus = ['Approved', 'Ready', 'Delivered'].includes(item.status) ? 'Approved' : 'Pending';
      addTimeline(item.campaignId, 'Asset updated', 'info', `${item.platform} status advanced to ${item.status}.`);
      refreshAll();
      UI.toast('Launch Matrix item advanced.');
    },
    'open-revision-modal': () => Revisions.openCreateModal(workspace),
    'toggle-revision': (event) => {
      const revision = workspace.revisions.find((entry) => entry.id === event.target.dataset.id);
      revision.status = revision.status === 'Resolved' ? 'Reopened' : 'Resolved';
      revision.resolvedDate = revision.status === 'Resolved' ? new Date().toISOString() : null;
      addTimeline(revision.campaignId, revision.status === 'Resolved' ? 'Revision resolved' : 'Revision reopened', revision.priority === 'Critical' ? 'critical' : 'warning', `${revision.assetPlatform} revision ${revision.status.toLowerCase()}.`);
      refreshAll();
      UI.toast(`Revision ${revision.status.toLowerCase()}.`);
      playSound(revision.status === 'Resolved' ? 'success' : 'warning');
    },
    'promote-revision': (event) => {
      const revision = workspace.revisions.find((entry) => entry.id === event.target.dataset.id);
      const order = ['Low','Medium','High','Critical'];
      revision.priority = order[Math.min(order.length - 1, order.indexOf(revision.priority) + 1)];
      revision.roundCount += 1;
      addTimeline(revision.campaignId, 'Revision created', 'high', `${revision.assetPlatform} priority raised to ${revision.priority}.`);
      refreshAll();
      UI.toast('Revision priority promoted.', 'warning');
      playSound('warning');
    },
    'approval-decision': (event) => {
      const approval = workspace.approvals.find((entry) => entry.id === event.target.dataset.id);
      approval.status = event.target.dataset.value;
      approval.decidedAt = new Date().toISOString();
      approval.finalApproval = approval.status === 'Final Approved';
      addTimeline(approval.campaignId, 'Approval requested', approval.status === 'Revision Requested' ? 'high' : 'info', `${approval.assetName} moved to ${approval.status}.`);
      refreshAll();
      UI.toast(`Approval marked ${approval.status}.`);
      playSound(approval.status === 'Revision Requested' ? 'warning' : 'success');
    },
    'run-launchbrain': () => {
      Automations.applyRecipes(workspace);
      scanLaunchBrain();
      runSimulation();
      save();
      render();
      UI.toast('LaunchBrain scan completed.');
      playSound('automation');
    },
    'run-launch-simulation': () => {
      openSimulationModal();
    },
    'export-simulation-report': () => {
      const simulation = runSimulation(true);
      save();
      Exports.exportSimulationReport(workspace);
      const frame = document.getElementById('report-output');
      if (frame) frame.textContent = JSON.stringify(simulation, null, 2);
      UI.toast('Simulation report exported.');
    },
    'export-operational-summary': () => {
      const summary = Exports.exportOperationalSummary(workspace);
      const frame = document.getElementById('report-output');
      if (frame) frame.textContent = JSON.stringify(summary, null, 2);
      UI.toast('Operational summary exported.');
    },
    'run-automation-command': (event) => {
      const command = event.target.dataset.command;
      const highPriorityAlert = workspace.alerts.find((alert) => alert.suggestedCommand === command);
      const targetCampaignId = highPriorityAlert?.affectedCampaign || workspace.campaigns[0]?.id;
      const result = Automations.commands[command]?.(workspace, targetCampaignId) || { ok: false, message: 'No automation mapped.' };
      refreshAll();
      UI.toast(result.message, result.ok ? 'info' : 'warning');
      if (result.ok) playSound('automation');
    },
    'dismiss-alert': (event) => {
      const id = event.target.dataset.id;
      if (!workspace.dismissedAlerts.includes(id)) workspace.dismissedAlerts.push(id);
      save(); render();
    },
    'apply-alert-action': (event) => {
      const alert = workspace.alerts.find((entry) => entry.id === event.target.dataset.id);
      const result = Automations.commands[alert.suggestedCommand]?.(workspace, alert.affectedCampaign) || { ok: false, message: 'No automation mapped.' };
      refreshAll();
      UI.toast(result.message, result.ok ? 'info' : 'warning');
      if (result.ok) playSound('automation');
    },
    'toggle-delivery-check': (event) => {
      const delivery = workspace.deliveries.find((entry) => entry.id === event.target.dataset.id);
      const key = event.target.dataset.key;
      delivery.checklist[key] = !delivery.checklist[key];
      addTimeline(delivery.campaignId, 'Delivery accepted', 'info', `${key} toggled in delivery checklist.`);
      refreshAll();
    },
    'toggle-client-acceptance': (event) => {
      const delivery = workspace.deliveries.find((entry) => entry.id === event.target.dataset.id);
      delivery.clientAcceptance = !delivery.clientAcceptance;
      delivery.checklist.clientAccepted = delivery.clientAcceptance;
      addTimeline(delivery.campaignId, 'Delivery accepted', delivery.clientAcceptance ? 'info' : 'warning', `Client acceptance ${delivery.clientAcceptance ? 'recorded' : 'reopened'}.`);
      refreshAll();
      UI.toast(delivery.clientAcceptance ? 'Client acceptance recorded.' : 'Client acceptance removed.');
      playSound(delivery.clientAcceptance ? 'success' : 'warning');
    },
    'export-delivery-summary': (event) => {
      const delivery = workspace.deliveries.find((entry) => entry.id === event.target.dataset.id);
      const campaign = workspace.campaigns.find((entry) => entry.id === delivery.campaignId);
      UI.openModal('Delivery Summary', `<pre>${UI.escapeHtml(JSON.stringify({ campaign: campaign.title, delivery }, null, 2))}</pre>`);
      UI.toast('Delivery summary generated.');
    },
    'archive-delivery': (event) => {
      const result = Automations.commands.archiveDeliveredCampaign(workspace, event.target.dataset.id);
      refreshAll();
      UI.toast(result.message, result.ok ? 'info' : 'warning');
      if (result.ok) playSound('automation');
    },
    'print-report': (event) => {
      const html = Exports.renderReport(workspace, event.target.dataset.report);
      const frame = document.getElementById('report-output');
      if (frame) frame.textContent = html;
      UI.toast('Printable report exported.');
    },
    'export-workspace': () => { Exports.exportWorkspace(workspace); UI.toast('Workspace JSON exported.'); addTimeline('', 'Workspace exported/imported', 'info', 'Workspace JSON exported.'); save(); },
    'import-workspace': () => document.getElementById('import-input').click(),
    'confirm-import-workspace': () => {
      if (!pendingImportWorkspace) {
        UI.toast('No import payload is waiting for confirmation.', 'warning');
        return;
      }
      workspace = pendingImportWorkspace;
      pendingImportWorkspace = null;
      UI.closeModal();
      addTimeline('', 'Workspace exported/imported', 'info', 'Workspace JSON imported.');
      refreshAll();
      UI.toast('Workspace imported.');
    },
    'cancel-import-workspace': () => {
      pendingImportWorkspace = null;
      UI.closeModal();
    },
    'save-snapshot': () => {
      Storage.saveSnapshot({ id: State.nextId('snap'), createdAt: new Date().toISOString(), workspace });
      UI.toast('Snapshot saved.'); render();
    },
    'restore-snapshot': (event) => {
      const snapshot = Storage.listSnapshots().find((entry) => entry.id === event.target.dataset.id);
      workspace = structuredClone(snapshot.workspace);
      save(); render(); UI.toast('Snapshot restored.');
    },
    'delete-snapshot': (event) => { Storage.deleteSnapshot(event.target.dataset.id); render(); UI.toast('Snapshot deleted.'); },
    'confirm-reset': () => { UI.openModal('Reset Demo Data', '<p>This will overwrite the current workspace with the seeded launch operations dataset.</p>', '<button class="danger-btn" data-action="reset-workspace">Reset Workspace</button>'); },
    'reset-workspace': () => { workspace = SeedData.seed(); UI.closeModal(); refreshAll(); UI.toast('Demo workspace reset.', 'warning'); },
    'set-theme': (event) => { workspace.settings.theme = event.target.dataset.value; document.documentElement.dataset.theme = workspace.settings.theme; save(); render(); },
    'set-density': (event) => { workspace.settings.density = event.target.dataset.value; document.documentElement.dataset.density = workspace.settings.density; save(); render(); },
    'toggle-sounds': () => {
      workspace.settings.soundsEnabled = !workspace.settings.soundsEnabled;
      save();
      render();
      UI.toast(workspace.settings.soundsEnabled ? 'Operational sounds enabled.' : 'Operational sounds disabled.');
    },
    'toggle-recipe': (event) => { const key = event.target.dataset.key; workspace.settings.recipes[key] = !workspace.settings.recipes[key]; save(); render(); },
    'close-modal': () => UI.closeModal()
  };

  function onSubmit(event) {
    const form = event.target;
    if (form.dataset.form === 'campaign-form') {
      event.preventDefault();
      const formData = new FormData(form);
      const platforms = Array.from(form.querySelector('[name="platforms"]').selectedOptions).map((option) => option.value);
      const payload = {
        title: formData.get('title'),
        client: formData.get('client'),
        owner: formData.get('owner'),
        launchDate: formData.get('launchDate'),
        platforms,
        status: formData.get('status'),
        readinessScore: Number(formData.get('readinessScore')),
        riskLevel: formData.get('riskLevel'),
        notes: formData.get('notes'),
        daysInStatus: 0,
        archived: false
      };
      if (form.dataset.id) {
        Object.assign(workspace.campaigns.find((item) => item.id === form.dataset.id), payload);
        addTimeline(form.dataset.id, 'Status changed', 'info', `${payload.title} campaign updated.`);
      } else {
        const id = State.nextId('camp');
        workspace.campaigns.unshift({ id, ...payload });
        payload.platforms.forEach((platform) => workspace.matrixItems.push({ id: State.nextId('matrix'), campaignId: id, platform, requiredAssets: 'Creative, copy, CTA', copyStatus: 'Draft', creativeStatus: 'Draft', approvalStatus: 'Pending', scheduledStatus: 'Not Scheduled', blockerStatus: 'None', status: 'Draft', locked: false }));
        workspace.deliveries.push({ id: State.nextId('delivery'), campaignId: id, deliveredAssets: payload.platforms.join(', '), finalApprovalStatus: 'Pending', checklist: { creatives: false, captions: false, adCopy: false, landingPage: false, reportPrepared: false, clientAccepted: false }, clientAcceptance: false, deliveryNotes: '', archived: false });
        addTimeline(id, 'Campaign created', 'info', `${payload.title} campaign created.`);
      }
      UI.closeModal();
      refreshAll();
      UI.toast('Campaign saved.');
      playSound('success');
    }
    if (form.dataset.form === 'revision-form') {
      event.preventDefault();
      const formData = new FormData(form);
      const revision = {
        id: State.nextId('rev'),
        campaignId: formData.get('campaignId'),
        assetPlatform: formData.get('assetPlatform'),
        comment: formData.get('comment'),
        priority: formData.get('priority'),
        status: 'Open',
        owner: formData.get('owner'),
        createdDate: new Date().toISOString(),
        resolvedDate: null,
        roundCount: 1,
        approvalImpact: formData.get('priority')
      };
      workspace.revisions.unshift(revision);
      addTimeline(revision.campaignId, 'Revision created', revision.priority === 'Critical' ? 'critical' : 'warning', `${revision.assetPlatform} revision created.`);
      UI.closeModal();
      refreshAll();
      UI.toast('Revision created.', 'warning');
      playSound('warning');
    }
  }

  function onChange(event) {
    const control = event.target.dataset.change;
    if (!control) return;
    if (control === 'campaign-status-filter') workspace.ui.filters.campaignStatus = event.target.value;
    if (control === 'campaign-search') workspace.ui.search = event.target.value;
    if (control === 'matrix-campaign-filter') workspace.ui.filters.matrixCampaignId = event.target.value;
    if (control === 'revision-status-filter') workspace.ui.filters.revisionStatus = event.target.value;
    if (control === 'timeline-type-filter') workspace.ui.filters.timelineType = event.target.value;
    if (control === 'timeline-campaign-filter') workspace.ui.filters.timelineCampaignId = event.target.value;
    render();
  }

  function render() {
    workspace.ui.route = Router.getRoute();
    document.getElementById('route-title').textContent = State.routeLabels[workspace.ui.route];
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.route === workspace.ui.route));
    document.getElementById('global-alert-strip').innerHTML = workspace.alerts.length ? `<div class="surface critical-strip"><div class="row-between"><div><strong>${workspace.alerts.length} LaunchBrain alerts detected</strong><div class="muted">${workspace.alerts.filter((alert) => alert.severity === 'critical').length} critical, ${workspace.alerts.filter((alert) => alert.severity === 'high').length} high</div></div><button class="ghost-btn" data-route="launchbrain">Open LaunchBrain</button></div></div>` : '';
    const view = document.getElementById('app-view');
    view.classList.remove('route-fade-in');
    void view.offsetWidth;
    view.innerHTML = renderRoute();
    view.classList.add('route-fade-in');
    const issues = QAGuard.validate(workspace, actionMap);
    window.__launchflowQA = issues;
    animateUI();
  }

  function bindEvents() {
    UI.initModalSystem();
    document.addEventListener('click', (event) => {
      const routeButton = event.target.closest('[data-route]');
      if (routeButton) {
        UI.closeModal();
        Router.setRoute(routeButton.dataset.route);
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) {
        const action = actionButton.dataset.action;
        if (actionMap[action]) actionMap[action](event);
      }
    });
    document.addEventListener('submit', onSubmit);
    document.addEventListener('change', onChange);
    document.getElementById('import-input').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || !Array.isArray(parsed.campaigns) || !Array.isArray(parsed.timeline)) {
            throw new Error('Workspace structure is invalid.');
          }
          pendingImportWorkspace = parsed;
          UI.openModal(
            'Import Workspace',
            '<p>This will overwrite the current workspace in memory and LocalStorage. Continue with the imported backup?</p>',
            '<div class="segmented"><button class="ghost-btn" data-action="cancel-import-workspace">Cancel</button><button class="primary-btn" data-action="confirm-import-workspace">Overwrite Workspace</button></div>'
          );
        } catch (error) {
          pendingImportWorkspace = null;
          UI.toast('Import failed. Use a valid LaunchFlow workspace JSON backup.', 'warning');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    });
    Router.onChange(() => {
      UI.closeModal();
      render();
    });
  }

  function init() {
    initWorkspace();
    bindEvents();
    render();
  }

  return { init, render, getWorkspace: () => workspace, actions: actionMap };
})();

document.addEventListener('DOMContentLoaded', () => window.LaunchFlow.App.init());

