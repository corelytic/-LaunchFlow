window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.State = (() => {
  const routeLabels = {
    dashboard: 'Dashboard',
    campaigns: 'Campaigns',
    matrix: 'Launch Matrix',
    revisions: 'Revisions',
    approvals: 'Client Approval Room',
    launchbrain: 'LaunchBrain',
    delivery: 'Delivery Center',
    timeline: 'Timeline',
    reports: 'Reports',
    settings: 'Settings / Backup'
  };

  const statuses = ['Planning', 'In Production', 'Internal Review', 'Client Review', 'Revision Required', 'Ready To Launch', 'Live', 'Delivered', 'Archived'];
  const platformStatuses = ['Missing', 'Draft', 'Needs Review', 'Approved', 'Scheduled', 'Ready', 'Delivered'];

  return {
    storageKey: 'corelytic-launchflow-v1',
    snapshotKey: 'corelytic-launchflow-snapshots',
    routeLabels,
    statuses,
    platformStatuses,
    nextId(prefix) {
      return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
    },
    today() {
      return new Date().toISOString();
    },
    getDefaults() {
      return {
        settings: {
          theme: 'light',
          density: 'comfortable',
          soundsEnabled: false,
          recipes: {
            overdueApprovalRisk: true,
            allAssetsReady: true,
            highPriorityRevision: true,
            deliveredArchive: true,
            missingAssetsNearLaunch: true
          }
        },
        ui: {
          route: 'dashboard',
          search: '',
          reportFocus: 'readiness',
          filters: {
            campaignStatus: 'All',
            matrixCampaignId: 'all',
            revisionStatus: 'all',
            timelineType: 'all',
            timelineCampaignId: 'all'
          }
        },
        clients: [],
        campaigns: [],
        matrixItems: [],
        revisions: [],
        approvals: [],
        deliveries: [],
        timeline: [],
        alerts: [],
        dismissedAlerts: [],
        actionLog: []
      };
    }
  };
})();
