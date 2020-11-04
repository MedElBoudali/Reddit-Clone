import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import microConfig from './config/mikro-orm.config';
import express, { Request, Response, NextFunction } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { __listenMessage__, __port__, __prod__ } from './config/constants';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import redis from 'redis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import { MyContext } from './types';
import cors from 'cors';

const main = async () => {
  // Migrating table
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();

  const app = express();

  // Redis
  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
  app.use(
    session({
      name: 'gid',
      store: new RedisStore({ client: redisClient, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years
        httpOnly: true,
        sameSite: 'lax', // protecting against csrf
        secure: __prod__ // cookie works only on https
      },
      saveUninitialized: false,
      secret: 'fzefzcefevcczgjnkukjgscercqzgsevhevcg',
      resave: false
    })
  );

  // graphql server
  const apolloServer = new ApolloServer({
    schema: await buildSchema({ resolvers: [PostResolver, UserResolver], validate: false }),
    context: ({ req, res }): MyContext => ({ em: orm.em, req, res })
  });

  apolloServer.applyMiddleware({ app, cors: false });
  //

  app.use((err: Error, _: Request, res: Response, _2: NextFunction) => {
    res.status(500).json({ message: err.message });
  });

  app.listen(__port__, () => console.log(__listenMessage__(__port__)));
};

main().catch(err => console.log(err));
