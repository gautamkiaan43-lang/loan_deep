const axios = require('axios');
const crypto = require('crypto');

class NuPayService {
  constructor() {
    this.username = process.env.WEBFIN_USERNAME;
    this.password = process.env.WEBFIN_PASSWORD;
    this.appName = process.env.WEBFIN_APP_NAME || 'IMS';
    
    // Choose UAT or Production base URL based on NODE_ENV
    this.apiUrl = process.env.NODE_ENV === 'production'
      ? (process.env.WEBFIN_BASE_URL || 'https://bacqofs.webfin.co.za/api/app/IMS/webfinApi')
      : (process.env.WEBFIN_UAT_URL || 'https://bacqofs-uat.webfin.co.za/api/app/LMS/webfinApi');
  }

  getCurrentDateTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  calculateWebfinHash(dataStr, dateTimeStr) {
    const hashInput = `${dataStr}${dateTimeStr}`;
    return crypto
      .createHmac('sha256', this.password)
      .update(hashInput)
      .digest('hex'); // lowercase hex digest matching Postman screenshot
  }

  async makeRequest(action, dataObject) {
    const dataStr = JSON.stringify(dataObject);
    const currentDateTime = this.getCurrentDateTime();
    const hash = this.calculateWebfinHash(dataStr, currentDateTime);

    const payload = {
      username: this.username,
      action: action,
      appName: process.env.NODE_ENV === 'production' ? this.appName : 'Debug',
      hash: hash,
      data: dataStr,
      currentDateTime: currentDateTime
    };

    console.log(`[Webfin API Request] Action: ${action} to ${this.apiUrl}`, JSON.stringify(payload));

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000 // 15 seconds timeout
      });

      console.log(`[Webfin API Response] Action: ${action}`, JSON.stringify(response.data));

      // Standardize response output for the controller
      if (response.data && response.data.error) {
        throw new Error(response.data.error.message || `Webfin action failed: ${action}`);
      }

      return {
        success: true,
        reference: response.data.reference || `WEBFIN-REF-${Math.floor(Math.random() * 1000000)}`,
        status: response.data.status || 'Pending Authentication',
        message: response.data.message || `Successfully executed ${action} via Webfin Gateway`
      };
    } catch (error) {
      console.error(`[Webfin API Error] Action: ${action}`, error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message || `Webfin service communication failed for ${action}`);
    }
  }

  async initiateMandate(appDetails) {
    const payload = {
      cardAcceptor: process.env.NUPAY_CARD_ACCEPTOR || '000005500000010',
      debtorAccountNumber: appDetails.bankVerification?.accountNumber || appDetails.accountNumber,
      debtorBankId: appDetails.bankVerification?.bankName || appDetails.bankName,
      debtorBranchNumber: appDetails.bankVerification?.branchCode || '250655',
      instalmentAmount: appDetails.estimatedMonthlyEMI || appDetails.approvedAmount,
      frequency: 'MNTH',
      debtorAuthenticationRequired: '0230', // Real-Time authentication
      contractReference: appDetails.applicationId || appDetails._id
    };

    return await this.makeRequest('initiateMandate', payload);
  }

  async maintainInstalment(params) {
    return await this.makeRequest('maintainInstalment', params);
  }

  async rescheduleInstalment(params) {
    return await this.makeRequest('rescheduleInstalment', params);
  }

  async cancelInstalment(params) {
    return await this.makeRequest('cancelInstalment', params);
  }

  async recallInstalment(params) {
    return await this.makeRequest('recallInstalment', params);
  }
}

module.exports = new NuPayService();
