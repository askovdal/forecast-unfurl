import express from 'express';
import enforce from 'express-sslify';

import { IN_PROD, PORT, VERIFICATION_TOKEN } from './config.js';

const app = express();
IN_PROD && app.use(enforce.HTTPS({ trustProtoHeader: true }));
app.use(express.json());

app.post('/', (req, res) => {
  const { body } = req;

  if (body.token !== VERIFICATION_TOKEN) {
    return res.status(400).send('Bad Request');
  }

  if (body.type === 'url_verification' && body.token === VERIFICATION_TOKEN) {
    return res.json({ challenge: body.challenge });
  }

  console.log(body);
  if (body.event && body.event.links) {
    console.log(body.event.links);
  }

  res.status(200).end();
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
