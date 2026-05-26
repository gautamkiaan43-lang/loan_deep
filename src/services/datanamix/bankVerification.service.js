const datanamixAxiosClient = require('./datanamixClient');

const ENDPOINT = '/v1/bank/account-verification-advanced';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Capitalise a single word: "JOHN" → "John"
const capitalize = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '');

// Initials from given names only (all words EXCEPT the surname / last word)
// "JOHN DOE SOAP" → firstName="John", surname="Soap", initials="JD"
const deriveGivenNameInitials = (nameParts) => {
  if (!nameParts || nameParts.length === 0) return '';
  if (nameParts.length === 1) return nameParts[0][0]?.toUpperCase() ?? '';
  return nameParts.slice(0, -1).map(p => p[0]?.toUpperCase() ?? '').filter(Boolean).join('');
};

// Datanamix returns Yes/No or Y/N; normalise to "Yes" / "No" / null
const parseYesNo = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (s.startsWith('y')) return 'Yes';
  if (s.startsWith('n')) return 'No';
  return String(val);
};

// ─── Response normalizer ──────────────────────────────────────────────────────

const normalizeResponse = (raw) => {
  console.log('[BANK-VERIFY] Raw AVS Advanced response:\n', JSON.stringify(raw, null, 2));

  const header  = raw.Header  ?? {};
  const avs     = raw.Avs     ?? raw.AVS ?? raw.avs ?? {};
  const success = raw.Success === true || raw.Success === 'true' || raw.Success === 'True';

  return {
    success,
    reportReference: raw.ReportReference ?? header.ReportReference ?? null,
    searchDate:      header.SearchDate   ?? null,
    responseCode:    raw.ResponseCode    ?? null,
    avs: {
      status:               avs.Status            ?? avs.status            ?? null,
      statusMessage:        avs.StatusMessage     ?? avs.statusMessage     ?? null,
      accountFound:         parseYesNo(avs.accountFound     ?? avs.AccountFound),
      accountOpen:          parseYesNo(avs.accountOpen      ?? avs.AccountOpen),
      acceptsCredits:       parseYesNo(avs.acceptsCredits   ?? avs.AcceptsCredits),
      identityMatch:        parseYesNo(avs.identityMatch    ?? avs.IdentityMatch),
      accountTypeMatch:     parseYesNo(avs.accountTypeMatch ?? avs.AccountTypeMatch),
      initialsMatch:        parseYesNo(avs.initialsMatch    ?? avs.InitialsMatch),
      nameMatch:            parseYesNo(avs.nameMatch        ?? avs.NameMatch),
      emailMatch:           parseYesNo(avs.emailMatch       ?? avs.EmailMatch),
      phoneMatch:           parseYesNo(avs.phoneMatch       ?? avs.PhoneMatch),
      bankReference:        avs.bankReference        ?? avs.BankReference        ?? null,
      bankStatusCode:       avs.bankStatusCode       ?? avs.BankStatusCode       ?? null,
      bankStatusMessage:    avs.bankStatusMessage    ?? avs.BankStatusMessage    ?? null,
      bankResponseTimestamp:avs.bankResponseTimestamp ?? avs.BankResponseTimestamp ?? null,
    },
    pdfReport:   raw.PDFReport ?? null,
    rawResponse: raw,
  };
};

// ─── Verification decision engine ─────────────────────────────────────────────
//
// Critical checks (any failure → Rejected):
//   accountFound === "Yes"
//   accountOpen  === "Yes"
//   identityMatch === "Yes"
//
// Soft checks (failure → VerifiedWithWarnings):
//   initialsMatch, nameMatch, emailMatch, phoneMatch, accountTypeMatch, acceptsCredits

