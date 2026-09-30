// Replace Firebase Admin token verification. Test tokens look like "uid|email".
jest.mock('../lib/firebaseAdmin', () => ({
  auth: () => ({
    verifyIdToken: async (token) => {
      const [uid, email] = String(token).split('|')
      if (!uid || uid === 'invalid') throw Object.assign(new Error('bad token'), { code: 'auth/invalid-id-token' })
      return { uid, email }
    },
  }),
}))
