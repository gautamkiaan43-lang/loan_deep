module.exports = {
  secret: process.env.JWT_SECRET || 'point47_super_secret_key',
  expiresIn: '30d',
};
