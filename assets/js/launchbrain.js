window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.LaunchBrain = (() => {
  function severityForReadiness(score) {
    if (score < 50) return 'critical';
    if (score < 70) return 'high';
    return 'warning';
  }

  function createInsight({ id, title, severity, reason, recommendedAction, affectedCampaign, suggestedCommand }) {
    return {
      id,
      title,
      severity,
      reason,
      recommendedAction,
      affectedCampaign,
      suggestedCommand,
      createdTimestamp: new Date().toISOString()
    };
  }

  function daysToLaunch(dateString) {
    if (!dateString) return null;
    return Math.round((new Date(dateString).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  }

  function getCampaignBundle(workspace, campaign) {
    return {
      matrixItems: workspace.matrixItems.filter((item) => item.campaignId === campaign.id),
      approvals: workspace.approvals.filter((item) => item.campaignId === campaign.id),
      revisions: workspace.revisions.filter((item) => item.campaignId === campaign.id),
      delivery: workspace.deliveries.find((item) => item.campaignId === campaign.id)
    };
  }

  function scan(workspace) {
    const alerts = [];
    workspace.campaigns.forEach((campaign) => {
      const launchDelta = daysToLaunch(campaign.launchDate);
      const { matrixItems, approvals, revisions, delivery } = getCampaignBundle(workspace, campaign);

      if (campaign.launchDate && launchDelta <= 1 && campaign.readinessScore < 85) {
        alerts.push(createInsight({
          id: `near-launch-${campaign.id}`,
          title: 'Launch window is too close for current readiness',
          severity: campaign.readinessScore < 65 ? 'critical' : 'high',
          reason: `${campaign.title} launches within 24 hours with readiness at ${campaign.readinessScore}%.`,
          recommendedAction: 'Run missing asset task creation and escalate approvals immediately.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'createMissingAssetTasks'
        }));
      }

      if (matrixItems.some((item) => item.status === 'Missing' || item.creativeStatus === 'Missing' || item.blockerStatus === 'Missing asset')) {
        alerts.push(createInsight({
          id: `assets-missing-${campaign.id}`,
          title: 'Required platform assets are still missing',
          severity: 'high',
          reason: 'One or more launch channels still have missing asset coverage.',
          recommendedAction: 'Generate missing asset tasks and assign owners before launch.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'createMissingAssetTasks'
        }));
      }

      if (approvals.some((approval) => approval.status === 'Pending' && ((Date.now() - new Date(approval.requestedAt).getTime()) / 86400000) > 2)) {
        alerts.push(createInsight({
          id: `approval-overdue-${campaign.id}`,
          title: 'Client approval has gone overdue',
          severity: 'warning',
          reason: 'A pending approval has been waiting more than 48 hours.',
          recommendedAction: 'Create a follow-up reminder and mark the campaign at risk if needed.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'createApprovalReminder'
        }));
      }

      if (revisions.some((revision) => ['High', 'Critical'].includes(revision.priority) && revision.status !== 'Resolved')) {
        alerts.push(createInsight({
          id: `priority-revision-${campaign.id}`,
          title: 'High-priority revisions are unresolved',
          severity: 'high',
          reason: 'Open revision work is still blocking launch confidence.',
          recommendedAction: 'Create revision follow-up and reduce readiness until closed.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'createRevisionFollowUp'
        }));
      }

      if (campaign.readinessScore < 70) {
        alerts.push(createInsight({
          id: `low-readiness-${campaign.id}`,
          title: 'Readiness score is below threshold',
          severity: severityForReadiness(campaign.readinessScore),
          reason: `${campaign.title} is below the 70% readiness threshold.`,
          recommendedAction: 'Review blockers and move only when critical assets and approvals are complete.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'exportLaunchSummary'
        }));
      }

      if ((campaign.daysInStatus || 0) > 4) {
        alerts.push(createInsight({
          id: `stalled-status-${campaign.id}`,
          title: 'Campaign has stalled in the same status',
          severity: 'warning',
          reason: `${campaign.title} has remained in ${campaign.status} for ${campaign.daysInStatus} days.`,
          recommendedAction: 'Advance ownership, confirm blockers, or update status to reflect reality.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'addTimelineEvent'
        }));
      }

      if (delivery && campaign.launchDate && new Date(campaign.launchDate) < new Date() && !delivery.clientAcceptance) {
        alerts.push(createInsight({
          id: `delivery-incomplete-${campaign.id}`,
          title: 'Delivery is incomplete after launch',
          severity: 'warning',
          reason: 'Launch date has passed and client acceptance is not logged.',
          recommendedAction: 'Confirm handoff, capture acceptance, or archive once complete.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'archiveDeliveredCampaign'
        }));
      }

      if (revisions.some((revision) => revision.roundCount > 3)) {
        alerts.push(createInsight({
          id: `revision-rounds-${campaign.id}`,
          title: 'Revision rounds are escalating',
          severity: 'high',
          reason: 'One or more assets exceeded three revision rounds.',
          recommendedAction: 'Trigger escalation, align on a final decision, and lock approved assets.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'lockApprovedAssets'
        }));
      }

      if (matrixItems.some((item) => !['Approved', 'Ready', 'Delivered'].includes(item.status))) {
        alerts.push(createInsight({
          id: `matrix-incomplete-${campaign.id}`,
          title: 'Platform checklist is incomplete',
          severity: 'warning',
          reason: 'At least one launch channel is not yet approved or ready.',
          recommendedAction: 'Review the Launch Matrix and close outstanding statuses.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'moveCampaignToReadyIfComplete'
        }));
      }

      if (!campaign.owner) {
        alerts.push(createInsight({
          id: `missing-owner-${campaign.id}`,
          title: 'Campaign has no owner assigned',
          severity: 'critical',
          reason: 'Launch ownership is missing, which blocks accountability.',
          recommendedAction: 'Assign an owner before approval and delivery steps continue.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'addTimelineEvent'
        }));
      }

      if (!campaign.launchDate) {
        alerts.push(createInsight({
          id: `missing-date-${campaign.id}`,
          title: 'Campaign has no launch date assigned',
          severity: 'high',
          reason: 'Timeline sequencing cannot be trusted without a launch date.',
          recommendedAction: 'Set a launch date before scheduling and client approval loops continue.',
          affectedCampaign: campaign.id,
          suggestedCommand: 'addTimelineEvent'
        }));
      }
    });

    return alerts;
  }

  function simulate(workspace) {
    const openRevisions = workspace.revisions.filter((revision) => revision.status !== 'Resolved');
    const overdueApprovals = workspace.approvals.filter((approval) => approval.status === 'Pending' && ((Date.now() - new Date(approval.requestedAt).getTime()) / 86400000) > 2);
    const missingAssets = workspace.matrixItems.filter((item) => item.status === 'Missing' || item.creativeStatus === 'Missing');
    const incompletePlatforms = workspace.matrixItems.filter((item) => !['Approved', 'Ready', 'Delivered'].includes(item.status));
    const incompleteDeliveries = workspace.deliveries.filter((delivery) => !delivery.clientAcceptance || Object.values(delivery.checklist).some((value) => !value));
    const launchesWithin24h = workspace.campaigns.filter((campaign) => campaign.launchDate && daysToLaunch(campaign.launchDate) !== null && daysToLaunch(campaign.launchDate) <= 1 && daysToLaunch(campaign.launchDate) >= 0);
    const overdueLaunches = workspace.campaigns.filter((campaign) => campaign.launchDate && daysToLaunch(campaign.launchDate) < 0 && !campaign.archived);
    const criticalBlockers = [];
    const recommendedAutomations = new Set();
    const warnings = [];
    const simulationFeed = [];

    workspace.campaigns.forEach((campaign) => {
      const { matrixItems, approvals, revisions, delivery } = getCampaignBundle(workspace, campaign);
      const missingCampaignAssets = matrixItems.filter((item) => item.status === 'Missing' || item.creativeStatus === 'Missing');
      const unresolvedCampaignRevisions = revisions.filter((item) => item.status !== 'Resolved');
      const overdueCampaignApprovals = approvals.filter((item) => item.status === 'Pending' && ((Date.now() - new Date(item.requestedAt).getTime()) / 86400000) > 2);
      const launchDelta = daysToLaunch(campaign.launchDate);

      if (missingCampaignAssets.length) {
        criticalBlockers.push(`${campaign.title}: ${missingCampaignAssets.length} missing asset area(s) across launch channels.`);
        recommendedAutomations.add('createMissingAssetTasks');
        simulationFeed.push({ tone: 'critical', label: 'Risk detected', detail: `${campaign.title} is missing required launch assets.` });
      }
      if (overdueCampaignApprovals.length) {
        criticalBlockers.push(`${campaign.title}: ${overdueCampaignApprovals.length} approval item(s) are overdue.`);
        recommendedAutomations.add('createApprovalReminder');
        simulationFeed.push({ tone: 'warning', label: 'Reminder generated', detail: `${campaign.title} needs approval follow-up before launch.` });
      }
      if (unresolvedCampaignRevisions.filter((item) => ['High', 'Critical'].includes(item.priority)).length) {
        criticalBlockers.push(`${campaign.title}: high-priority revisions are still unresolved.`);
        recommendedAutomations.add('createRevisionFollowUp');
        simulationFeed.push({ tone: 'warning', label: 'Revision pressure', detail: `${campaign.title} has unresolved high-priority revision pressure.` });
      }
      if (launchDelta !== null && launchDelta <= 1 && campaign.readinessScore < 85) {
        warnings.push(`${campaign.title} is scheduled within ${Math.max(1, launchDelta === 0 ? 18 : 24)} hours with weak readiness coverage.`);
        recommendedAutomations.add('markCampaignAtRisk');
      }
      if (delivery && (!delivery.clientAcceptance || Object.values(delivery.checklist).some((value) => !value))) {
        warnings.push(`${campaign.title} still has an incomplete delivery package or acceptance gap.`);
      }
      if (campaign.readinessScore >= 90 && matrixItems.length && matrixItems.every((item) => ['Approved', 'Ready', 'Delivered'].includes(item.status))) {
        simulationFeed.push({ tone: 'healthy', label: 'Campaign moved to ready', detail: `${campaign.title} is positioned for clean launch execution.` });
      }
    });

    const averageReadiness = Math.round(workspace.campaigns.reduce((sum, campaign) => sum + campaign.readinessScore, 0) / Math.max(1, workspace.campaigns.length));
    const riskPenalty =
      (missingAssets.length * 6) +
      (overdueApprovals.length * 7) +
      (openRevisions.length * 3) +
      (launchesWithin24h.length * 12) +
      (overdueLaunches.length * 10) +
      (incompleteDeliveries.length * 5) +
      (workspace.campaigns.filter((campaign) => campaign.riskLevel === 'Critical').length * 10);
    const launchRiskScore = Math.max(0, Math.min(100, 100 - riskPenalty + averageReadiness));
    const projectedReadiness = Math.max(0, Math.min(100, averageReadiness - Math.round((missingAssets.length * 2) + (overdueApprovals.length * 3) + (openRevisions.length * 1.5))));
    const launchConfidence = Math.max(5, Math.min(98, projectedReadiness - overdueLaunches.length * 5 - launchesWithin24h.length * 6));
    const riskLabel = launchRiskScore >= 75 ? 'LOW' : launchRiskScore >= 55 ? 'MEDIUM' : launchRiskScore >= 35 ? 'HIGH' : 'CRITICAL';
    const readinessState = projectedReadiness >= 80 ? 'healthy' : projectedReadiness >= 60 ? 'warning' : 'critical';
    const confidenceStatus = launchConfidence >= 78 ? 'Safe' : launchConfidence >= 55 ? 'At Risk' : 'Critical';
    const possibleLaunchDelay =
      launchesWithin24h.length > 0 && (missingAssets.length > 0 || overdueApprovals.length > 0 || openRevisions.length > 0)
        ? Math.max(1, Math.min(4, Math.ceil((missingAssets.length + overdueApprovals.length + Math.max(1, openRevisions.length / 2)) / 6)))
        : overdueLaunches.length
          ? Math.max(1, overdueLaunches.length)
          : 0;
    const platformReadiness = Math.max(0, Math.min(100, Math.round(((workspace.matrixItems.length - incompletePlatforms.length) / Math.max(1, workspace.matrixItems.length)) * 100)));

    if (launchesWithin24h.length) warnings.unshift(`${launchesWithin24h.length} campaign(s) are launching within 24 hours.`);
    if (overdueLaunches.length) warnings.unshift(`${overdueLaunches.length} campaign(s) are now overdue against planned launch timing.`);
    if (!criticalBlockers.length) {
      criticalBlockers.push('No critical blockers detected. Launch operations are stable under current rules.');
    }
    if (!simulationFeed.length) {
      simulationFeed.push({ tone: 'healthy', label: 'Stable operation', detail: 'No immediate automation pressure was detected during the simulation run.' });
    }

    const timelineSteps = [
      {
        tone: criticalBlockers[0]?.includes('No critical blockers') ? 'healthy' : 'critical',
        label: 'Blockers detected',
        detail: criticalBlockers[0]?.includes('No critical blockers') ? 'No critical blockers were detected during the simulation scan.' : `${criticalBlockers.length} critical blocker group(s) need operational action.`
      },
      {
        tone: overdueApprovals.length ? 'warning' : 'healthy',
        label: 'Approvals needed',
        detail: overdueApprovals.length ? `${overdueApprovals.length} overdue approval item(s) are holding launch confidence down.` : 'Approval queue is within a safe response window.'
      },
      {
        tone: openRevisions.length ? 'warning' : 'healthy',
        label: 'Revisions remaining',
        detail: openRevisions.length ? `${openRevisions.length} unresolved revision item(s) remain in the production loop.` : 'No unresolved revision pressure is left in the workspace.'
      },
      {
        tone: confidenceStatus === 'Safe' ? 'healthy' : confidenceStatus === 'At Risk' ? 'warning' : 'critical',
        label: 'Launch safe point',
        detail: confidenceStatus === 'Safe' ? 'Current conditions support a controlled launch sequence.' : possibleLaunchDelay ? `Resolve blockers to avoid an estimated ${possibleLaunchDelay} day launch delay.` : 'Resolve blockers and approvals before launch timing pressure escalates.'
      }
    ];

    return {
      createdAt: new Date().toISOString(),
      riskLabel,
      launchRiskScore,
      projectedReadiness,
      launchConfidence,
      confidenceStatus,
      readinessState,
      possibleLaunchDelay,
      platformReadiness,
      blockerCount: criticalBlockers.length,
      metrics: {
        overdueApprovals: overdueApprovals.length,
        missingAssets: missingAssets.length,
        unresolvedRevisions: openRevisions.length,
        launchRisks: workspace.campaigns.filter((campaign) => ['High', 'Critical'].includes(campaign.riskLevel)).length,
        incompletePlatforms: incompletePlatforms.length,
        incompleteDeliveries: incompleteDeliveries.length
      },
      countdownPressure: {
        within24h: launchesWithin24h.length,
        within3d: workspace.campaigns.filter((campaign) => campaign.launchDate && daysToLaunch(campaign.launchDate) !== null && daysToLaunch(campaign.launchDate) <= 3 && daysToLaunch(campaign.launchDate) >= 0).length,
        overdueLaunches: overdueLaunches.length
      },
      criticalBlockers: criticalBlockers.slice(0, 6),
      recommendedAutomations: Array.from(recommendedAutomations),
      operationalWarnings: warnings.slice(0, 6),
      simulationFeed: simulationFeed.slice(0, 6),
      timelineSteps
    };
  }

  return { scan, simulate, daysToLaunch };
})();
