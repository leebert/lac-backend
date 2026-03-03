import * as lifeAdminAgent from "../agents/lac.agent.js";
import * as sessionService from "./session.service.js";

export async function handleMessage(session, userMessage) {
  const response = await lifeAdminAgent.run(session, userMessage);

  await sessionService.update(session);

  return response;
}