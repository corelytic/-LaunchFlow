window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.SeedData = (() => {
  const { nextId } = window.LaunchFlow.State;
  const today = new Date();
  const plusDays = (days) => {
    const date = new Date(today);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  function seed() {
    const clients = ['Northshore Labs', 'Velora Studio', 'Kite & Pine', 'Orbital Fitness', 'Marrow Coffee', 'Auraline Skin', 'PeakLedger', 'Piper Commerce'].map((name, index) => ({
      id: nextId('client'),
      name,
      contact: `${name.split(' ')[0].toLowerCase()}@example.com`,
      slaDays: [2, 3, 4, 2, 5, 3, 4, 2][index]
    }));

    const campaigns = [
      { title: 'Summer Recovery Stack', client: clients[0].id, owner: 'Maya', launchDate: plusDays(1), platforms: ['Instagram Feed', 'Meta Ads', 'Landing Page'], status: 'Client Review', readinessScore: 62, riskLevel: 'High', notes: 'Awaiting legal approval on paid messaging.', daysInStatus: 4 },
      { title: 'Creator Drop Wave 4', client: clients[1].id, owner: 'Jon', launchDate: plusDays(4), platforms: ['Instagram Story', 'TikTok', 'YouTube Shorts'], status: 'Revision Required', readinessScore: 58, riskLevel: 'Critical', notes: 'Video cut needs talent sign-off.', daysInStatus: 5 },
      { title: 'Q3 Retention Push', client: clients[2].id, owner: 'Iris', launchDate: plusDays(7), platforms: ['Email Campaign', 'Landing Page', 'LinkedIn'], status: 'Internal Review', readinessScore: 76, riskLevel: 'Medium', notes: 'Subject line variants still in test review.', daysInStatus: 2 },
      { title: 'Fit Reset Countdown', client: clients[3].id, owner: '', launchDate: plusDays(0), platforms: ['TikTok', 'Meta Ads', 'Landing Page'], status: 'In Production', readinessScore: 49, riskLevel: 'Critical', notes: 'Launch blockers tied to missing landing page hero.', daysInStatus: 6 },
      { title: 'Holiday Espresso Club', client: clients[4].id, owner: 'Rhea', launchDate: plusDays(2), platforms: ['Instagram Feed', 'Email Campaign'], status: 'Ready To Launch', readinessScore: 92, riskLevel: 'Low', notes: 'Awaiting final publish window confirmation.', daysInStatus: 1 },
      { title: 'Radiance Serum Relaunch', client: clients[5].id, owner: 'Noah', launchDate: plusDays(-1), platforms: ['Meta Ads', 'Instagram Story', 'Landing Page'], status: 'Delivered', readinessScore: 100, riskLevel: 'Low', notes: 'Delivery complete, archive recommended.', daysInStatus: 3 }
    ].map((campaign) => ({ ...campaign, id: nextId('camp'), archived: false }));

    const platformBlueprints = [
      'Instagram Feed', 'Instagram Story', 'TikTok', 'YouTube Shorts', 'Meta Ads', 'LinkedIn', 'Email Campaign', 'Landing Page'
    ];

    const matrixItems = [];
    campaigns.forEach((campaign, index) => {
      campaign.platforms.forEach((platform, pIndex) => {
        matrixItems.push({
          id: nextId('matrix'),
          campaignId: campaign.id,
          platform,
          requiredAssets: platform === 'Landing Page' ? 'Hero, CTA section, QA pass' : platform === 'Email Campaign' ? 'Header, body copy, footer' : 'Creative, caption, CTA',
          copyStatus: ['Needs Review', 'Draft', 'Approved'][((index + pIndex) % 3)],
          creativeStatus: ['Approved', 'Draft', 'Needs Review', 'Missing'][((index + pIndex) % 4)],
          approvalStatus: ['Pending', 'Approved', 'Revision Required'][((index + pIndex) % 3)],
          scheduledStatus: ['Not Scheduled', 'Scheduled'][((index + pIndex) % 2)],
          blockerStatus: ['None', 'Talent approval', 'Legal copy check', 'Missing asset'][((index + pIndex) % 4)],
          status: ['Draft', 'Needs Review', 'Approved', 'Missing', 'Ready'][((index + pIndex) % 5)],
          locked: false
        });
      });
    });

    while (matrixItems.length < 22) {
      const fallbackCampaign = campaigns[matrixItems.length % campaigns.length];
      matrixItems.push({
        id: nextId('matrix'),
        campaignId: fallbackCampaign.id,
        platform: platformBlueprints[matrixItems.length % platformBlueprints.length],
        requiredAssets: 'Creative, copy, CTA',
        copyStatus: 'Draft',
        creativeStatus: 'Draft',
        approvalStatus: 'Pending',
        scheduledStatus: 'Not Scheduled',
        blockerStatus: 'None',
        status: 'Draft',
        locked: false
      });
    }

    const revisions = [
      ['Creator Drop Wave 4', 'TikTok', 'Replace end card with updated CTA', 'High', 'Open', 'Jon', -2, null, 3],
      ['Creator Drop Wave 4', 'YouTube Shorts', 'Trim first 3 seconds for pace', 'Medium', 'Resolved', 'Mina', -3, -1, 2],
      ['Summer Recovery Stack', 'Meta Ads', 'Headline lacks legal approved phrasing', 'Critical', 'Open', 'Maya', -1, null, 4],
      ['Q3 Retention Push', 'Email Campaign', 'Need alternate subject line variant', 'Medium', 'Open', 'Iris', -2, null, 1],
      ['Fit Reset Countdown', 'Landing Page', 'Hero image not exported at required width', 'Critical', 'Open', 'Luca', -4, null, 5],
      ['Fit Reset Countdown', 'Meta Ads', 'Retargeting copy exceeds policy limit', 'High', 'Open', 'Luca', -3, null, 2],
      ['Radiance Serum Relaunch', 'Landing Page', 'Final QA typo in trust badge', 'Low', 'Resolved', 'Noah', -6, -5, 1],
      ['Holiday Espresso Club', 'Instagram Feed', 'Swap lifestyle image with approved pack shot', 'Medium', 'Reopened', 'Rhea', -1, null, 2],
      ['Summer Recovery Stack', 'Landing Page', 'Add shipping disclaimer above fold', 'High', 'Open', 'Maya', -2, null, 2],
      ['Q3 Retention Push', 'LinkedIn', 'Refine stat framing for B2B tone', 'Low', 'Resolved', 'Iris', -5, -4, 1],
      ['Creator Drop Wave 4', 'Instagram Story', 'Audio ducking requested by client', 'High', 'Open', 'Jon', -2, null, 4],
      ['Fit Reset Countdown', 'TikTok', 'Caption still using old promo date', 'Critical', 'Open', 'Luca', -1, null, 3],
      ['Holiday Espresso Club', 'Email Campaign', 'Need alternate CTA button color', 'Low', 'Resolved', 'Rhea', -3, -2, 1],
      ['Summer Recovery Stack', 'Instagram Feed', 'Carousel slide 2 product crop too tight', 'Medium', 'Resolved', 'Maya', -4, -2, 2],
      ['Radiance Serum Relaunch', 'Meta Ads', 'Client wanted stronger benefit lead', 'Medium', 'Resolved', 'Noah', -7, -5, 2],
      ['Q3 Retention Push', 'Landing Page', 'Remove old pricing reference in FAQ', 'High', 'Open', 'Iris', -1, null, 2]
    ].map((item) => {
      const campaign = campaigns.find((entry) => entry.title === item[0]);
      const created = new Date(today); created.setDate(created.getDate() + item[6]);
      const resolved = item[7] === null ? null : (() => { const d = new Date(today); d.setDate(d.getDate() + item[7]); return d.toISOString(); })();
      return {
        id: nextId('rev'),
        campaignId: campaign.id,
        assetPlatform: item[1],
        comment: item[2],
        priority: item[3],
        status: item[4],
        owner: item[5],
        createdDate: created.toISOString(),
        resolvedDate: resolved,
        roundCount: item[8],
        approvalImpact: ['Low', 'Medium', 'High'][item[8] % 3]
      };
    });

    const approvals = [
      ['Summer Recovery Stack', 'Meta Ads bundle', 'Pending', -3, null, 'Need legal phrase check'],
      ['Summer Recovery Stack', 'Landing page final copy', 'Pending', -2, null, 'Awaiting compliance review'],
      ['Creator Drop Wave 4', 'TikTok creator cut', 'Revision Requested', -4, null, 'First frame needs stronger branding'],
      ['Creator Drop Wave 4', 'IG story pack', 'Pending', -2, null, 'Client asked for alternate CTA treatment'],
      ['Q3 Retention Push', 'Email proof', 'Approved', -3, -2, 'Approved with minor punctuation note'],
      ['Q3 Retention Push', 'Landing page proof', 'Pending', -1, null, 'Stakeholder review overdue'],
      ['Fit Reset Countdown', 'Landing page wireframe', 'Pending', -5, null, 'No response from client yet'],
      ['Holiday Espresso Club', 'Instagram feed final', 'Approved', -2, -1, 'Approved'],
      ['Holiday Espresso Club', 'Email final', 'Approved', -2, -1, 'Approved with no changes'],
      ['Radiance Serum Relaunch', 'Final handoff pack', 'Approved', -6, -5, 'Approved for delivery'],
      ['Fit Reset Countdown', 'Meta ad copy set', 'Pending', -3, null, 'Approval request still open']
    ].map((item) => {
      const campaign = campaigns.find((entry) => entry.title === item[0]);
      const requested = new Date(today); requested.setDate(requested.getDate() + item[3]);
      const decided = item[4] === null ? null : (() => { const d = new Date(today); d.setDate(d.getDate() + item[4]); return d.toISOString(); })();
      return {
        id: nextId('approval'),
        campaignId: campaign.id,
        assetName: item[1],
        status: item[2],
        notes: item[5],
        requestedAt: requested.toISOString(),
        decidedAt: decided,
        finalApproval: item[2] === 'Approved' && item[1].toLowerCase().includes('final')
      };
    });

    const deliveries = campaigns.filter((campaign) => ['Ready To Launch', 'Delivered', 'Live'].includes(campaign.status)).map((campaign, index) => ({
      id: nextId('delivery'),
      campaignId: campaign.id,
      deliveredAssets: campaign.platforms.join(', '),
      finalApprovalStatus: approvals.some((approval) => approval.campaignId === campaign.id && approval.finalApproval) ? 'Approved' : 'Pending',
      checklist: {
        creatives: index !== 0,
        captions: true,
        adCopy: index !== 1,
        landingPage: !campaign.platforms.includes('Landing Page') || index > 0,
        reportPrepared: index > 0,
        clientAccepted: campaign.status === 'Delivered'
      },
      clientAcceptance: campaign.status === 'Delivered',
      deliveryNotes: campaign.status === 'Delivered' ? 'Delivery accepted by client and ready for archive.' : 'Final pack staged for handoff.',
      archived: false
    }));

    const timeline = [
      'Campaign created', 'Status changed', 'Approval requested', 'Revision created', 'Revision resolved', 'Asset updated', 'LaunchBrain alert generated', 'Automation applied', 'Delivery accepted', 'Workspace snapshot saved'
    ];
    const timelineEntries = [];
    for (let i = 0; i < 36; i += 1) {
      const campaign = campaigns[i % campaigns.length];
      const date = new Date(today);
      date.setHours(date.getHours() - i * 4);
      timelineEntries.push({
        id: nextId('tl'),
        campaignId: campaign.id,
        type: timeline[i % timeline.length],
        severity: ['info', 'warning', 'high', 'critical'][i % 4],
        message: `${timeline[i % timeline.length]} for ${campaign.title}`,
        createdAt: date.toISOString()
      });
    }

    return {
      ...window.LaunchFlow.State.getDefaults(),
      clients,
      campaigns,
      matrixItems,
      revisions,
      approvals,
      deliveries,
      timeline: timelineEntries
    };
  }

  return { seed };
})();

