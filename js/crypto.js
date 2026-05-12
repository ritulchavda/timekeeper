const Crypto = {
  KEY: 'TK_AES_Key_2024_TimeKeeper_v1_Secure',

  hash(text) {
    return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
  },

  encrypt(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(str, this.KEY).toString();
  },

  decrypt(ciphertext) {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.KEY);
      const str = bytes.toString(CryptoJS.enc.Utf8);
      if (!str) return null;
      try { return JSON.parse(str); } catch { return str; }
    } catch {
      return null;
    }
  }
};
