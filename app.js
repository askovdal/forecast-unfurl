import express from 'express';
import enforce from 'express-sslify';

import { IN_PROD, PORT, VERIFICATION_TOKEN } from './config.js';

const app = express();
IN_PROD && app.use(enforce.HTTPS({ trustProtoHeader: true }));
app.use(express.json());

app.post('/', (req, res) => {
  const { body } = req;

  if (body.type === 'url_verification' && body.token === VERIFICATION_TOKEN) {
    res.json({ challenge: body.challenge });
  }
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
