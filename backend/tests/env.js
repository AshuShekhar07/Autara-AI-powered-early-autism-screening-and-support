// Runs before any test module is loaded: dummy env so nothing reads real secrets.
process.env.NODE_ENV = 'test'
process.env.AI_SERVICE_KEY = 'test-internal-key'
process.env.ALLOWED_ORIGINS = 'http://localhost:3000'
