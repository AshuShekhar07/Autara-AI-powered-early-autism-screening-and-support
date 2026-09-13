const mongoose = require('mongoose')

const ROLES = ['caregiver', 'patient', 'therapist', 'clinician', 'admin']

/**
 * Determines the default `verified` value based on role.
 * Clinical roles (therapist, clinician) require manual verification.
 * Care roles (caregiver, patient) and admin are immediately verified.
 */
function defaultVerified() {
  // `this` refers to the document being created
  return !['therapist', 'clinician'].includes(this.role)
}

const userSchema = new mongoose.Schema(
  {
    /** Firebase UID — the canonical user identifier across both services */
    uid: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    name: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 120,
    },

    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    role: {
      type:     String,
      enum:     ROLES,
      required: true,
    },

    /**
     * Role-specific extra data stored as a flexible Mixed field.
     * Caregiver / Patient: { childName, childDob }
     * Therapist / Clinician: { orgName, licenseNumber }
     */
    roleDetails: {
      type:    mongoose.Schema.Types.Mixed,
      default: {},
    },

    /**
     * Whether the account is active and verified.
     * - caregiver, patient, admin → true by default (immediate access)
     * - therapist, clinician → false by default (requires manual review)
     */
    verified: {
      type:    Boolean,
      default: defaultVerified,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
)

module.exports = mongoose.model('User', userSchema)
