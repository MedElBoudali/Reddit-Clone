import { MyContext } from 'src/types';
import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { Post } from '../entities/Post';

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
  code: number;
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
  //    Get All
  @Query(() => [Post])
  async getAllPosts(): Promise<Post[]> {
    return await Post.find();
  }

  //    Get
  @Query(() => Post, { nullable: true })
  async getPost(@Arg('id') id: number): Promise<Post | undefined> {
    return await Post.findOne(id);
  }

  //    Create
  @Mutation(() => PostResponse)
  async createPost(
    @Arg('postInput') postInput: PostInput,
    @Ctx() { req }: MyContext
  ): Promise<PostResponse> {
    // 2 sql queries 1 create 2 select
    const userId = req.session.userId;
    if (!userId) {
      return {
        error: {
          code: 401,
          message: 'Unauthorized'
        }
      };
    }
    const post = await Post.create({ ...postInput, authorId: userId }).save();
    return { post };
  }

  //    Update
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
