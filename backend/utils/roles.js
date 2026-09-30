/** Central role constants so route files never hard-code role strings. */
const ROLES          = ['caregiver', 'patient', 'therapist', 'clinician', 'admin']
const CARE_ROLES     = ['caregiver', 'patient']     // manage a child's own profile
const CLINICAL_ROLES = ['therapist', 'clinician']   // need admin verification

const isCareRole     = (r) => CARE_ROLES.includes(r)
const isClinicalRole = (r) => CLINICAL_ROLES.includes(r)

module.exports = { ROLES, CARE_ROLES, CLINICAL_ROLES, isCareRole, isClinicalRole }
