import { Arg, Ctx, Field, InputType, Mutation, ObjectType, Query, Resolver } from 'type-graphql';
import { User } from '../entities/User';
import { MyContext } from 'src/types';
import argon2 from 'argon2';

@InputType()
class userInputs {
  @Field()
  username: string;
  @Field()
  password: string;
}

// Error handling
@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  //    Get user
  @Query(() => User, { nullable: true })
  getUser(@Arg('id') id: number, @Ctx() { em }: MyContext): Promise<User | null> {
    return em.findOne(User, { id });
  }

  //    Register
  @Mutation(() => User)
  async register(
    @Arg('userIputs') userInputs: userInputs,
    @Ctx() { em }: MyContext
  ): Promise<User> {
    const hashedPassword = await argon2.hash(userInputs.password);
    const user = em.create(User, { username: userInputs.username, password: hashedPassword });
    await em.persistAndFlush(user);
    return user;
  }

  //  Login
  @Mutation(() => UserResponse)
  async login(
    @Arg('userIputs') userInputs: userInputs,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: userInputs.username });
    if (!user) {
      return { errors: [{ field: 'username', message: "username doesn't exist!" }] };
    }
    const isMatch = await argon2.verify(user.password, userInputs.password);
    if (!isMatch) {
      return { errors: [{ field: 'password', message: "password doesn't match!" }] };
    }
    return { user: user };
  }
}
