export const CARE_ROLES     = ['caregiver', 'patient']
export const CLINICAL_ROLES = ['therapist', 'clinician']

export const isCareRole     = (r) => CARE_ROLES.includes(r)
export const isClinicalRole = (r) => CLINICAL_ROLES.includes(r)

/**
 * Where a signed-in user lands. Single source of truth for login redirect,
 * the "/" route and the auth page's already-signed-in redirect.
 */
export function homeRouteFor(role, verified) {
  if (isClinicalRole(role) && !verified) return '/pending-verification'
  switch (role) {
    case 'admin':     return '/admin'
    case 'clinician': return '/clinician'
    case 'therapist': return '/therapist'
    default:          return '/dashboard' // caregiver, patient
  }
}
