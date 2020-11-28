import 'reflect-metadata';
import 'dotenv-safe/config';
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
import { createUpvoteLoader } from './utils/createUpvoteLoader';

const main = async () => {
  const connection: Connection = await createConnection({
    type: 'postgres',
    url: process.env.DATABADE_URL,
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
  const redis = new Redis(process.env.REDIS_URL);

  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(
    // Redis
    session({
      name: cookieName,
      store: new RedisStore({ client: redis, disableTouch: true }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years
        httpOnly: true,
        sameSite: 'lax', // protecting against csrf
        secure: __prod__, // cookie works only on https
        domain: __prod__ ? '.domain.com' : undefined // add your domain here for production
      },
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET,
      resave: false
    })
  );

  // graphql server
  const apolloServer = new ApolloServer({
    schema: await buildSchema({ resolvers: [PostResolver, UserResolver], validate: false }),
    context: ({ req, res }) => ({
      req,
      res,
      redis,
      userLoader: createUserLoader(),
      updootLoader: createUpvoteLoader()
    })
  });

  apolloServer.applyMiddleware({ app, cors: false });
  //

  app.use((err: Error, _: Request, res: Response, _2: NextFunction) => {
    res.status(500).json({ message: err.message });
  });

  app.listen(parseInt(process.env.PORT), () =>
    console.log(__listenMessage__(parseInt(process.env.PORT)))
  );
};

main().catch(err => console.log(err));
