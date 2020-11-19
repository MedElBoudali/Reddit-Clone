import { isAuth } from '../middleware/isAuthenticated';
import { MyContext } from 'src/types';
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  UseMiddleware
} from 'type-graphql';
import { Post } from '../entities/Post';
import { getConnection } from 'typeorm';

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

@Resolver()
export class PostResolver {
  @Query(() => [Post])
  async getAllPosts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<Post[]> {
    const minLimit = Math.min(50, limit);
    console.log(cursor as string);
    const QB = getConnection()
      .getRepository(Post)
      .createQueryBuilder('p')
      .orderBy('"createdAt"', 'DESC') // using '""' for psql to keep A
      .take(minLimit);

    if (cursor) {
      QB.where('"createdAt" < :cursor', { cursor: new Date(parseInt(cursor)) });
    }

    return await QB.getMany();
  }

  @Query(() => Post, { nullable: true })
  async getPost(@Arg('id') id: number): Promise<Post | undefined> {
    return await Post.findOne(id);
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
  async updatePost(
    @Arg('id') id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }
    if (typeof title !== 'undefined') {
      await Post.update({ id }, { title });
    }
    return post;
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
  async deletePost(@Arg('id') id: number): Promise<boolean> {
    await Post.delete(id);
    return true;
  }
}
