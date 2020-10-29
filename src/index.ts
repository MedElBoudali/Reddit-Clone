import { MikroORM } from '@mikro-orm/core';
import microConfig from './mikro-orm.config';
import { Post } from './entities/Post';

const main = async () => {
  // Migrating table
  const orm = await MikroORM.init(microConfig);
  await orm.getMigrator().up();
  // Adding data to table
  // const post = orm.em.create(Post, { title: 'my first post' });
  // await orm.em.persistAndFlush(post);
  const posts = await orm.em.find(Post, {});
  console.log(posts);
};

main();
