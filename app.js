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

const forecast = axios.create({
  baseURL: 'https://api.forecast.it/api',
  headers: { 'X-FORECAST-API-KEY': FORECAST_API_KEY },
});

const getTask = async (id) => {
  const response = await forecast
    .get(`/v2/tasks/company_task_id/${id}`)
    .catch(console.error);

  return response && response.data;
};

const getWorkflowColumn = async ({
  project_id: projectId,
  workflow_column: workflowColumn,
}) => {
  const {
    data: { name },
  } = await forecast
    .get(`/v1/projects/${projectId}/workflow_columns/${workflowColumn}`)
    .catch(console.error);

  return name || 'None';
};

const getRole = async ({ role }) => {
  const {
    data: { name },
  } = await forecast.get(`/v1/roles/${role}`).catch(console.error);

  return name;
};

const getMainAssignee = async ({ assigned_persons: assignedPersons, role }) => {
  const people = await Promise.all(
    assignedPersons.map((assignedPerson) =>
      forecast.get(`/v1/persons/${assignedPerson}`).catch(console.error)
    )
  );

  let firstName, lastName, defaultRole;
  if (people.length === 1 || role === null) {
    // If there is only one assignee or no role on the task, just use the first
    // assignee's name.
    ({
      data: { first_name: firstName, last_name: lastName },
    } = people[0]);
  } else {
    // If there are more than one assignee, go through each one, and if their
    // default role is the same as the role on the task then use that assignee's
    // name. If none of the default roles match then use the last assignee's
    // name.
    for ({
      data: {
        default_role: defaultRole,
        first_name: firstName,
        last_name: lastName,
      },
    } of people) {
      if (defaultRole === role) {
        break;
      }
    }
  }

  return `${firstName} ${lastName}`;
};

const createUnfurls = async ({ links }) => {
  const unfurls = {};
  for (const { url } of links) {
    const id = url.match(/\/T(\d+)$/);
    if (!id) continue;

    const task = await getTask(id[1]);
    if (!task) continue;

    const assigneesLength = task.assigned_persons.length;

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

    // Build context text and replace normal spaces with non-breaking spaces
    const contextText = `Status: *${status}*\\t\\t${assigneeText}\\t\\tRole: *${role}*`
      .split(' ')
      .join(' ');

    unfurls[url] = {
      color: '#6e0fea',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<${url}|T${id[1]} *${task.title}*>`,
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
    };
  }

  return unfurls;
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
