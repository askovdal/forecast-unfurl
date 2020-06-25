import axios from 'axios';
import express from 'express';
import enforce from 'express-sslify';

import {
  FORECAST_API_KEY,
  IN_PROD,
  OAUTH_TOKEN,
  PORT,
  VERIFICATION_TOKEN,
} from './config.js';

const app = express();
IN_PROD && app.use(enforce.HTTPS({ trustProtoHeader: true }));
app.use(express.json());

const getTask = async (id) => {
  const response = await axios({
    url: `https://api.forecast.it/api/v2/tasks/company_task_id/${id}`,
    method: 'get',
    headers: { 'X-FORECAST-API-KEY': FORECAST_API_KEY },
  }).catch((_reason) => {});

  if (!response) return;

  return response.data;
};

const createUnfurls = async (event) => {
  const unfurls = {};
  for (const { url } of event.links) {
    const id = url.match(/\/T(\d+)$/);
    if (!id) continue;

    const task = await getTask(id[1]);
    if (!task) continue;

    unfurls[url] = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${url}|T${id[1]}: ${task.title}>`,
          },
        },
      ],
    };
  }

  return unfurls;
};

const unfurlMessage = (event, unfurls) => {
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
};

app.post('/', async (req, res) => {
  const { body } = req;

  if (body.token !== VERIFICATION_TOKEN) {
    return res.status(400).send('Bad Request');
  }

  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }

  res.status(200).end();

  const { event } = body;
  const unfurls = await createUnfurls(event);
  unfurlMessage(event, unfurls);
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
