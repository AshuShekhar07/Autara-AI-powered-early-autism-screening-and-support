// Replace Firebase Admin token verification. Test tokens look like "uid|email".
// Special uids for edge cases: "expired" (always rejected), "revoked" / "disabled" (rejected only when the
// server asks for the revocation check, i.e. verifyIdToken(token, true)). Calls are recorded in global.__verifyCalls.
global.__verifyCalls = []
jest.mock('../lib/firebaseAdmin', () => ({
  auth: () => ({
    verifyIdToken: async (token, checkRevoked) => {
      global.__verifyCalls.push({ token, checkRevoked: !!checkRevoked })
      const [uid, email] = String(token).split('|')
      const fail = (code) => { throw Object.assign(new Error(code), { code }) }
      if (!uid || uid === 'invalid') fail('auth/invalid-id-token')
      if (uid === 'expired') fail('auth/id-token-expired')
      if (checkRevoked && uid === 'revoked') fail('auth/id-token-revoked')
      if (checkRevoked && uid === 'disabled') fail('auth/user-disabled')
      return { uid, email }
    },
  }),
}))
