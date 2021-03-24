export const {
  FORECAST_API_KEY,
  NODE_ENV,
  OAUTH_TOKEN,
  PORT,
  VERIFICATION_TOKEN,
} = process.env;

export const IN_PROD = NODE_ENV === 'production';
