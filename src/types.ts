import { Request, Response } from 'express';
import { Session } from 'express-session';
import { EntityManager, IDatabaseDriver, Connection } from '@mikro-orm/core';

interface mySession extends Session {
  userId: number
}

interface myRequest extends Request {
  session: mySession;
}

export type MyContext = {
  em: EntityManager<any> & EntityManager<IDatabaseDriver<Connection>>;
  req: myRequest;
  res: Response;
};
