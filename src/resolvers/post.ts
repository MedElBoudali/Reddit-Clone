import { isAuth } from '../middleware/isAuthenticated';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware
} from 'type-graphql';
import { Post } from '../entities/Post';
import { getConnection } from 'typeorm';
import { Updoot } from '../entities/Updoot';

@InputType()
class PostInput {
  @Field()
  title: string;
  @Field()
  text: string;
}

@ObjectType()
class ErrorField {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class PostResponse {
  @Field(() => ErrorField, { nullable: true })
  error?: ErrorField;
  @Field(() => Post, { nullable: true })
  post?: Post;
}

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field()
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  // Votes
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth) // check if logged in
  async vote(
    @Arg('postId', () => Int) postId: number,
    @Arg('value', () => Int) value: number,
    @Ctx() { req }: MyContext
  ) {
    const isUpdoot = value !== -1;
    const realValue = isUpdoot ? 1 : -1;
    const { userId } = req.session;
    const updoot = await Updoot.findOne({ where: { postId, userId } });
    // if the user has voted on the post before
    // and he want to change the value
    if (updoot && updoot.value !== realValue) {
      // update and change the vote value
      await getConnection().transaction(async tm => {
        await tm.query(
          `
          update updoot 
          set value = $1
          where "postId" = $2 and "userId" = $3`,
          [realValue, postId, userId]
        );
        await tm.query(
          `
          update post 
          set points = points + $1
          where "id" = $2`,
          [2 * realValue, postId]
        );
      });
    } else if (!updoot) {
      // we shouldn't use this query use the other one
      //   await getConnection().query(
      //     `
      // START TRANSACTION;
      // insert into updoot ("userId", "postId", value)
      // values (${userId}, ${postId}, ${realValue});
      // update post
      // set points = points + ${realValue}
      // where id = ${postId};
      // COMMIT;
      // `
      // );
      // the other way of using transaction (multiple queries) with typeorm
      await getConnection().transaction(async tm => {
        await tm.query(
          `
          insert into updoot ("userId", "postId", value)
          values ($1, $2, $3)`,
          [userId, postId, realValue]
        );
        await tm.query(
          `
          update post
          set points = points + $1
          where id = $2`,
          [realValue, postId]
        );
      });
    }

    return true;
  }

  // add new field to return 100 letter
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post) {
    return root.text.slice(0, 200) + '...';
  }

  @Query(() => PaginatedPosts)
  async getAllPosts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null,
    @Ctx() { req }: MyContext
  ): Promise<PaginatedPosts> {
    const minLimit = Math.min(50, limit);
    const minLimitPlusOne = minLimit + 1;
    const userId = req.session.userId;
    //=> get all posts and search for the auther by authorId but without ortherby it gives us error
    // const QB = getConnection()
    //   .getRepository(Post)
    //   .createQueryBuilder('post')
    //   .innerJoinAndSelect('post.author', 'author', 'author.id = post."authorId"')
    //=> delete this line   .orderBy('"createdAt"', 'DESC') // using '""' for psql to keep A
    //   .take(minLimitPlusOne);

    // if (cursor) {
    //   QB.where('post."createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    // }
    // check if he has more by adding +1 to minLimit
    // const posts = await QB.getMany();
    // return { posts: posts.slice(0, minLimit), hasMore: posts.length === minLimitPlusOne };

    //=> use the other way with query (p is alias small name for posts)
    const queryParams: any[] = [minLimitPlusOne];
    if (userId) {
      queryParams.push(userId);
    }
    let cursorId = 3;
    if (cursor) {
      queryParams.push(new Date(parseInt(cursor)));
      cursorId = queryParams.length;
    }
    const posts = await getConnection().query(
      `
      select p.*, 
      json_build_object(
        'id', u.id,
        'username', u.username,
        'email', u.email,
        'createdAt', u."createdAt",
        'updatedAt', u."updatedAt"
      ) author,
      ${
        userId
          ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"'
          : 'null as "voteStatus"'
      }
      from post p
      inner join public.user u on u.id = p."authorId"
      ${cursor ? `where p."createdAt" < $${cursorId}` : ''}
      order by p."createdAt" DESC
      limit $1
    `,
      queryParams
    );

    return { posts, hasMore: posts.length === minLimitPlusOne };
  }

  @Query(() => Post, { nullable: true })
  getPost(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id, { relations: ['author'] });
  }

  @Mutation(() => PostResponse)
  @UseMiddleware(isAuth)
  async createPost(
    @Arg('postInput') postInput: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<PostResponse> {
    // 2 sql queries 1 create 2 select
    const userId = req.session.userId;
    if (!postInput.title || postInput.title.length <= 3) {
      return { error: { field: 'title', message: 'Title should be greater than 3!' } };
    }
    if (!postInput.text || postInput.text.length <= 3) {
      return { error: { field: 'text', message: 'Body text should be greater than 3!' } };
    }
    const post = await Post.create({ ...postInput, authorId: userId }).save();
    return { post };
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Ctx() { req }: MyContext
  ): Promise<Post | null> {
    const userId = req.session.userId;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .update(Post)
        .set({ title, text })
        .where('id = :id and authorId = :authorId', {
          id,
          authorId: userId
        })
        .returning('*')
        .execute();
      return result.raw[0];
    } catch (error) {
      return null;
    }
  }

  //    Delete and return the deleted post
  @Mutation(() => Post, { nullable: true })
  async deletePostAndGetPost(@Arg('id') id: number): Promise<Post | undefined> {
    const post = await Post.findOne(id);
    await Post.delete(id);
    return post;
  }

  //    Delete and return true if not return false
  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(@Arg('id', () => Int) id: number, @Ctx() { req }: MyContext): Promise<boolean> {
    const userId = req.session.userId;
    // Not cascade way
    // try {
    //   const post = await Post.findOne(id);
    //   if (!post) {
    //     return false;
    //   }
    //   if (post.authorId !== userId) {
    //     return false;
    //   }
    //   await Updoot.delete({ userId });
    //   await Post.delete({ id, authorId: userId });
    //   return true;
    // } catch (error) {
    //   console.log(error);
    //   return false;
    // }

    // if we want to use cascade we need to go to updoot and add ,{onDelete: "CASCADE"}
    try {
      await Post.delete({ id, authorId: userId });
      return true;
    } catch (error) {
      return false;
    }
  }
}
