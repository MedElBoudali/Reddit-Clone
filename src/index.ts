import 'reflect-metadata';
import { Connection, createConnection } from 'typeorm';
import express, { Request, Response, NextFunction } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { cookieName, __listenMessage__, __port__, __prod__ } from './config/constants';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';
import Redis from 'ioredis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors';
import { Post } from './entities/Post';
import { User } from './entities/User';
import path from 'path';
import { Updoot } from './entities/Updoot';
import { createUserLoader } from './utils/createUserLoader';

const main = async () => {
  const connection: Connection = await createConnection({
    type: 'postgres',
    database: 'reddit_clone',
    username: 'postgres',
    password: 'postgres',
    logging: true,
    synchronize: !__prod__,
    entities: [Post, User, Updoot],
    migrations: [path.join(__dirname, './migrations/*')]
  });

  await connection.runMigrations();

  // clear post table before migration
  // await Post.delete({});

  const app = express();

  // Redis
  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
  app.use(
    // Redis
    session({
      name: cookieName,
      store: new RedisStore({ client: redis, disableTouch: true }),
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
    context: ({ req, res }) => ({ req, res, redis, userLoader: createUserLoader })
  });

  apolloServer.applyMiddleware({ app, cors: false });
  //

  app.use((err: Error, _: Request, res: Response, _2: NextFunction) => {
    res.status(500).json({ message: err.message });
  });

  app.listen(__port__, () => console.log(__listenMessage__(__port__)));
};

main().catch(err => console.log(err));