const runVerificationDecision = (normalized) => {
  const { avs, success } = normalized;

  const criticalPass =
    avs.accountFound  === 'Yes' &&
    avs.accountOpen   === 'Yes' &&
    avs.identityMatch === 'Yes';

  if (criticalPass) {
    const softFail = [
      avs.initialsMatch, avs.nameMatch, avs.emailMatch,
      avs.phoneMatch, avs.accountTypeMatch, avs.acceptsCredits,
    ].some(v => v === 'No');

    return {
      verificationStatus: softFail ? 'VerifiedWithWarnings' : 'Verified',
      statusMessage: avs.statusMessage || (softFail
        ? 'Account ownership confirmed — minor data mismatches detected'
        : 'Account ownership confirmed'),
    };
  }

  // Determine specific rejection reason
  let statusMessage = avs.statusMessage || 'Bank verification failed.';
  if (!success && !avs.accountFound) {
    statusMessage = avs.statusMessage || 'Bank verification was unsuccessful.';
  } else if (avs.accountFound === 'No') {
    statusMessage = 'Bank account not found.';
  } else if (avs.accountOpen === 'No') {
    statusMessage = 'Bank account is not active/open.';
  } else if (avs.identityMatch === 'No') {
    statusMessage = 'Identity number does not match account records.';
  }

  return { verificationStatus: 'Rejected', statusMessage };
};

// ─── Main caller ──────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {string}  params.fullName         - Borrower full name from DB (FirstName + [Middle] + Surname)
 * @param {string}  params.bankName        - Bank name (informational)
 * @param {string}  params.accountNumber   - Bank account number
 * @param {string}  params.branchCode      - Branch/sort code
 * @param {string}  params.accountType     - "Current" | "Savings" | "Transmission"
 * @param {string}  params.phoneNumber     - Mobile number
 * @param {string}  params.emailAddress    - Email address
 * @param {string}  params.idNumber        - SA ID number
 * @param {string}  [params.clientReference]
 */
const callBankVerification = async ({
  fullName,
  bankName,
  accountNumber,
  branchCode,
  accountType,
  phoneNumber,
  emailAddress,
  idNumber,
  clientReference,
}) => {
  if (!accountNumber) throw new Error('accountNumber is required for bank verification');
  if (!idNumber)      throw new Error('idNumber is required for bank verification');

  const reference    = clientReference || `BANK-${Date.now()}`;
  const resolvedType = accountType || 'Current';
  const isSandbox    = process.env.NODE_ENV !== 'production';

  // ── Sandbox identity override ──────────────────────────────────────────────
  // When the official Datanamix sandbox test ID is used, substitute the exact
  // identity combination from the Datanamix AVS documentation instead of
  // attempting to parse the DB borrower name (which would not match sandbox records).
  const SANDBOX_TEST_ID = '0000000000001';
  const useSandboxOverride = isSandbox && idNumber === SANDBOX_TEST_ID;

  let firstName, surname, initials;

  if (useSandboxOverride) {
    console.log('[SANDBOX AVS OVERRIDE ACTIVE] Using official Datanamix sandbox identity — skipping DB name parsing.');
    firstName = 'John';
    surname   = 'Doe';
    initials  = 'JD';
  } else {
    const rawParts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    firstName      = capitalize(rawParts[0] ?? '');
    surname        = rawParts.length > 1 ? capitalize(rawParts[rawParts.length - 1]) : firstName;
    initials       = deriveGivenNameInitials(rawParts);
  }

  const payload = {
    EnvironmentType:       isSandbox ? (process.env.DATANAMIX_ENVIRONMENT || 'SANDBOX') : 'LIVE',
    OutputFormat:          'JSON_AND_PDF',
    PDFEncryptionPassword: idNumber,
    ClientReference:       reference,
    Initials:              initials,
    FirstName:             firstName,
    Surname:               surname,
    IdentityType:          'IDNumber',
    IdentityNumber:        idNumber,
    BankAccountNumber:     accountNumber,
    BankBranchCode:        branchCode || '',
    BankAccountType:       resolvedType,
    MobileNumber:          phoneNumber || '',
    EmailAddress:          emailAddress || '',
  };

  console.log('[BANK-VERIFY] FINAL AVS PAYLOAD', JSON.stringify(payload, null, 2));
  console.log(`[BANK-VERIFY] Calling AVS Advanced — Account: ${accountNumber} | Ref: ${reference}`);

  const response   = await datanamixAxiosClient.post(ENDPOINT, payload);
  const normalized = normalizeResponse(response.data);
  const decision   = runVerificationDecision(normalized);

  console.log(`[BANK-VERIFY] Status: ${decision.verificationStatus}`);

  return {
    ...normalized,
    ...decision,
    verifiedBankAccount: accountNumber,
    verifiedBranchCode:  branchCode  || '',
    verifiedAccountType: resolvedType,
  };
};

module.exports = { callBankVerification };
