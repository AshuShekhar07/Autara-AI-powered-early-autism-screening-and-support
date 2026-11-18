/**
 * Who may be an Autara admin.
 *
 * ADMIN_EMAILS in backend/.env is a comma-separated list, e.g.
 *     ADMIN_EMAILS=first.admin@example.com,second.admin@example.com
 * Only these addresses can open the admin panel (/admin/login on the website). The list is read on every
 * call so a change to .env takes effect after a restart, and nothing is hard-coded in the repository.
 * Empty / unset → nobody is an admin.
 */
function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function isAllowedAdmin(email) {
  const e = String(email || '').trim().toLowerCase()
  return e !== '' && adminEmails().includes(e)
}

module.exports = { adminEmails, isAllowedAdmin }
