const datanamixAxiosClient = require('./datanamixClient');

const ENDPOINT = '/v1/face/profile-plus-id-photo-match-verification';

/**
 * Converts a Buffer (from multer memory storage) to a plain base64 string
 * with no data-URI prefix — Datanamix expects raw base64 only.
 */
const bufferToBase64 = (buffer) => buffer.toString('base64');

/**
 * Normalizes the real Datanamix response shape:
 *
 * {
 *   Header: {},
 *   PDFReport: "Base64...",
 *   VerificationResults: {
 *     ResponseStatusCode: 1,
 *     ResponseMessage: "Face Match Successful",
 *     MatchScore: 0.9,
 *     FirstNames: "JOHN DOE",
 *     LastName: "SOAP",
 *     Gender: "M",
 *     Age: "30",
 *     HanisStatus: "Active",
 *     HanisReference: "123456"
 *   },
 *   Success: true,
 *   Messages: ["Face Match Successful"],
 *   ResponseCode: 200
 * }
 */
const normalizeResponse = (raw) => {
  // Pull the verification sub-object — all identity fields live here
  const vr = raw.VerificationResults ?? {};

  const statusCode = vr.ResponseStatusCode ?? 0;

  return {
    // ── Core result ──────────────────────────────────────────────────────
    responseStatusCode: statusCode,
    responseMessage:    vr.ResponseMessage ?? raw.Messages?.[0] ?? '',
    verificationStatus: statusCode === 1 ? 'Verified' : 'Failed',

    // ── Biometric score — API returns 0-1 decimal; convert to percentage ─
    faceMatchScore: vr.MatchScore != null ? vr.MatchScore * 100 : null,

    // ── Reference (HanisReference is the Datanamix transaction ID) ───────
    verificationReference: vr.HanisReference ?? null,

    // ── OCR-extracted identity fields ─────────────────────────────────────
    extractedOCRData: {
      FirstNames:     vr.FirstNames     ?? null,
      LastName:       vr.LastName       ?? null,
      Gender:         vr.Gender         ?? null,
      Age:            vr.Age            ?? null,
      HanisStatus:    vr.HanisStatus    ?? null,
      HanisReference: vr.HanisReference ?? null,
    },

    fraudFlags: [],

    // ── PDF report (base64 string at root level, not inside VerificationResults) ─
    verificationPdf: raw.PDFReport ?? null,

    // ── Preserved top-level fields ────────────────────────────────────────
    header:       raw.Header       ?? {},
    messages:     raw.Messages     ?? [],
    responseCode: raw.ResponseCode ?? null,

    // ── Full raw payload for audit storage ────────────────────────────────
    rawApiResponse: raw,
  };
};

/**
 * Calls the Datanamix "Profile Plus ID Photo Match Verification (Offline)" API.
 *
 * @param {Object} params
 * @param {string}  params.idNumber          - South African ID number
 * @param {Buffer}  params.captureImageBuffer - Image buffer from multer (ID front)
 * @param {string}  [params.clientReference]  - Loan/application reference
 * @returns {Promise<Object>} Normalized verification result
 */
const callProfileIdPhotoMatch = async ({
  idNumber,
  captureImageBuffer,
  clientReference,
}) => {
  if (!idNumber) throw new Error('IDNumber is required for KYC verification');
  if (!captureImageBuffer) throw new Error('ID front image is required for KYC verification');

  const captureImage = bufferToBase64(captureImageBuffer);
  const reference = clientReference || `KYC-${Date.now()}`;

  const payload = {
    EnvironmentType: 'SANDBOX',
    OutputFormat: 'JSON',
    ClientReference: reference,
    IDNumber: idNumber,
    CaptureImage: captureImage,
  };

  console.log(`[KYC] Calling Datanamix Profile ID Photo Match — Ref: ${reference}`);

  const response = await datanamixAxiosClient.post(ENDPOINT, payload);
  const normalized = normalizeResponse(response.data);

  console.log(
    `[KYC] Result: ${normalized.verificationStatus} | StatusCode: ${normalized.responseStatusCode} | FaceMatch: ${normalized.faceMatchScore}%`
  );

  return normalized;
};

module.exports = { callProfileIdPhotoMatch };
