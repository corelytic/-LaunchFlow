window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Automations = (() => {
  const timelinePush = (workspace, campaignId, type, severity, message) => {
    workspace.timeline.unshift({
      id: window.LaunchFlow.State.nextId('tl'),
      campaignId,
      type,
      severity,
      message,
      createdAt: new Date().toISOString()
    });
  };

  const logAction = (workspace, campaignId, command, note) => {
    workspace.actionLog.unshift({ id: window.LaunchFlow.State.nextId('act'), campaignId, command, note, createdAt: new Date().toISOString() });
  };

  function getCampaign(workspace, campaignId) {
    return workspace.campaigns.find((campaign) => campaign.id === campaignId);
  }

  function createMissingAssetTasks(workspace, campaignId) {
    const items = workspace.matrixItems.filter((item) => item.campaignId === campaignId && (item.status === 'Missing' || item.creativeStatus === 'Missing'));
    if (!items.length) return { ok: false, message: 'No missing assets detected.' };
    const campaign = getCampaign(workspace, campaignId);
    timelinePush(workspace, campaignId, 'Automation applied', 'warning', `Missing asset recovery tasks created for ${items.length} channel(s).`);
    logAction(workspace, campaignId, 'createMissingAssetTasks', `Created recovery tasks for ${campaign.title}`);
    return { ok: true, message: `Created recovery tasks for ${items.length} missing asset area(s).` };
  }

  function markCampaignAtRisk(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    if (!campaign) return { ok: false, message: 'Campaign not found.' };
    campaign.riskLevel = 'Critical';
    campaign.readinessScore = Math.max(0, campaign.readinessScore - 8);
    timelinePush(workspace, campaignId, 'Automation applied', 'high', `${campaign.title} was marked at risk.`);
    logAction(workspace, campaignId, 'markCampaignAtRisk', 'Campaign risk escalated');
    return { ok: true, message: 'Campaign marked at risk.' };
  }

  function moveCampaignToClientReview(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    if (!campaign) return { ok: false, message: 'Campaign not found.' };
    campaign.status = 'Client Review';
    campaign.daysInStatus = 0;
    timelinePush(workspace, campaignId, 'Status changed', 'info', `${campaign.title} moved to Client Review.`);
    logAction(workspace, campaignId, 'moveCampaignToClientReview', 'Status advanced');
    return { ok: true, message: 'Campaign moved to Client Review.' };
  }

  function moveCampaignToReadyIfComplete(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    const allReady = workspace.matrixItems.filter((item) => item.campaignId === campaignId).every((item) => ['Approved', 'Ready', 'Delivered'].includes(item.status));
    if (!allReady) return { ok: false, message: 'Not all launch channels are ready yet.' };
    campaign.status = 'Ready To Launch';
    campaign.readinessScore = Math.max(90, campaign.readinessScore);
    campaign.riskLevel = 'Low';
    timelinePush(workspace, campaignId, 'Status changed', 'info', `${campaign.title} moved to Ready To Launch.`);
    logAction(workspace, campaignId, 'moveCampaignToReadyIfComplete', 'Ready state confirmed');
    return { ok: true, message: 'Campaign moved to Ready To Launch.' };
  }

  function createApprovalReminder(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    timelinePush(workspace, campaignId, 'Automation applied', 'warning', `Approval reminder generated for ${campaign.title}.`);
    logAction(workspace, campaignId, 'createApprovalReminder', 'Approval reminder logged');
    return { ok: true, message: 'Approval reminder added to timeline.' };
  }

  function createRevisionFollowUp(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    timelinePush(workspace, campaignId, 'Automation applied', 'high', `Revision follow-up created for ${campaign.title}.`);
    logAction(workspace, campaignId, 'createRevisionFollowUp', 'Revision follow-up recorded');
    return { ok: true, message: 'Revision follow-up created.' };
  }

  function lockApprovedAssets(workspace, campaignId) {
    workspace.matrixItems.filter((item) => item.campaignId === campaignId && ['Approved', 'Ready', 'Delivered'].includes(item.status)).forEach((item) => { item.locked = true; });
    timelinePush(workspace, campaignId, 'Automation applied', 'info', 'Approved assets locked against accidental edits.');
    logAction(workspace, campaignId, 'lockApprovedAssets', 'Approved assets locked');
    return { ok: true, message: 'Approved assets locked.' };
  }

  function archiveDeliveredCampaign(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    if (campaign.status !== 'Delivered') return { ok: false, message: 'Only delivered campaigns can be archived.' };
    campaign.archived = true;
    campaign.status = 'Archived';
    timelinePush(workspace, campaignId, 'Automation applied', 'info', `${campaign.title} archived after delivery.`);
    logAction(workspace, campaignId, 'archiveDeliveredCampaign', 'Campaign archived');
    return { ok: true, message: 'Campaign archived.' };
  }

  function addTimelineEvent(workspace, campaignId) {
    timelinePush(workspace, campaignId, 'Automation applied', 'info', 'Operational note logged by automation engine.');
    logAction(workspace, campaignId, 'addTimelineEvent', 'Timeline note added');
    return { ok: true, message: 'Timeline event added.' };
  }

  function generateClientFollowUpMessage(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    const pendingApprovals = workspace.approvals.filter((approval) => approval.campaignId === campaignId && approval.status === 'Pending').length;
    const text = `Hello team, ${campaign.title} still has ${pendingApprovals} pending approval item(s). Please review the open assets so the launch plan can stay on track.`;
    timelinePush(workspace, campaignId, 'Automation applied', 'warning', 'Client follow-up message generated.');
    logAction(workspace, campaignId, 'generateClientFollowUpMessage', text);
    return { ok: true, message: text };
  }

  function exportLaunchSummary(workspace, campaignId) {
    const campaign = getCampaign(workspace, campaignId);
    const summary = {
      campaign: campaign.title,
      status: campaign.status,
      readiness: campaign.readinessScore,
      risk: campaign.riskLevel,
      pendingApprovals: workspace.approvals.filter((approval) => approval.campaignId === campaignId && approval.status === 'Pending').length,
      openRevisions: workspace.revisions.filter((revision) => revision.campaignId === campaignId && revision.status !== 'Resolved').length
    };
    timelinePush(workspace, campaignId, 'Automation applied', 'info', 'Launch summary exported to local report frame.');
    logAction(workspace, campaignId, 'exportLaunchSummary', JSON.stringify(summary));
    return { ok: true, message: JSON.stringify(summary, null, 2) };
  }

  function applyRecipes(workspace) {
    const recipes = workspace.settings.recipes;
    workspace.approvals.filter((approval) => approval.status === 'Pending').forEach((approval) => {
      const age = (Date.now() - new Date(approval.requestedAt).getTime()) / 86400000;
      if (recipes.overdueApprovalRisk && age > 2) markCampaignAtRisk(workspace, approval.campaignId);
    });
    workspace.campaigns.forEach((campaign) => {
      if (recipes.allAssetsReady) moveCampaignToReadyIfComplete(workspace, campaign.id);
      if (recipes.deliveredArchive && campaign.status === 'Delivered') addTimelineEvent(workspace, campaign.id);
    });
    workspace.revisions.filter((revision) => ['High', 'Critical'].includes(revision.priority) && revision.status !== 'Resolved').forEach((revision) => {
      if (recipes.highPriorityRevision) {
        const campaign = getCampaign(workspace, revision.campaignId);
        campaign.readinessScore = Math.max(0, campaign.readinessScore - 3);
      }
    });
    workspace.campaigns.forEach((campaign) => {
      if (recipes.missingAssetsNearLaunch) {
        const days = campaign.launchDate ? Math.round((new Date(campaign.launchDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000) : 999;
        if (days <= 1) createMissingAssetTasks(workspace, campaign.id);
      }
    });
  }

  return {
    commands: {
      markCampaignAtRisk,
      createMissingAssetTasks,
      moveCampaignToClientReview,
      moveCampaignToReadyIfComplete,
      createApprovalReminder,
      createRevisionFollowUp,
      lockApprovedAssets,
      archiveDeliveredCampaign,
      addTimelineEvent,
      generateClientFollowUpMessage,
      exportLaunchSummary
    },
    applyRecipes
  };
})();
