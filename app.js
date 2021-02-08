import axios from 'axios';
import camelize from 'camelize';
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

const forecast = axios.create({
  baseURL: 'https://api.forecast.it/api',
  headers: { 'X-FORECAST-API-KEY': FORECAST_API_KEY },
});

const escapeText = (text) =>
  text
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*/g, '✱');

const getTask = async (id) => {
  const response = await forecast
    .get(`/v2/tasks/company_task_id/${id}`)
    .catch(console.error);

  return response && camelize(response.data);
};

const getWorkflowColumn = async ({ projectId, workflowColumn }) => {
  const {
    data: { name },
  } = await forecast
    .get(`/v1/projects/${projectId}/workflow_columns/${workflowColumn}`)
    .catch(console.error);

  return name ? escapeText(name) : 'None';
};

const getRole = async ({ role }) => {
  const {
    data: { name },
  } = await forecast.get(`/v1/roles/${role}`).catch(console.error);

  return escapeText(name);
};

const getMainAssignee = async ({ assignedPersons, role }) => {
  // Retrieve information of all assigned persons.
  const responses = await Promise.all(
    assignedPersons.map((assignedPerson) =>
      forecast.get(`/v1/persons/${assignedPerson}`).catch(console.error)
    )
  );
  const people = responses.map(({ data }) => camelize(data));

  // Get the first and last name of the first assignee whose default role is the
  // same as the role on the task. If there are none, get the first who isn't a
  // client. If there are none, get the first assignee.
  const { firstName, lastName } =
    people.find(({ defaultRole }) => defaultRole === role) ||
    people.find(({ userType }) => userType !== 'CLIENT') ||
    people[0];

  return escapeText(`${firstName} ${lastName}`);
};

const createUnfurl = async ({ url }) => {
  const taskIdMatch = url.match(/\/T(\d+)(?:$|#)/);
  if (!taskIdMatch) return;

  const taskId = taskIdMatch[1];
  const task = await getTask(taskId);
  if (!task) return;
  const assigneesLength = task.assignedPersons.length;

  const [status, role, assignee] = await Promise.all([
    getWorkflowColumn(task),
    task.role ? getRole(task) : 'None',
    assigneesLength ? getMainAssignee(task) : 'Unassigned',
  ]);

  let assigneeText;
  if (assigneesLength === 2) {
    assigneeText = `Assignees: *${assignee} + 1 other*`;
  } else if (assigneesLength > 2) {
    assigneeText = `Assignees: *${assignee} + ${assigneesLength - 1} others*`;
  } else {
    assigneeText = `Assignee: *${assignee}*`;
  }

  const statusText = `Status: *${status}*`;
  const roleText = `Role: *${role}*`;

  const contextText = [statusText, assigneeText, roleText]
    .map((text) =>
      // Replace normal spaces with non-breaking spaces
      text.replace(/ /g, ' ')
    )
    .join('        ');

  return [
    url,
    {
      color: '#6e0fea',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${url}|T${taskId} *${escapeText(task.title)} *>`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: contextText,
            },
          ],
        },
      ],
    },
  ];
};

const createUnfurls = async ({ links }) => {
  // Get all unfurls as arrays of [taskUrl, unfurl]
  const unfurls = await Promise.all(links.map(createUnfurl));

  // Filter out the undefined values (invalid tasks) and turn the array of
  // arrays into key-value pairs of {taskUrl: unfurl}
  return Object.fromEntries(unfurls.filter(Boolean));
};

const unfurlMessage = ({ channel, message_ts: ts }, unfurls) =>
  axios
    .post(
      'https://slack.com/api/chat.unfurl',
      {
        channel,
        ts,
        unfurls,
      },
      {
        headers: { Authorization: `Bearer ${OAUTH_TOKEN}` },
      }
    )
    .catch(console.error);

app.post('/', async (req, res) => {
  const {
    body: { challenge, event, token, type },
  } = req;

  if (token !== VERIFICATION_TOKEN) {
    return res.sendStatus(400);
  }

  if (type === 'url_verification') {
    return res.json({ challenge });
  }

  res.sendStatus(200);

  const unfurls = await createUnfurls(event);
  unfurlMessage(event, unfurls);
});

app.listen(PORT, () => console.log(`App listening on port ${PORT}`));
