// Every NOHM endpoint the website uses (/book and /join), by name. Paths and bodies
// match the server's controllers (the-nohm-application-1.1/backend);
// nothing here decides anything, it only carries requests. Public
// routes pass auth:false so a stale token can't 401 them.

/**
 * Which server the page talks to. `?api=` is honored on localhost only
 * (for tools/book/stub-server.mjs); on nohm.app a link can never point
 * the page, and people's sign-ins, at someone else's server.
 */
export function apiBaseFor(hostname, search, configured) {
  const local = /^(localhost|127\.0\.0\.1)$/.test(hostname || '');
  const override = local ? new URLSearchParams(search || '').get('api') : null;
  return override || configured;
}

export function createApi(http, session) {
  const dev = () => session.deviceFields();

  return {
    // ── Catalog (public) ────────────────────────────────────────
    trades: () => http.get('/trades', { auth: false }),
    pricing: () => http.get('/config/pricing', { auth: false }),
    /** { stripePublishableKey, googleClientId }: the server's public settings for the site. */
    webConfig: () => http.get('/config/web', { auth: false }),

    // ── Account ─────────────────────────────────────────────────
    auth: {
      checkExists: (email) => http.post('/auth/check-exists', { email }, { auth: false }),
      /** Email sign-up, step 1: texts a code to the phone. 409 when the email or phone is taken. */
      emailSignupSendOtp: (body) => http.post('/auth/email-signup/send-otp', body, { auth: false }),
      /** Step 2: the code plus the same fields again creates the account and signs in. */
      emailSignupVerify: (body, code) => http.post('/auth/email-signup/verify-otp', { ...body, code, ...dev() }, { auth: false }),
      loginEmailPassword: async (email, password) => {
        const deviceSecret = session.deviceSecret(email);
        const res = await http.post('/auth/login/email-password', { email, password, ...dev(), ...(deviceSecret ? { deviceSecret } : {}) }, { auth: false });
        session.saveDeviceSecret(email, res && res.deviceSecret);
        return res;
      },
      /** The server trusts this browser for the email once a code is entered here; keep what it gives. */
      loginVerifyDeviceOtp: async (email, code) => {
        const res = await http.post('/auth/login/verify-device-otp', { email, code, ...dev(), trustDevice: true }, { auth: false });
        session.saveDeviceSecret(email, res && res.deviceSecret);
        return res;
      },
      loginSendOtp: (phone) => http.post('/auth/login/send-otp', { phone }, { auth: false }),
      loginVerifyOtp: (phone, code) => http.post('/auth/login/verify-otp', { phone, code, ...dev() }, { auth: false }),
      googleSignin: (idToken, role = 'HOMEOWNER') => http.post('/auth/google/signin', { idToken, role, ...dev() }, { auth: false }),
      socialSignupSendOtp: (phone) => http.post('/auth/social-signup/send-otp', { phone }, { auth: false }),
      googleSignupWithPhone: (idToken, phone, code, role = 'HOMEOWNER') => http.post('/auth/google/signup-with-phone', { idToken, phone, code, role, ...dev() }, { auth: false }),
      me: () => http.get('/auth/me'),
      logout: () => http.post('/auth/logout'),
    },

    // ── The home ────────────────────────────────────────────────
    places: {
      autocomplete: (input) => http.get(`/places/autocomplete?input=${encodeURIComponent(input)}`),
      details: (placeId) => http.get(`/places/details?placeId=${encodeURIComponent(placeId)}`),
    },
    properties: {
      list: () => http.get('/properties'),
      checkType: (body) => http.post('/properties/check-type', body),
      shell: (body) => http.post('/properties/shell', body),
      /** structureType is the person's answer (SINGLE here; multi-unit homes are set up in the app). */
      confirm: (id, structureType) => http.post(`/properties/${encodeURIComponent(id)}/confirm`, { structureType }),
    },

    // ── Card on file ────────────────────────────────────────────
    stripe: {
      paymentMethod: () => http.get('/stripe/customer/payment-method'),
      setupIntent: () => http.post('/stripe/customer/setup-intent'),
      confirmCard: () => http.post('/stripe/customer/confirm-card'),
    },

    // ── Booking ─────────────────────────────────────────────────
    jobs: {
      cancellationTerms: (q) => http.get(`/jobs/cancellation-terms?${new URLSearchParams(q)}`),
      create: (body) => http.post('/jobs', body),
      get: (id) => http.get(`/jobs/${encodeURIComponent(id)}`),
      uploadPhotos: (id, files) => {
        const form = new FormData();
        for (const f of files) form.append('files', f, f.name);
        return http.postForm(`/jobs/${encodeURIComponent(id)}/photos`, form);
      },
      matchedContractors: (id) => http.get(`/jobs/${encodeURIComponent(id)}/matched-contractors`),
      selectContractor: (id, contractorId) => http.post(`/jobs/${encodeURIComponent(id)}/select-contractor`, { contractorId }),
    },
    now: {
      live: (tradeId, propertyId) => http.get(`/now/live?${new URLSearchParams({ tradeId, propertyId })}`),
      demand: (tradeId, propertyId) => http.post('/now/demand', { tradeId, propertyId }),
      dispatch: (body) => http.post('/now/dispatch', body),
      job: (id) => http.get(`/now/jobs/${encodeURIComponent(id)}`),
    },

    // ── Pros: onboarding (modules/contractors, modules/stripe) ───
    contractors: {
      dashboard: () => http.get('/contractors/dashboard'),
      profile: () => http.get('/contractors/profile'),
      /** PATCH, but firstName, lastName, businessName, baseZip and serviceRadius are always required. */
      updateProfile: (body) => http.patch('/contractors/profile', body),
      checklist: () => http.get('/contractors/checklist'),
      attestation: (attestedName) => http.post('/contractors/attestation', { attestedName }),
      submitReview: () => http.post('/contractors/submit-review'),
      documents: () => http.get('/contractors/documents'),
      uploadDocument: (docType, file) => {
        const form = new FormData();
        form.append('docType', docType);
        form.append('file', file, file.name);
        return http.postForm('/contractors/documents', form);
      },
      deleteDocument: (id) => http.delete(`/contractors/documents/${encodeURIComponent(id)}`),
    },
    stripeConnect: {
      create: () => http.post('/stripe/connect/create'),
      refresh: () => http.post('/stripe/connect/refresh'),
      status: () => http.get('/stripe/connect/status'),
    },
    contractorInvites: {
      checkPhone: () => http.get('/contractor-invites/check-phone'),
      byCode: (code) => http.get(`/contractor-invites/code/${encodeURIComponent(code)}`),
      accept: (inviteCode) => http.post('/contractor-invites/accept', { inviteCode }),
    },

    // ── Renters: the landlord's invite (modules/tenants) ─────────
    tenants: {
      myInvites: () => http.get('/tenants/my-invites'),
      invite: (code) => http.get(`/tenants/invite/${encodeURIComponent(code)}`),
      sendOtp: (code) => http.post(`/tenants/invite/${encodeURIComponent(code)}/send-otp`),
      accept: (code, otpCode) => http.post(`/tenants/invite/${encodeURIComponent(code)}/accept`, { otpCode }),
      myProperty: () => http.get('/tenants/my-property'),
    },
  };
}
