window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.QAGuard = (() => {
  function validate(workspace, actions) {
    const issues = [];
    const routeNames = Object.keys(window.LaunchFlow.State.routeLabels);
    routeNames.forEach((route) => {
      if (typeof route !== 'string') issues.push('Invalid route definition found.');
    });
    ['app-view', 'modal-root', 'toast-root', 'global-alert-strip'].forEach((id) => {
      if (!document.getElementById(id)) issues.push(`Missing required DOM container: ${id}`);
    });
    const actionButtons = Array.from(document.querySelectorAll('[data-action]'));
    actionButtons.forEach((button) => {
      const action = button.dataset.action;
      if (!actions[action] && !['close-modal'].includes(action)) issues.push(`Unhandled action found: ${action}`);
    });
    const ids = Array.from(document.querySelectorAll('[id]')).map((node) => node.id);
    ids.forEach((id, index) => {
      if (ids.indexOf(id) !== index) issues.push(`Duplicate DOM id found: ${id}`);
    });
    if (!window.LaunchFlow.Storage.saveWorkspace(workspace)) issues.push('State save failed.');
    if (!window.LaunchFlow.LaunchBrain.scan(workspace)) issues.push('LaunchBrain scan failed.');
    return issues;
  }
  return { validate };
})();
