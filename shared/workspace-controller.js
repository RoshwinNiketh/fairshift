// Controls session and organization ownership of asynchronous responses.
// RLS remains the authorization boundary; these guards prevent stale UI records.
export function createWorkspaceController({ loadMemberships, loadOrganization }) {
  let state = { mode: 'checking', session: null, access: [], active: null, data: null, error: '', busy: false };
  let generation = 0;
  let request = 0;
  const listeners = new Set();
  const publish = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const clear = (mode = 'demo') => {
    generation++; request++;
    publish({ mode, session: null, access: [], active: null, data: null, error: '', busy: false });
  };
  const refresh = async orgId => {
    if (!state.session || state.active?.orgId !== orgId) return null;
    const scope = generation;
    const sequence = ++request;
    const current = () => scope === generation && sequence === request && state.active?.orgId === orgId && Boolean(state.session);
    try {
      const data = await loadOrganization(orgId);
      if (!current()) return null;
      if (data.organization?.id !== orgId) throw new Error('Organization response mismatch.');
      publish({ data, error: '', busy: false });
      return data;
    } catch (error) {
      if (!current()) return null;
      publish({ error: error.message, busy: false });
      throw error;
    }
  };
  const selectOrg = async orgId => {
    const active = state.access.find(m => m.orgId === orgId && m.organization?.id === orgId);
    if (!state.session || !active) throw new Error('Organization access denied.');
    generation++; request++;
    publish({ active, data: null, error: '', busy: true });
    return refresh(orgId);
  };
  const start = async session => {
    if (!session) { clear(); return; }
    if (state.session?.user.id === session.user.id) {
      publish({ session });
      return;
    }
    const scope = ++generation;
    request++;
    publish({ mode: 'shared', session, access: [], active: null, data: null, error: '', busy: true });
    try {
      const access = await loadMemberships();
      if (scope !== generation) return;
      if (!access.length) throw new Error('Your account has no assigned organization. Contact the project owner.');
      publish({ access });
      await selectOrg(access[0].orgId);
    } catch (error) {
      if (state.session?.user.id === session.user.id && !state.active) publish({ error: error.message, busy: false });
    }
  };
  return {
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    getSnapshot: () => state,
    start, selectOrg, refresh, clear,
    showLogin: () => { if (!state.session) publish({ mode: 'login', error: '' }); },
    showDemo: () => { if (!state.session) clear(); },
    setError: message => publish({ error: message }),
    invalidate: () => { generation++; request++; }
  };
}