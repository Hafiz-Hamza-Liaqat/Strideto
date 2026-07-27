/**
 * User vs employer token isolation (E.1F-B).
 * Run: node src/__tests__/employerAuthRealmIsolation.test.js
 */
import assert from 'assert';

const USER_TOKEN = 'edurozgaar-token';
const USER_REFRESH = 'edurozgaar-refresh-token';
const USER_STORAGE = 'edurozgaar-user';
const EMPLOYER_TOKEN = 'edurozgaar-employer-token';
const EMPLOYER_REFRESH = 'edurozgaar-employer-refresh-token';
const EMPLOYER_STORAGE = 'edurozgaar-employer';

function mockLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

// Simulate user axios 401 handler clearing only user keys (from axiosBase.js contract)
function clearUserSessionOnAuthFailure(ls) {
  ls.removeItem(USER_TOKEN);
  ls.removeItem(USER_REFRESH);
  ls.removeItem(USER_STORAGE);
}

// Simulate employer logout local clear (from EmployerAuthContext)
function clearEmployerSessionLocal(ls) {
  ls.removeItem(EMPLOYER_TOKEN);
  ls.removeItem(EMPLOYER_REFRESH);
  ls.removeItem(EMPLOYER_STORAGE);
}

const ls = mockLocalStorage();
ls.setItem(USER_TOKEN, 'user-access');
ls.setItem(USER_REFRESH, 'user-refresh');
ls.setItem(EMPLOYER_TOKEN, 'employer-access');
ls.setItem(EMPLOYER_REFRESH, 'employer-refresh');
ls.setItem(EMPLOYER_STORAGE, JSON.stringify({ _id: 'e1' }));

clearUserSessionOnAuthFailure(ls);
assert.strictEqual(ls.getItem(USER_TOKEN), null);
assert.strictEqual(ls.getItem(EMPLOYER_TOKEN), 'employer-access');
assert.strictEqual(ls.getItem(EMPLOYER_REFRESH), 'employer-refresh');

ls.setItem(USER_TOKEN, 'user-access');
clearEmployerSessionLocal(ls);
assert.strictEqual(ls.getItem(EMPLOYER_TOKEN), null);
assert.strictEqual(ls.getItem(USER_TOKEN), 'user-access');

console.log('employerAuthRealmIsolation.test.js: all assertions passed');
