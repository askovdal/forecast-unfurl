export const {
  FORECAST_API_KEY,

  NODE_ENV,

  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
  SLACK_OAUTH_TOKEN,

  PORT,

  VERIFICATION_TOKEN,
} = process.env;

export const IN_PROD = NODE_ENV === 'production';
