import axios from 'axios';
import express from 'express';
import enforce from 'express-sslify';

import { IN_PROD, OAUTH_TOKEN, PORT, VERIFICATION_TOKEN } from './config.js';

const app = express();
IN_PROD && app.use(enforce.HTTPS({ trustProtoHeader: true }));
app.use(express.json());

app.post('/', (req, res) => {
  const { body } = req;

  if (body.token !== VERIFICATION_TOKEN) {
    return res.status(400).send('Bad Request');
  }

  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }

  res.status(200).end();

  const { event } = body;

  const unfurls = event.links.reduce((unfurls, { url }) => {
    const id = url.match(/\/(T\d+)$/);
    if (!id) return unfurls;

    unfurls[url] = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${url}|${id[1]}: Task name>`,
          },
        },
      ],
    };

    return unfurls;
  }, {});

  axios({
    url: 'https://slack.com/api/chat.unfurl',
    method: 'post',
    headers: { Authorization: `Bearer ${OAUTH_TOKEN}` },
    data: {
      channel: event.channel,
      ts: event.message_ts,
      unfurls: unfurls,
    },
  })
    .then(({ data }) => console.log(data))
    .catch(console.error);
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
