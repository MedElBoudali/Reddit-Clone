import { Arg, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import { Post } from '../entities/Post';
import { MyContext } from 'src/types';

@Resolver()
export class PostResolver {
  //    Get All
  @Query(() => [Post])
  getAllPosts(@Ctx() { em }: MyContext): Promise<Post[]> {
    return em.find(Post, {});
  }

  //    Get
  @Query(() => Post, { nullable: true })
  getPost(@Arg('id') id: number, @Ctx() { em }: MyContext): Promise<Post | null> {
    return em.findOne(Post, { id });
  }

  //    Create
  @Mutation(() => Post)
  async createPost(@Arg('title') title: string, @Ctx() { em }: MyContext): Promise<Post> {
    const newPost = em.create(Post, { title });
    await em.persistAndFlush(newPost);
    return newPost;
  }

  //    Update
  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id') id: number,
    @Arg('title', () => String, { nullable: true }) title: string,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.findOne(Post, { id });
    if (!post) {
      // return null if the post not found
      return null;
    }
    if (typeof title !== 'undefined') {
      // if the entred title is not undefined
      post.title = title;
      await em.persistAndFlush(post);
    }
    return post;
  }

  //    Delete and return the deleted post
  @Mutation(() => Post, { nullable: true })
  async deletePostAndGetPost(
    @Arg('id') id: number,
    @Ctx() { em }: MyContext
  ): Promise<Post | null> {
    const post = await em.findOne(Post, { id });
    if (!post) {
      // return null if the post not found
      return null;
    }
    await em.removeAndFlush(post);
    return post;
  }

  //    Delete and return true if not return false
  @Mutation(() => Boolean)
  async deletePost(@Arg('id') id: number, @Ctx() { em }: MyContext): Promise<boolean> {
    const deleted = await em.nativeDelete(Post, { id });
    return deleted > 0 ? true : false;
  }
}
