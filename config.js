export const {
  NODE_ENV = 'development',
  OAUTH_TOKEN,
  PORT = 3001,
  VERIFICATION_TOKEN = 'test_token',
} = process.env;

export const IN_PROD = NODE_ENV === 'production';
