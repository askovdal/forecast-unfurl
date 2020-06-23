import express from 'express';
import enforce from 'express-sslify';
import axios from 'axios';

import { IN_PROD, OAUTH_TOKEN, PORT, VERIFICATION_TOKEN } from './config.js';

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

  res.status(200).end();

  console.log(body);
  if (body.event && body.event.links) {
    console.log(body.event.links);
  }

  const { event } = body;

  axios({
    url: 'https://slack.com/api/chat.unfurl',
    method: 'post',
    headers: { Authorization: `Bearer ${OAUTH_TOKEN}` },
    data: {
      channel: event.channel,
      ts: event.message_ts,
      unfurls: {
        [event.links[0].url]: {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `<${event.links[0].url}|Test>`,
              },
            },
          ],
        },
      },
    },
  }).then(({ data }) => console.log(data));
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
