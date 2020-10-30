import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/core';
import microConfig from './mikro-orm.config';
// import { Post } from './entities/Post';
import express, { Request, Response, NextFunction } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { __listenMessage__, __port__ } from './constants';
import { PostResolver } from './resolvers/post';
import { UserResolver } from './resolvers/user';

const main = async () => {
  // Migrating table
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();
  // Adding data to table
  // const post = orm.em.create(Post, { title: 'my first post' });
  // await orm.em.persistAndFlush(post);

  const app = express();

  // graphql
  const apolloServer = new ApolloServer({
    schema: await buildSchema({ resolvers: [PostResolver, UserResolver], validate: false }),
    context: () => ({ em: orm.em })
  });

  apolloServer.applyMiddleware({ app });
  //

  app.use((err: Error, _: Request, res: Response, _2: NextFunction) => {
    res.status(500).json({ message: err.message });
  });

  app.listen(4000, () => console.log(`${__listenMessage__}${__port__}`));
};

main().catch(err => console.log(err));
