window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.Router = (() => {
  const validRoutes = Object.keys(window.LaunchFlow.State.routeLabels);
  return {
    getRoute() {
      const hash = window.location.hash.replace('#/', '').trim();
      return validRoutes.includes(hash) ? hash : 'dashboard';
    },
    setRoute(route) {
      window.location.hash = `/${route}`;
    },
    onChange(callback) {
      window.addEventListener('hashchange', () => callback(this.getRoute()));
    }
  };
})();
