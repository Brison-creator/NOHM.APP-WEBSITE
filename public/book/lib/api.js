// Every NOHM endpoint the website uses, by name. Paths and bodies
// match the server's controllers (the-nohm-application-1.1/backend);
// nothing here decides anything, it only carries requests. Public
// routes pass auth:false so a stale token can't 401 them.

export function createApi(http, session) {
  const dev = () => session.deviceFields();

  return {
    // ── Catalog (public) ────────────────────────────────────────
    trades: () => http.get('/trades', { auth: false }),
    pricing: () => http.get('/config/pricing', { auth: false }),

    // ── Account ─────────────────────────────────────────────────
    auth: {
      checkExists: (email) => http.post('/auth/check-exists', { email }, { auth: false }),
      /** Email sign-up, step 1: texts a code to the phone. 409 when the email or phone is taken. */
      emailSignupSendOtp: (body) => http.post('/auth/email-signup/send-otp', body, { auth: false }),
      /** Step 2: the code plus the same fields again creates the account and signs in. */
      emailSignupVerify: (body, code) => http.post('/auth/email-signup/verify-otp', { ...body, code, ...dev() }, { auth: false }),
      loginEmailPassword: (email, password) => http.post('/auth/login/email-password', { email, password, ...dev() }, { auth: false }),
      loginVerifyDeviceOtp: (email, code) => http.post('/auth/login/verify-device-otp', { email, code, ...dev(), trustDevice: true }, { auth: false }),
      loginSendOtp: (phone) => http.post('/auth/login/send-otp', { phone }, { auth: false }),
      loginVerifyOtp: (phone, code) => http.post('/auth/login/verify-otp', { phone, code, ...dev() }, { auth: false }),
      googleSignin: (idToken) => http.post('/auth/google/signin', { idToken, role: 'HOMEOWNER', ...dev() }, { auth: false }),
      socialSignupSendOtp: (phone) => http.post('/auth/social-signup/send-otp', { phone }, { auth: false }),
      googleSignupWithPhone: (idToken, phone, code) => http.post('/auth/google/signup-with-phone', { idToken, phone, code, role: 'HOMEOWNER', ...dev() }, { auth: false }),
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
      confirmSingle: (id) => http.post(`/properties/${encodeURIComponent(id)}/confirm`, { structureType: 'SINGLE' }),
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
  };
}
