import { Arg, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import { User } from '../entities/User';
import { MyContext } from 'src/types';

@Resolver()
export class UserResolver {
  //    Get All
  @Query(() => [User])
  getAllUsers(@Ctx() { em }: MyContext): Promise<User[]> {
    return em.find(User, {});
  }

  //    Get
  @Query(() => User, { nullable: true })
  getUser(@Arg('id') id: number, @Ctx() { em }: MyContext): Promise<User | null> {
    return em.findOne(User, { id });
  }
}
